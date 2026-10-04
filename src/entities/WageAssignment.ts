/**
 * یک «آیتم دستمزد» برای یک نیروی واقعی — پیوند بین یک نیرو، یک روش محاسبه
 * (WageMethod)، و مقادیر واقعی متغیرهای آن روش برای همان نیرو (مثلاً نرخ هر
 * متر، ضریب ارتفاع). طبق نیاز صریح کاربر، «تیپ نیرو» و «خود نیرو» دو مفهوم
 * جدا هستند: چند نیروی با تیپ یکسان می‌توانند روش پرداخت متفاوت داشته
 * باشند، و حتی یک نیرو می‌تواند چند آیتم دستمزد هم‌زمان داشته باشد (مثلاً
 * «دیوارچینی → مترمربع» و «کار متفرقه → روزمزد» برای همان بنا).
 */
export interface WageAssignment {
  id: string;
  workerId: string;
  /** شناسهٔ روش محاسبه (WageMethod.id) که این آیتم از آن استفاده می‌کند. */
  wageMethodId: string;
  /** عنوان این آیتم دستمزد برای تمایز از سایر آیتم‌های همان نیرو (مثلاً «دیوارچینی طبقه دوم»). */
  label: string;
  /** مقادیر ثابت این نیرو برای متغیرهای فرمول (مثلاً نرخ هر متر) — این مقادیر پیش‌فرضِ محاسبات بعدی هستند، ولی هر بار محاسبهٔ واقعی می‌تواند آن‌ها را override کند. */
  defaultVariableValues: Record<string, number>;
  /** آیا این آیتم دستمزد فعال است (برای غیرفعال‌کردن موقت بدون حذف کامل). */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWageAssignmentInput {
  workerId: string;
  wageMethodId: string;
  label: string;
  defaultVariableValues?: Record<string, number>;
}

export interface UpdateWageAssignmentInput {
  wageMethodId?: string;
  label?: string;
  defaultVariableValues?: Record<string, number>;
  isActive?: boolean;
}

/**
 * یک محاسبهٔ واقعی و ثبت‌شدهٔ دستمزد — خروجی نهایی وقتی کاربر برای یک آیتم
 * دستمزد، مقادیر واقعی (مثلاً «۸۰ متر دیوار») را وارد و محاسبه را تأیید
 * می‌کند. این رکورد مستقل نگه داشته می‌شود تا سابقهٔ محاسبات هر نیرو قابل
 * مرور و ویرایش باشد، نه این‌که هر بار فقط یک عدد نهایی بدون جزئیات ثبت شود.
 */
export interface WageCalculationRecord {
  id: string;
  workerId: string;
  wageAssignmentId: string;
  date: string;
  /** مقادیر واقعی متغیرها در همین محاسبه (ممکن است با defaultVariableValues آیتم دستمزد فرق داشته باشد). */
  variableValues: Record<string, number>;
  /** مبلغ نهایی محاسبه‌شده. */
  payableAmount: number;
  /** رشتهٔ فرمول قابل‌نمایش، برای این‌که حتی اگر بعداً خودِ WageMethod ویرایش/حذف شود، سابقهٔ این محاسبه همچنان قابل‌فهم بماند. */
  formulaSnapshot: string;
  note: string | null;
  createdAt: string;
}

export interface CreateWageCalculationInput {
  workerId: string;
  wageAssignmentId: string;
  date: string;
  variableValues: Record<string, number>;
  note?: string | null;
}
