import type { Attendance, BulkAttendanceMode } from "../../entities/Attendance";

/**
 * قوانین مشترک «حضور گروهی» بین سرویس (attendanceService.bulkUpsert) و UI
 * (BulkAttendanceSheet) تا برچسب «جایگزین می‌شود» دقیقاً با رفتار واقعی سرویس یکی بماند.
 */

/** مقدار ساعتِ «پر» (رکوردهای قدیمی ممکن است undefined یا رشتهٔ خالی داشته باشند، نه فقط null). */
export function hasTime(value: string | null | undefined): boolean {
  return typeof value === "string" && value !== "";
}

/** رکورد تکراری = فیلد/فیلدهای هدفِ این حالت قبلاً پر شده‌اند. */
export function isBulkDuplicate(existing: Attendance | null | undefined, mode: BulkAttendanceMode): boolean {
  if (!existing) return false;
  if (mode === "in") return hasTime(existing.checkIn);
  if (mode === "out") return hasTime(existing.checkOut);
  return hasTime(existing.checkIn) || hasTime(existing.checkOut);
}

export type BulkRowStatus = "present" | "inOnly" | "none";

/** وضعیت نمایشی یک نفر در یک تاریخ: حاضر (ورود+خروج)، ورود بدون خروج، ثبت‌نشده. */
export function getBulkRowStatus(existing: Attendance | null | undefined): BulkRowStatus {
  if (existing?.checkIn && existing.checkOut) return "present";
  if (existing?.checkIn) return "inOnly";
  return "none";
}
