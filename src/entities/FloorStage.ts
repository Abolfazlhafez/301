/**
 * «مرحله» (Stage) — گام‌های اجرایی ساخت یک طبقه (اسکلت، دیوارچینی، تأسیسات...).
 * هر طبقهٔ جدید با ۸ مرحلهٔ پیش‌فرض seed می‌شود (رجوع کن به core/seedFloorStages.ts)
 * اما کاربر می‌تواند بعداً مرحلهٔ سفارشی هم اضافه کند.
 */

export type FloorStageStatus = "not_started" | "in_progress" | "blocked" | "completed";

export const FLOOR_STAGE_STATUSES: FloorStageStatus[] = ["not_started", "in_progress", "blocked", "completed"];

export type FloorStageProgressMode = "calculated" | "manual";

export interface FloorStage {
  id: string;
  floorId: string;
  /** کلید پایدار — برای مراحل پیش‌فرض یکی از STANDARD_STAGE_KEYS، برای مراحل سفارشی یک UUID. */
  key: string;
  title: string;
  order: number;
  weight: number;
  status: FloorStageStatus;
  progressMode: FloorStageProgressMode;
  /** فقط وقتی progressMode === 'manual' استفاده می‌شود؛ در غیر این صورت از روی Taskها محاسبه می‌شود. */
  manualProgress: number | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  /** false برای ۸ مرحلهٔ پیش‌فرض seed‌شده — این‌ها بدون تأیید صریح حذف نمی‌شوند. */
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFloorStageInput {
  floorId: string;
  title: string;
  weight?: number;
  description?: string | null;
}

export interface UpdateFloorStageInput {
  title?: string;
  order?: number;
  weight?: number;
  status?: FloorStageStatus;
  progressMode?: FloorStageProgressMode;
  manualProgress?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

/** آمار محاسبه‌شدهٔ یک مرحله (تعداد کار، وضعیت آماده‌بودن برای مرحلهٔ بعد). */
export interface FloorStageWithStats extends FloorStage {
  progress: number;
  tasksCount: number;
  openTasksCount: number;
  openIssuesCount: number;
  /** آماده برای شروع مرحلهٔ بعد؟ بر اساس Taskها/Issueهای باز محاسبه می‌شود. */
  readyForNext: boolean;
  remainingItemsCount: number;
}
