import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { isValidTimeFormat } from "../payroll";
import { projectService } from "./projectService";
import { notificationService } from "./notificationService";
import type {
  CreateFutureActivityInput,
  FutureActivity,
  UpdateFutureActivityInput,
} from "../../entities/FutureActivity";
import { addDaysIso, addJalaliMonthsIso, daysBetweenIso, getTodayIso } from "../../shared/utils/jalaliDate";

const VALID_PRIORITIES = ["low", "medium", "high"];
const MAX_RECURRENCE_OCCURRENCES = 60;

async function validateFloorRelations(input: { floorId?: string | null; stageId?: string | null; taskId?: string | null }): Promise<void> {
  if (!input.floorId) {
    if (input.stageId || input.taskId) throw new ValidationError("مرحله یا کار بدون طبقه معتبر نیست.");
    return;
  }
  const floor = await db.floors.get(input.floorId);
  if (!floor) throw new NotFoundError("طبقه انتخاب‌شده پیدا نشد.");
  const activeProjectId = await projectService.getOrCreateActiveProjectId();
  if (floor.projectId !== activeProjectId) throw new ValidationError("طبقه انتخاب‌شده متعلق به پروژه فعال نیست.");
  if (input.stageId) {
    const stage = await db.floorStages.get(input.stageId);
    if (!stage || stage.floorId !== input.floorId) throw new ValidationError("مرحله انتخاب‌شده متعلق به این طبقه نیست.");
  }
  if (input.taskId) {
    const task = await db.floorTasks.get(input.taskId);
    if (!task || task.floorId !== input.floorId) throw new ValidationError("کار انتخاب‌شده متعلق به این طبقه نیست.");
  }
}

function validateCreateInput(input: CreateFutureActivityInput): void {
  if (!input.date) throw new ValidationError("تاریخ فعالیت الزامی است.");
  if (!input.title?.trim()) throw new ValidationError("عنوان فعالیت الزامی است.");
  if (!VALID_PRIORITIES.includes(input.priority)) throw new ValidationError("اولویت نامعتبر است.");
  if (input.time && !isValidTimeFormat(input.time)) {
    throw new ValidationError("فرمت ساعت باید HH:mm باشد.");
  }
  if (input.endDate && input.endDate < input.date) {
    throw new ValidationError("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.");
  }
  if (input.recurrence) {
    if (input.recurrence.interval < 1) throw new ValidationError("فاصله تکرار باید حداقل ۱ باشد.");
    if (input.recurrence.occurrences < 1 || input.recurrence.occurrences > MAX_RECURRENCE_OCCURRENCES) {
      throw new ValidationError(`تعداد تکرار باید بین ۱ تا ${MAX_RECURRENCE_OCCURRENCES} باشد.`);
    }
  }
}

/** محاسبه تاریخ رخداد بعدی بر اساس نوع تکرار. */
function nextOccurrenceDate(
  currentDate: string,
  frequency: "daily" | "weekly" | "monthly",
  interval: number
): string {
  if (frequency === "daily") return addDaysIso(currentDate, interval);
  if (frequency === "weekly") return addDaysIso(currentDate, interval * 7);
  return addJalaliMonthsIso(currentDate, interval);
}

