import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { calculateMinutesBetween, isValidTimeFormat } from "../payroll";
import { settingsService } from "./settingsService";
import type { BreakTime, BreakTimeType, CreateBreakTimeInput } from "../../entities/BreakTime";

export interface SuggestedBreakTime {
  startTime: string | null;
  endTime: string | null;
  /** منبع پیشنهاد: آخرین استراحتِ همین نوع که خودِ کاربر برای همین نیرو ثبت کرده، یا هیچ‌چیز. */
  source: "last-break" | "none";
}

export interface QuickBreakTimeResult {
  startTime: string | null;
  endTime: string | null;
  /**
   * منبع ساعت پیشنهادی برای دکمهٔ «سریع»:
   *  - "settings-default": ساعت دستیِ تنظیم‌شده در تنظیمات (اولویت اول)
   *  - "last-break": آخرین ثبت واقعی همین نوع استراحت برای همین نیرو
   *  - "none": نه تنظیم دستی موجود است و نه سابقه‌ای — کاربر باید دستی وارد کند
   */
  source: "settings-default" | "last-break" | "none";
}

export const breakTimeService = {
  async list(filter?: { workerId?: string; attendanceId?: string }): Promise<BreakTime[]> {
    let items = await db.breakTimes.toArray();
    if (filter?.workerId) items = items.filter((b) => b.workerId === filter.workerId);
    if (filter?.attendanceId) items = items.filter((b) => b.attendanceId === filter.attendanceId);
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async findByAttendanceId(attendanceId: string): Promise<BreakTime[]> {
    return db.breakTimes.where({ attendanceId }).toArray();
  },

  /**
   * پیشنهاد ساعت شروع/پایان برای «ثبت سریع» یک نوع استراحت مشخص (صبحانه/ناهار)
   * برای یک نیرو — دقیقاً همان فلسفهٔ attendanceService.getSuggestedTimes: هرگز
   * عدد ثابت حدسی برنمی‌گرداند، فقط آخرین رکورد واقعی همان نوع استراحت که خودِ
   * کاربر قبلاً برای همین نیرو ثبت کرده را پیشنهاد می‌دهد. اگر چنین سابقه‌ای
   * نبود، «none» برمی‌گردد تا کاربر مجبور شود یک‌بار دستی وارد کند.
   */
  async getSuggestedTimes(workerId: string, type: BreakTimeType): Promise<SuggestedBreakTime> {
    if (!workerId) return { startTime: null, endTime: null, source: "none" };

    const workerBreaks = await db.breakTimes.where({ workerId }).toArray();
    const lastOfType = workerBreaks
      .filter((b) => b.type === type)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

    if (lastOfType) {
      return { startTime: lastOfType.startTime, endTime: lastOfType.endTime, source: "last-break" };
    }
    return { startTime: null, endTime: null, source: "none" };
  },

  /**
   * ساعت مورد استفادهٔ دکمهٔ «صبحانه سریع» / «ناهار سریع» را با این
   * اولویت تعیین می‌کند:
   *  ۱) ساعت پیش‌فرض دستی تنظیم‌شده در تنظیمات برای این نوع استراحت.
   *  ۲) آخرین ثبت واقعی همین نوع استراحت برای همین نیرو (سابقه).
   *  ۳) هیچ‌کدام — به UI گفته می‌شود خودش فرم ثبت دستی را باز کند.
   * توجه: برای نوع «سایر» همیشه «none» برمی‌گردد چون تنظیم پیش‌فرض فقط
   * برای صبحانه/ناهار معنا دارد.
   */
  async getQuickBreakTime(workerId: string, type: BreakTimeType): Promise<QuickBreakTimeResult> {
    if (type === "breakfast" || type === "lunch") {
      const settings = await settingsService.get();
      const start = type === "breakfast" ? settings.quickBreakfastDefaultStartTime : settings.quickLunchDefaultStartTime;
      const end = type === "breakfast" ? settings.quickBreakfastDefaultEndTime : settings.quickLunchDefaultEndTime;
      if (start && end) {
        return { startTime: start, endTime: end, source: "settings-default" };
      }
    }

    const suggestion = await this.getSuggestedTimes(workerId, type);
    if (suggestion.startTime && suggestion.endTime) {
      return { startTime: suggestion.startTime, endTime: suggestion.endTime, source: "last-break" };
    }
    return { startTime: null, endTime: null, source: "none" };
  },

  async create(input: CreateBreakTimeInput): Promise<BreakTime> {
    if (!isValidTimeFormat(input.startTime) || !isValidTimeFormat(input.endTime)) {
      throw new ValidationError("فرمت ساعت باید HH:mm باشد.");
    }

    const attendance = await db.attendances.get(input.attendanceId);
    if (!attendance) throw new NotFoundError(`رکورد حضور با شناسه ${input.attendanceId} یافت نشد.`);

    const duration = calculateMinutesBetween(input.startTime, input.endTime);
    if (duration <= 0) throw new ValidationError("ساعت پایان باید بعد از ساعت شروع باشد.");

    const now = new Date().toISOString();
    const created: BreakTime = {
      id: randomUUID(),
      workerId: input.workerId,
      attendanceId: input.attendanceId,
      type: input.type,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: duration,
      note: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    await db.breakTimes.add(created);
    return created;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.breakTimes.get(id);
    if (!existing) throw new NotFoundError(`رکورد استراحت با شناسه ${id} یافت نشد.`);
    await db.breakTimes.delete(id);
  },
};
