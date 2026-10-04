export type GuardDutyRateType = "hourly" | "shift";

export interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  /** شماره تماس اختیاری است؛ ممکن است رشته خالی/نال باشد. */
  phoneNumber: string | null;
  /** شماره کارت بانکی اختیاری (قدیمی/سازگاری به‌عقب)، برای کپی سریع هنگام واریز حقوق. */
  cardNumber: string | null;
  /** شماره‌های کارت بانکی (حداکثر ۳ عدد). cardNumbers[0] همیشه با cardNumber هماهنگ نگه داشته می‌شود. */
  cardNumbers: string[];
  /** شماره‌های شبا (حداکثر ۲ عدد، بدون پیشوند IR). */
  shebaNumbers: string[];
  position: string;
  /** پیوند اختیاری به یک تیپ نیرو (JobType) — اگر تنظیم شود، هنگام افزودن آیتم دستمزد، روش‌های پیشنهادی همان شغل نمایش داده می‌شود. برای نیروهایی که فقط عنوان آزاد دارند (بدون تیپ مشخص)، null باقی می‌ماند. */
  jobTypeId: string | null;
  dailyBaseSalary: number;
  description: string | null;
  /** شناسه عکس پروفایل این نیرو (اشاره به یک رکورد Photo با relatedType='worker-avatar')؛ در صورت نبود، null. */
  avatarPhotoId: string | null;

  // --- شیفت پیش‌فرض (برای پرشدن خودکار ساعت ورود/خروج هنگام ثبت حضور روزانه) ---
  /** ساعت ورود ثابت این نیرو (فرمت HH:mm)؛ اگر تنظیم نشده باشد null است. */
  defaultCheckIn: string | null;
  /** ساعت خروج ثابت این نیرو (فرمت HH:mm)؛ اگر تنظیم نشده باشد null است. */
  defaultCheckOut: string | null;

  // --- نگهبانی ---
  /** آیا امکان ثبت نوبت نگهبانی برای این نیرو فعال است. */
  guardDutyEnabled: boolean;
  /** واحد محاسبه دستمزد نگهبانی: ساعتی یا بر اساس هر نوبت. */
  guardDutyRateType: GuardDutyRateType;
  /** نرخ نگهبانی (تومان به ازای ساعت، یا تومان به ازای هر نوبت، بسته به guardDutyRateType). */
  guardDutyRate: number;
  /** اگر true باشد، دستمزد نگهبانی در محاسبه مانده حساب/تسویه با حقوق عادی ادغام می‌شود. */
  guardDutyMergeWithRegularPay: boolean;

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkerInput {
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  cardNumber?: string | null;
  cardNumbers?: string[];
  shebaNumbers?: string[];
  position: string;
  jobTypeId?: string | null;
  dailyBaseSalary: number;
  description?: string | null;
  defaultCheckIn?: string | null;
  defaultCheckOut?: string | null;
  guardDutyEnabled?: boolean;
  guardDutyRateType?: GuardDutyRateType;
  guardDutyRate?: number;
  guardDutyMergeWithRegularPay?: boolean;
}

export interface UpdateWorkerInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
  cardNumber?: string | null;
  cardNumbers?: string[];
  shebaNumbers?: string[];
  position?: string;
  jobTypeId?: string | null;
  dailyBaseSalary?: number;
  description?: string | null;
  isActive?: boolean;
  avatarPhotoId?: string | null;
  defaultCheckIn?: string | null;
  defaultCheckOut?: string | null;
  guardDutyEnabled?: boolean;
  guardDutyRateType?: GuardDutyRateType;
  guardDutyRate?: number;
  guardDutyMergeWithRegularPay?: boolean;
}
