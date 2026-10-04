/**
 * غیبت مجاز: یک روز کامل که نیرو سر کار نیامده ولی این غیبت با اجازه/توافق
 * بوده (مثلاً مرخصی استعلاجی، مرخصی شخصی، مأموریت). برخلاف TimeLoss (که به
 * یک رکورد Attendance موجود وصل است و برای از دست دادن بخشی از روز کاری
 * است)، OptionalLeave کاملاً مستقل از Attendance است — چون اصلاً حضوری در
 * کار نبوده که به آن وصل شود.
 */
export type OptionalLeaveType = "sick" | "personal" | "mission" | "unpaid" | "other";

export const OPTIONAL_LEAVE_TYPE_LABELS: Record<OptionalLeaveType, string> = {
  sick: "مرخصی استعلاجی",
  personal: "مرخصی شخصی",
  mission: "مأموریت",
  unpaid: "مرخصی بدون حقوق",
  other: "سایر",
};

export interface OptionalLeave {
  id: string;
  /** پروژه‌ای که این مرخصی برای آن ثبت شده (نیرو می‌تواند در چند پروژه فعال باشد). */
  projectId: string;
  workerId: string;
  date: string;
  type: OptionalLeaveType;
  /** آیا این روز برای محاسبهٔ حقوق، مثل یک روز کاری عادی حساب می‌شود (مثلاً مرخصی استعلاجی با حقوق). */
  isPaid: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertOptionalLeaveInput {
  workerId: string;
  date: string;
  type: OptionalLeaveType;
  isPaid: boolean;
  note?: string | null;
}
