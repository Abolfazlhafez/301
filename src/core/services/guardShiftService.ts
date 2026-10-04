import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { calculateMinutesBetween, isValidTimeFormat } from "../payroll";
import { workerService } from "./workerService";
import { projectService } from "./projectService";
import type { CreateGuardShiftInput, GuardShift, UpdateGuardShiftInput } from "../../entities/GuardShift";

export interface ListGuardShiftsFilter {
  workerId?: string;
  date?: string;
  from?: string;
  to?: string;
}

function matchesFilter(s: GuardShift, filter?: ListGuardShiftsFilter): boolean {
  if (!filter) return true;
  if (filter.workerId && s.workerId !== filter.workerId) return false;
  if (filter.date && s.date !== filter.date) return false;
  if (filter.from && s.date < filter.from) return false;
  if (filter.to && s.date > filter.to) return false;
  return true;
}

export const guardShiftService = {
  async list(filter?: ListGuardShiftsFilter): Promise<GuardShift[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const all = await db.guardShifts.where({ projectId: activeProjectId }).toArray();
    return all
      .filter((s) => matchesFilter(s, filter))
      .sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : a.date < b.date ? 1 : -1));
  },

  async findByWorkerAndDate(workerId: string, date: string): Promise<GuardShift[]> {
    // نکتهٔ ایزوله‌سازی پروژه: بر خلاف list() که صریحاً با projectId فیلتر
    // می‌شود، این متد قبلاً فقط با [workerId+date] کوئری می‌گرفت — بدون فیلتر
    // پروژه. چون یک نیرو می‌تواند هم‌زمان به چند پروژه لینک باشد
    // (projectWorkers، رابطهٔ many-to-many)، اگر همان نیرو در پروژهٔ دیگری هم
    // نوبت نگهبانی داشته باشد، آن نوبت هم برمی‌گشت و گزارش روزانه/ماهانهٔ
    // پروژهٔ فعال را با داده‌ی پروژهٔ دیگر آلوده می‌کرد. نتیجهٔ خام از روی
    // ایندکس ترکیبی گرفته می‌شود (چون این تنها ایندکسی است که برای این کوئری
    // وجود دارد)، سپس همان‌جا در حافظه به پروژهٔ فعال محدود می‌شود — تعداد
    // نوبت‌های یک نیرو در یک روز همیشه خیلی کم است، پس این فیلتر اضافه در
    // حافظه هیچ هزینهٔ محسوسی ندارد.
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const shifts = await db.guardShifts.where("[workerId+date]").equals([workerId, date]).sortBy("startTime");
    return shifts.filter((s) => s.projectId === activeProjectId);
  },

  /**
   * ثبت یک نوبت نگهبانی جدید. مستقل از رکورد حضور و غیاب عادی همان روز است
   * (نیازی به ثبت ساعت ورود/خروج عادی نیست) و چند نوبت برای یک روز مجاز است.
   */
  async create(input: CreateGuardShiftInput): Promise<GuardShift> {
    if (!input.workerId) throw new ValidationError("شناسه نیرو الزامی است.");
    if (!input.date) throw new ValidationError("تاریخ الزامی است.");
    if (!isValidTimeFormat(input.startTime) || !isValidTimeFormat(input.endTime)) {
      throw new ValidationError("فرمت ساعت باید HH:mm باشد.");
    }

    const worker = await workerService.findByIdOrNull(input.workerId);
    if (!worker) throw new NotFoundError(`نیرویی با شناسه ${input.workerId} یافت نشد.`);
    if (!worker.guardDutyEnabled) {
      throw new ValidationError("ابتدا امکان نگهبانی را برای این نیرو در تنظیمات نیرو فعال کنید.");
    }

    const duration = calculateMinutesBetween(input.startTime, input.endTime);
    if (duration <= 0) throw new ValidationError("ساعت پایان باید بعد از ساعت شروع باشد.");

    const now = new Date().toISOString();
    const created: GuardShift = {
      id: randomUUID(),
      projectId: await projectService.getOrCreateActiveProjectId(),
      workerId: input.workerId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: duration,
      note: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    await db.guardShifts.add(created);
    return created;
  },

  async update(id: string, input: UpdateGuardShiftInput): Promise<GuardShift> {
    const existing = await db.guardShifts.get(id);
    if (!existing) throw new NotFoundError(`نوبت نگهبانی با شناسه ${id} یافت نشد.`);

    const startTime = input.startTime ?? existing.startTime;
    const endTime = input.endTime ?? existing.endTime;

    if (input.startTime || input.endTime) {
      if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
        throw new ValidationError("فرمت ساعت باید HH:mm باشد.");
      }
      const duration = calculateMinutesBetween(startTime, endTime);
      if (duration <= 0) throw new ValidationError("ساعت پایان باید بعد از ساعت شروع باشد.");
    }

    const updated: GuardShift = {
      ...existing,
      date: input.date ?? existing.date,
      startTime,
      endTime,
      durationMinutes: calculateMinutesBetween(startTime, endTime),
      note: input.note !== undefined ? input.note?.trim() || null : existing.note,
      updatedAt: new Date().toISOString(),
    };
    await db.guardShifts.put(updated);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.guardShifts.get(id);
    if (!existing) throw new NotFoundError(`نوبت نگهبانی با شناسه ${id} یافت نشد.`);
    await db.guardShifts.delete(id);
  },
};
