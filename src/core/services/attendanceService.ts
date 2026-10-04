import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { isValidTimeFormat } from "../payroll";
import { workerService } from "./workerService";
import { settingsService } from "./settingsService";
import { projectService } from "./projectService";
import { isBulkDuplicate } from "../utils/bulkAttendanceRules";
import type {
  Attendance,
  BulkAttendanceEntry,
  BulkAttendanceOptions,
  BulkAttendanceRejectReason,
  BulkAttendanceResult,
  UpsertAttendanceInput,
} from "../../entities/Attendance";

export interface ListAttendancesFilter {
  workerId?: string;
  date?: string;
  from?: string;
  to?: string;
}

function matchesFilter(a: Attendance, filter?: ListAttendancesFilter): boolean {
  if (!filter) return true;
  if (filter.workerId && a.workerId !== filter.workerId) return false;
  if (filter.date && a.date !== filter.date) return false;
  if (filter.from && a.date < filter.from) return false;
  if (filter.to && a.date > filter.to) return false;
  return true;
}

export interface SuggestedAttendanceTimes {
  checkIn: string | null;
  checkOut: string | null;
  /** منبع پیشنهاد: شیفت ثابت نیرو، آخرین حضور ثبت‌شده، ساعت پیش‌فرض سراسری تنظیمات، یا اصلاً چیزی موجود نیست. */
  source: "default-shift" | "last-attendance" | "global-default" | "none";
}

