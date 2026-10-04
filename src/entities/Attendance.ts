export interface Attendance {
  id: string;
  /** پروژه‌ای که این حضور برای آن ثبت شده (یک نیرو می‌تواند در چند پروژه فعال باشد، پس این را نمی‌شود فقط از workerId استنتاج کرد). */
  projectId: string;
  workerId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAttendanceInput {
  workerId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  note?: string | null;
}

/** حالت ثبت گروهی: فقط ورود، فقط خروج، یا هر دو. */
export type BulkAttendanceMode = "in" | "out" | "both";

export interface BulkAttendanceEntry {
  workerId: string;
  /** ساعت اختصاصی همین نفر؛ در حالت «ورود» فقط checkIn و در «خروج» فقط checkOut خوانده می‌شود. */
  checkIn?: string | null;
  checkOut?: string | null;
}

/** دلیل ردشدن یک نفر در ثبت گروهی (برای نمایش با i18n در UI). */
export type BulkAttendanceRejectReason =
  | "worker-not-found"
  | "worker-inactive"
  | "invalid-time"
  | "no-check-in"
  | "already-registered";

export interface BulkAttendanceOptions {
  mode: BulkAttendanceMode;
  date: string;
  /** رفتار با رکورد تکراری (فیلد/فیلدهای هدف قبلاً پر است): جایگزین شود یا رد شود. پیش‌فرض: رد. */
  onExisting?: "replace" | "reject";
  /**
   * فقط برای این نفرها جایگزینی مجاز است (حتی وقتی onExisting «reject» است). UI فقط افرادی را
   * که کاربر صریحاً تیک زده می‌فرستد، تا رکوردی که بین نمایش و ثبت پر شده بی‌صدا بازنویسی نشود.
   */
  replaceWorkerIds?: string[];
}

export interface BulkAttendanceSavedItem {
  workerId: string;
  attendanceId: string;
  /** وضعیت قبلی رکورد؛ null یعنی رکورد تازه ساخته شد. برای واگرد. */
  previous: Attendance | null;
}

export interface BulkAttendanceResult {
  saved: BulkAttendanceSavedItem[];
  rejected: { workerId: string; reason: BulkAttendanceRejectReason }[];
}
