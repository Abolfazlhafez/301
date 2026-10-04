export type ActivityPriority = "low" | "medium" | "high";

export interface FutureActivity {
  id: string;
  /** پروژه‌ای که این فعالیت به آن تعلق دارد. */
  projectId: string;
  /** برای فعالیت‌های تکرارشونده، شناسه مشترک بین همه رخدادهای یک سری؛ برای فعالیت تکی، null. */
  seriesId: string | null;
  date: string;
  /** تاریخ پایان برای فعالیت‌های چندروزه (نمای گانت)؛ اگر فعالیت تک‌روزه باشد null است و برابر با date در نظر گرفته می‌شود. */
  endDate: string | null;
  /** ساعت انجام فعالیت (HH:mm)، اختیاری. */
  time: string | null;
  title: string;
  description: string | null;
  priority: ActivityPriority;
  isCompleted: boolean;
  /** ارتباط اختیاری با یک نیروی مشخص؛ در صورت نبود، فعالیت عمومی/کارگاهی است. */
  workerId: string | null;
  floorId?: string | null;
  stageId?: string | null;
  taskId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurrenceInput {
  frequency: "daily" | "weekly" | "monthly";
  /** فاصله تکرار (مثلاً هر ۲ هفته یک‌بار)؛ حداقل ۱. */
  interval: number;
  /** تعداد کل رخدادهایی که باید ساخته شوند (شامل خود رخداد اول)، حداکثر ۶۰. */
  occurrences: number;
}

export interface CreateFutureActivityInput {
  date: string;
  /** تاریخ پایان اختیاری؛ اگر داده شود باید >= date باشد. برای فعالیت‌های تکرارشونده، همین بازهٔ مدت روی هر رخداد اعمال می‌شود. */
  endDate?: string | null;
  time?: string | null;
  title: string;
  description?: string | null;
  priority: ActivityPriority;
  workerId?: string | null;
  floorId?: string | null;
  stageId?: string | null;
  taskId?: string | null;
  recurrence?: RecurrenceInput | null;
}

export interface UpdateFutureActivityInput {
  date?: string;
  endDate?: string | null;
  time?: string | null;
  title?: string;
  description?: string | null;
  priority?: ActivityPriority;
  isCompleted?: boolean;
  workerId?: string | null;
  floorId?: string | null;
  stageId?: string | null;
  taskId?: string | null;
}