export const attendanceService = {
  async list(filter?: ListAttendancesFilter): Promise<Attendance[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const all = await db.attendances.where({ projectId: activeProjectId }).toArray();
    return all.filter((a) => matchesFilter(a, filter)).sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  async getById(id: string): Promise<Attendance | null> {
    return (await db.attendances.get(id)) ?? null;
  },

  async findByWorkerAndDate(workerId: string, date: string): Promise<Attendance | null> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const match = await db.attendances.where({ projectId: activeProjectId, workerId, date }).first();
    return match ?? null;
  },

  async findByDate(date: string): Promise<Attendance[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    return db.attendances.where({ projectId: activeProjectId, date }).toArray();
  },

  /**
   * پیشنهاد ساعت ورود/خروج برای پرشدن خودکار فرم ثبت حضور، تا کاربر مجبور نباشد
   * هر روز از صفر تایپ کند:
   * ۱) اگر نیرو شیفت ثابت (defaultCheckIn/defaultCheckOut) در پروفایلش تنظیم کرده، همان اولویت دارد.
   * ۲) در غیر این‌صورت، آخرین رکورد حضورِ ثبت‌شده برای همین نیرو (صرف‌نظر از تاریخ) پیشنهاد می‌شود.
   * ۳) هر طرفی (ورود یا خروج) که از دو مرحلهٔ بالا همچنان خالی مانده باشد
   *    (مثلاً چون رکورد قبلی فقط ورود داشته)، از ساعت پیش‌فرض سراسری
   *    تنظیمات پر می‌شود — تا هیچ‌وقت «ثبت سریع» فقط نیمی از حضور را ثبت
   *    نکند. اگر پیش‌فرض سراسری هم موجود نباشد، مقدار خالی می‌ماند تا
   *    کاربر مثل قبل دستی وارد کند.
   */
  async getSuggestedTimes(workerId: string): Promise<SuggestedAttendanceTimes> {
    if (!workerId) return { checkIn: null, checkOut: null, source: "none" };

    const worker = await workerService.findByIdOrNull(workerId);

    let checkIn: string | null = null;
    let checkOut: string | null = null;
    let source: SuggestedAttendanceTimes["source"] = "none";

    if (worker?.defaultCheckIn || worker?.defaultCheckOut) {
      checkIn = worker.defaultCheckIn ?? null;
      checkOut = worker.defaultCheckOut ?? null;
      source = "default-shift";
    } else {
      // عمداً محدود به پروژهٔ فعال نشده: عادت ساعت ورود/خروج یک نیرو یک
      // ویژگی شخصی اوست، نه چیزی که با پروژه عوض شود؛ پس حتی اگر آخرین
      // سابقهٔ او در پروژهٔ دیگری ثبت شده باشد، همچنان بهترین حدس موجود است.
      const workerAttendances = await db.attendances.where({ workerId }).toArray();
      const lastWithTimes = workerAttendances
        .filter((a) => a.checkIn || a.checkOut)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1))[0];

      if (lastWithTimes) {
        checkIn = lastWithTimes.checkIn ?? null;
        checkOut = lastWithTimes.checkOut ?? null;
        source = "last-attendance";
      }
    }

    // نکتهٔ مهم دربارهٔ باگ قبلی: این پر کردنِ شکاف قبلاً فقط زمانی اجرا
    // می‌شد که *هیچ* سابقه‌ای (نه شیفت ثابت، نه حضور قبلی) برای نیرو وجود
    // نداشت. اما اگر رکورد قبلیِ خودِ نیرو هم فقط «ورود» داشت (مثلاً یک روز
    // که خروج ثبت نشده بود)، checkOut برای همیشه null می‌ماند و «ثبت سریع»
    // هیچ‌وقت خروج را ثبت نمی‌کرد. حالا این پر کردن روی هر دو حالت (شیفت
    // ثابت ناقص یا سابقهٔ ناقص) هم اعمال می‌شود، نه فقط وقتی سابقه‌ای نیست.
    if (!checkIn || !checkOut) {
      const settings = await settingsService.get();
      checkIn = checkIn ?? settings.quickCheckInDefaultTime ?? null;
      checkOut = checkOut ?? settings.quickCheckOutDefaultTime ?? null;
      if (source === "none" && checkIn) source = "global-default";
    }

    return { checkIn, checkOut, source };
  },

  /**
   * ثبت حضور: اگر برای آن نیرو در آن تاریخ رکوردی وجود داشته باشد، به‌روزرسانی می‌شود (Upsert).
   */
  async upsert(input: UpsertAttendanceInput): Promise<Attendance> {
    if (!input.workerId) throw new ValidationError("شناسه نیرو الزامی است.");
    if (!input.date) throw new ValidationError("تاریخ الزامی است.");

    const worker = await workerService.findByIdOrNull(input.workerId);
    if (!worker) throw new NotFoundError(`نیرویی با شناسه ${input.workerId} یافت نشد.`);

    if (input.checkIn && input.checkOut) {
      if (!isValidTimeFormat(input.checkIn) || !isValidTimeFormat(input.checkOut)) {
        throw new ValidationError("فرمت ساعت باید HH:mm باشد.");
      }
    }

    const existing = await this.findByWorkerAndDate(input.workerId, input.date);
    const now = new Date().toISOString();

    if (existing) {
      const updated: Attendance = {
        ...existing,
        checkIn: input.checkIn !== undefined ? input.checkIn : existing.checkIn,
        checkOut: input.checkOut !== undefined ? input.checkOut : existing.checkOut,
        note: input.note !== undefined ? input.note : existing.note,
        updatedAt: now,
      };
      await db.attendances.put(updated);
      return updated;
    }

    const created: Attendance = {
      id: randomUUID(),
      projectId: await projectService.getOrCreateActiveProjectId(),
      workerId: input.workerId,
      date: input.date,
      checkIn: input.checkIn ?? null,
      checkOut: input.checkOut ?? null,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await db.attendances.add(created);
    return created;
  },

  /**
   * ثبت گروهیِ حضور برای چند نیرو در یک تراکنش: یا همه ثبت می‌شوند یا هیچ‌کدام
   * (خطای غیرمنتظره در نفر وسط ⇒ rollback کامل). هر نفر از همان `upsert` رد می‌شود
   * تا رفتار برای breakTimes/timeLosses (وصل به attendanceId) مثل قبل بماند.
   *
   * ردهای «نرم» (نیروی نامعتبر/غیرفعال، ساعت نامعتبر، خروج بدون ورود، رکورد تکراری)
   * خطا پرتاب نمی‌کنند؛ در `rejected` می‌آیند و بقیه ثبت می‌شوند.
   *  - حالت «ورود»: فقط checkIn؛ checkOut موجود دست نمی‌خورد.
   *  - حالت «خروج»: فقط checkOut؛ بدون رکورد دارای ورود ⇒ رد «no-check-in».
   *  - حالت «هر دو»: هر دو فیلد.
   * خروج‌قبل‌از‌ورود عمداً رد نمی‌شود: منطق فعلی فرم حضور فقط فرمت را می‌سنجد و
   * شیفت شبانه را مجاز می‌داند (calculateMinutesBetween روز بعد را فرض می‌کند).
   */
  async bulkUpsert(entries: BulkAttendanceEntry[], options: BulkAttendanceOptions): Promise<BulkAttendanceResult> {
    const { mode, date } = options;
    const onExisting = options.onExisting ?? "reject";
    const replaceIds = new Set(options.replaceWorkerIds ?? []);
    if (!date) throw new ValidationError("تاریخ الزامی است.");

    return db.transaction("rw", db.attendances, db.settings, db.projects, async () => {
      const activeProjectId = await projectService.getOrCreateActiveProjectId();
      // فقط نیروهای فعالِ همین پروژه (ایزوله‌سازی پروژه).
      const allowed = new Set(
        (await workerService.list({ isActive: true, projectId: activeProjectId })).map((w) => w.id)
      );

      const result: BulkAttendanceResult = { saved: [], rejected: [] };
      const seen = new Set<string>();
      const reject = (workerId: string, reason: BulkAttendanceRejectReason) =>
        result.rejected.push({ workerId, reason });

      for (const entry of entries) {
        if (seen.has(entry.workerId)) continue; // تکرار یک نفر در ورودی
        seen.add(entry.workerId);

        const worker = await workerService.findByIdOrNull(entry.workerId);
        if (!worker) {
          reject(entry.workerId, "worker-not-found");
          continue;
        }
        if (!worker.isActive || !allowed.has(worker.id)) {
          reject(entry.workerId, "worker-inactive");
          continue;
        }

        const wantIn = mode === "in" || mode === "both";
        const wantOut = mode === "out" || mode === "both";
        if ((wantIn && !(entry.checkIn && isValidTimeFormat(entry.checkIn))) ||
            (wantOut && !(entry.checkOut && isValidTimeFormat(entry.checkOut)))) {
          reject(entry.workerId, "invalid-time");
          continue;
        }

        const existing = await this.findByWorkerAndDate(entry.workerId, date);

        if (mode === "out" && !existing?.checkIn) {
          reject(entry.workerId, "no-check-in");
          continue;
        }
        const duplicate = isBulkDuplicate(existing, mode);
        if (duplicate && onExisting !== "replace" && !replaceIds.has(entry.workerId)) {
          reject(entry.workerId, "already-registered");
          continue;
        }

        const saved = await this.upsert({
          workerId: entry.workerId,
          date,
          // undefined = «دست نزن» (upsert فقط مقدار undefined را حفظ می‌کند).
          checkIn: wantIn ? entry.checkIn : undefined,
          checkOut: wantOut ? entry.checkOut : undefined,
        });
        result.saved.push({ workerId: entry.workerId, attendanceId: saved.id, previous: existing });
      }
      return result;
    });
  },

  /**
   * واگرد یک ثبت گروهی (آنچه bulkUpsert برگرداند):
   *  - رکورد تازه‌ساخته ⇒ حذف، ولی فقط اگر هنوز breakTime/timeLoss وابسته ندارد؛
   *  - رکورد عوض‌شده ⇒ برگرداندن checkIn/checkOut/note/updatedAt قبلی (وابسته‌ها دست‌نخورده).
   * رکوردی که در این فاصله حذف شده باشد نادیده گرفته می‌شود. تعداد واگردشده را برمی‌گرداند.
   */
  async undoBulk(saved: BulkAttendanceResult["saved"]): Promise<number> {
    return db.transaction("rw", db.attendances, db.breakTimes, db.timeLosses, async () => {
      let undone = 0;
      for (const item of saved) {
        const current = await db.attendances.get(item.attendanceId);
        if (!current) continue;
        if (item.previous === null) {
          const hasBreaks = (await db.breakTimes.where({ attendanceId: current.id }).count()) > 0;
          const hasLosses = (await db.timeLosses.where({ attendanceId: current.id }).count()) > 0;
          if (hasBreaks || hasLosses) continue;
          await db.attendances.delete(current.id);
        } else {
          await db.attendances.put({
            ...current,
            checkIn: item.previous.checkIn,
            checkOut: item.previous.checkOut,
            note: item.previous.note,
            updatedAt: item.previous.updatedAt,
          });
        }
        undone += 1;
      }
      return undone;
    });
  },

  async remove(id: string): Promise<void> {
    const existing = await db.attendances.get(id);
    if (!existing) throw new NotFoundError(`رکورد حضور با شناسه ${id} یافت نشد.`);
    await db.attendances.delete(id);
    // پاک‌سازی رکوردهای وابسته (اتلاف وقت و استراحت مربوط به این روز)
    await db.timeLosses.where({ attendanceId: id }).delete();
    await db.breakTimes.where({ attendanceId: id }).delete();
  },
};
