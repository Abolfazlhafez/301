/**
 * یک «اکیپ» — گروهی از نیروهای واقعی که با هم روی یک کار مشترک قرار
 * می‌گیرند (مثلاً «اکیپ گچ‌کار محمدی») و دستمزدشان به‌جای این‌که تک‌تک و
 * جداگانه محاسبه شود، به‌صورت یک مبلغ کلی به کل اکیپ پرداخت می‌شود.
 *
 * نکتهٔ کلیدی طبق نیاز صریح کاربر: تقسیم آن مبلغ کلی بین اعضای اکیپ
 * کاملاً به عهدهٔ خودشان است — کارگاه‌یار فقط «چه مبلغی، برای چه کاری، به
 * کدام اکیپ» را ثبت می‌کند (نه این‌که آن را بین اعضا سرشکن کند). یعنی اگر
 * مبلغ یک پرداخت جمعی ۱۰ میلیون تومان باشد، این یعنی کل اکیپ روی هم ۱۰
 * میلیون گرفته‌اند، نه این‌که هرکدام از اعضا ۱۰ میلیون بگیرند.
 *
 * اکیپ‌ها کاملاً مستقل از تیپ نیرو (JobType) و آیتم دستمزد فردی
 * (WageAssignment) هستند: یک نیرو می‌تواند هم عضو یک یا چند اکیپ باشد و هم
 * هم‌زمان آیتم دستمزد فردی مستقل خودش را داشته باشد.
 */
export interface WorkerGroup {
  id: string;
  /** پروژه‌ای که این اکیپ به آن تعلق دارد. */
  projectId: string;
  name: string;
  /** شناسهٔ نیروهای عضو این اکیپ (اشاره به Worker.id). */
  memberWorkerIds: string[];
  description: string | null;
  /** غیرفعال‌کردن یک اکیپ منحل‌شده بدون حذف تاریخچهٔ پرداخت‌های جمعی قبلی‌اش. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkerGroupInput {
  name: string;
  memberWorkerIds?: string[];
  description?: string | null;
}

export interface UpdateWorkerGroupInput {
  name?: string;
  memberWorkerIds?: string[];
  description?: string | null;
  isActive?: boolean;
}

/**
 * یک «پرداخت جمعی» ثبت‌شده برای یک اکیپ — یک مبلغ کلی برای یک کار مشخص در
 * یک تاریخ مشخص. این رکورد هرگز بین اعضا تقسیم نمی‌شود و به حساب/موجودی
 * فردی هیچ‌کدام از اعضا اضافه نمی‌شود؛ فقط برای این‌که سرپرست بداند «به این
 * اکیپ برای این کار چقدر پرداخت شده» نگه داشته می‌شود.
 */
export interface GroupWagePayment {
  id: string;
  projectId: string;
  groupId: string;
  /** توضیح کار انجام‌شده توسط اکیپ (مثلاً «گچ‌کاری طبقهٔ دوم»). */
  label: string;
  /** مبلغ کل قابل‌پرداخت به کل اکیپ (سرانه نیست، جمع کل است). */
  totalAmount: number;
  date: string;
  note: string | null;
  /**
   * شناسهٔ تراکنش دفتر حساب ساخته‌شده برای این پرداخت (نوع «پرداخت
   * حقوق»)، تا این پرداخت جمعی هم مثل حقوق‌های فردی در گردش مالی صندوق
   * دیده شود. با حذف این پرداخت، تراکنش دفتر حساب مرتبط هم حذف می‌شود.
   */
  cashbookEntryId: string | null;
  createdAt: string;
}

export interface CreateGroupWagePaymentInput {
  groupId: string;
  label: string;
  totalAmount: number;
  date: string;
  note?: string | null;
  /** اگر مشخص نشود، صندوق پیش‌فرض پروژهٔ فعال استفاده می‌شود. */
  fundId?: string | null;
}