export const futureActivityService = {
  async create(input: CreateFutureActivityInput): Promise<FutureActivity[]> {
    validateCreateInput(input);
    await validateFloorRelations(input);
    const now = new Date().toISOString();
    const seriesId = input.recurrence ? randomUUID() : null;
    const occurrenceCount = input.recurrence?.occurrences ?? 1;

    // مدت فعالیت (تعداد روز بین شروع و پایان)؛ برای فعالیت‌های تکرارشونده،
    // همین مدت روی تک‌تک رخدادها اعمال می‌شود (مثلاً «هر هفته یک فعالیت
    // ۳روزه»)، نه فقط روی رخداد اول.
    const durationDays = input.endDate ? daysBetweenIso(input.date, input.endDate) : 0;

    const rows: FutureActivity[] = [];
    let currentDate = input.date;
    const activeProjectId = await projectService.getOrCreateActiveProjectId();

    for (let i = 0; i < occurrenceCount; i++) {
      rows.push({
        id: randomUUID(),
        projectId: activeProjectId,
        seriesId,
        date: currentDate,
        endDate: durationDays > 0 ? addDaysIso(currentDate, durationDays) : null,
        time: input.time || null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        priority: input.priority,
        isCompleted: false,
        workerId: input.workerId || null,
        floorId: input.floorId || null,
        stageId: input.stageId || null,
        taskId: input.taskId || null,
        createdAt: now,
        updatedAt: now,
      });
      if (i < occurrenceCount - 1 && input.recurrence) {
        currentDate = nextOccurrenceDate(currentDate, input.recurrence.frequency, input.recurrence.interval);
      }
    }

    await db.futureActivities.bulkAdd(rows);
    // نوتیفیکیشن بخشی از چرخهٔ فعلی Activity است؛ خطای آن نباید ذخیره‌سازی را بشکند.
    for (const row of rows) await notificationService.scheduleForActivity(row);
    return rows;
  },

  async update(id: string, input: UpdateFutureActivityInput): Promise<FutureActivity> {
    const existing = await db.futureActivities.get(id);
    if (!existing) throw new NotFoundError(`فعالیتی با شناسه ${id} یافت نشد.`);

    if (input.title !== undefined && !input.title.trim()) {
      throw new ValidationError("عنوان فعالیت الزامی است.");
    }
    if (input.priority !== undefined && !VALID_PRIORITIES.includes(input.priority)) {
      throw new ValidationError("اولویت نامعتبر است.");
    }
    if (input.time && !isValidTimeFormat(input.time)) {
      throw new ValidationError("فرمت ساعت باید HH:mm باشد.");
    }

    await validateFloorRelations({
      floorId: input.floorId !== undefined ? input.floorId : existing.floorId,
      stageId: input.stageId !== undefined ? input.stageId : existing.stageId,
      taskId: input.taskId !== undefined ? input.taskId : existing.taskId,
    });

    const nextDate = input.date ?? existing.date;
    const nextEndDate = input.endDate !== undefined ? input.endDate || null : existing.endDate;
    if (nextEndDate && nextEndDate < nextDate) {
      throw new ValidationError("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.");
    }

    const updated: FutureActivity = {
      ...existing,
      date: nextDate,
      endDate: nextEndDate,
      time: input.time !== undefined ? input.time || null : existing.time,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      priority: input.priority ?? existing.priority,
      isCompleted: input.isCompleted !== undefined ? input.isCompleted : existing.isCompleted,
      workerId: input.workerId !== undefined ? input.workerId || null : existing.workerId,
      floorId: input.floorId !== undefined ? input.floorId || null : existing.floorId,
      stageId: input.stageId !== undefined ? input.stageId || null : existing.stageId,
      taskId: input.taskId !== undefined ? input.taskId || null : existing.taskId,
      updatedAt: new Date().toISOString(),
    };
    await db.futureActivities.put(updated);
    if (updated.isCompleted) {
      await notificationService.cancelForActivity(updated.id);
    } else {
      await notificationService.scheduleForActivity(updated);
    }
    return updated;
  },

  async toggleCompleted(id: string): Promise<FutureActivity> {
    const existing = await db.futureActivities.get(id);
    if (!existing) throw new NotFoundError(`فعالیتی با شناسه ${id} یافت نشد.`);
    return this.update(id, { isCompleted: !existing.isCompleted });
  },

  async remove(id: string): Promise<void> {
    const existing = await db.futureActivities.get(id);
    if (!existing) throw new NotFoundError(`فعالیتی با شناسه ${id} یافت نشد.`);
    await db.futureActivities.delete(id);
    await notificationService.cancelForActivity(id);
  },

  /** حذف تمام رخدادهای یک سری فعالیت تکرارشونده. */
  async removeSeries(seriesId: string): Promise<void> {
    const items = await db.futureActivities.where("seriesId").equals(seriesId).toArray();
    await db.futureActivities.bulkDelete(items.map((i) => i.id));
    for (const item of items) await notificationService.cancelForActivity(item.id);
  },

  /**
   * فهرست فعالیت‌ها بر اساس محدوده. 'upcoming' یعنی از امروز به بعد (پیش‌فرض
   * صفحه اصلی)، 'history' یعنی تاریخچه روزهای گذشته (چه انجام‌شده چه نشده)،
   * و 'all' یعنی بدون فیلتر تاریخ. اگر workerId داده شود، فقط فعالیت‌های
   * مرتبط با همان نیرو (یا فعالیت‌های عمومی، بسته به onlyLinked) برگردانده می‌شود.
   */
  async listAll(filter?: {
    scope?: "upcoming" | "history" | "all";
    includeCompleted?: boolean;
    workerId?: string;
  }): Promise<FutureActivity[]> {
    const today = getTodayIso();
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    let items = await db.futureActivities.where({ projectId: activeProjectId }).toArray();

    const scope = filter?.scope ?? "upcoming";
    if (scope === "upcoming") {
      // آینده = روزهای امروز/بعد + هر فعالیت سررسیدگذشته‌ای که هنوز انجام
      // نشده (تا از این صفحه بتوان سریع علامت زد)، نه صرفاً بر اساس تاریخ.
      items = items.filter((a) => a.date >= today || !a.isCompleted);
    }
    if (scope === "history") items = items.filter((a) => a.date < today);

    if (scope !== "history" && !filter?.includeCompleted) {
      items = items.filter((a) => !a.isCompleted);
    }
    if (filter?.workerId) items = items.filter((a) => a.workerId === filter.workerId);

    return items.sort((a, b) => {
      if (a.date !== b.date) return scope === "history" ? (a.date < b.date ? 1 : -1) : a.date < b.date ? -1 : 1;
      const at = a.time ?? "99:99";
      const bt = b.time ?? "99:99";
      if (at !== bt) return at < bt ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
  },

  /** فعالیت‌های نزدیک (برای خلاصه داشبورد)، شامل سررسیدهای گذشته انجام‌نشده. */
  async listUpcomingSummary(limit = 5): Promise<FutureActivity[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const items = await db.futureActivities.where({ projectId: activeProjectId }).toArray();
    return items
      .filter((a) => !a.isCompleted)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(0, limit);
  },

  /** تعداد فعالیت‌های سررسید امروز یا گذشته که هنوز انجام نشده‌اند (برای یادآوری داخل اپ). */
  async countDueOrOverdue(): Promise<number> {
    const today = getTodayIso();
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const items = await db.futureActivities.where({ projectId: activeProjectId }).toArray();
    return items.filter((a) => !a.isCompleted && a.date <= today).length;
  },

  async listByFloor(floorId: string): Promise<FutureActivity[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== projectId) return [];
    const items = await db.futureActivities.where({ projectId, floorId }).toArray();
    return items.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));
  },
};
