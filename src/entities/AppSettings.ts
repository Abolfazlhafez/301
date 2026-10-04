/**
 * قالب ساعت «حضور گروهی» (نام + ساعت ورود + ساعت خروج). سراسری برای کل اپ
 * (نه هر پروژه) و داخل رکورد تنظیمات نگه‌داری می‌شود تا با بکاپ محلی/ابری بیاید.
 */
export interface AttendanceTimeTemplate {
  id: string;
  name: string;
  /** HH:mm */
  checkIn: string;
  /** HH:mm */
  checkOut: string;
}

/** سقف تعداد قالب‌های ساعت حضور گروهی. */
export const MAX_ATTENDANCE_TIME_TEMPLATES = 10;

export interface AppSettings {
  standardWorkHoursPerDay: number;
  updatedAt: string;

  // --- تنظیمات بکاپ خودکار دوره‌ای ---
  // آیا بکاپ‌گیری خودکار فعال است.
  autoBackupEnabled: boolean;
  // فاصله زمانی بین دو بکاپ خودکار، بر حسب ساعت (مثلاً ۲۴ برای روزانه، ۱۶۸ برای هفتگی).
  autoBackupIntervalHours: number;
  // حداکثر تعداد نسخه‌های بکاپ خودکار که نگه داشته می‌شود؛ قدیمی‌ترها به‌صورت خودکار حذف می‌شوند.
  autoBackupMaxVersions: number;
  // زمان آخرین بکاپ خودکار موفق (ISO string)؛ برای تشخیص زمان اجرای بعدی استفاده می‌شود.
  lastAutoBackupAt?: string;
  // اگر آخرین تلاش برای بکاپ خودکار (چه دوره‌ای، چه دستی از دکمهٔ «همین حالا»)
  // با خطا مواجه شده باشد، پیام و زمان آن این‌جا ذخیره می‌شود تا در تنظیمات
  // نمایش داده شود — قبلاً این خطاها کاملاً بی‌صدا catch می‌شدند و کاربر تا
  // وقتی خودش نمی‌رفت بازیابی را امتحان کند، هرگز نمی‌فهمید بکاپ‌گیری خودکار
  // مدت‌هاست شکست می‌خورَد. با موفقیت‌آمیز بودن بکاپ بعدی، این دو فیلد
  // پاک می‌شوند (رجوع کن به markAutoBackupDone/markAutoBackupError).
  lastAutoBackupErrorAt?: string;
  lastAutoBackupErrorMessage?: string;

  // --- تنظیمات نوتیفیکیشن یادآوری فعالیت‌های آینده ---
  // آیا یادآوری فعالیت‌های آینده با نوتیفیکیشن محلی دستگاه فعال است.
  activityNotificationsEnabled: boolean;

  // --- اطلاعات پروژه (برای سربرگ گزارش روزانه/PDF و گزارش کار) ---
  // نام پروژه/کارگاه؛ در صورت خالی بودن در PDF نمایش داده نمی‌شود.
  projectName: string;
  // نام سرپرست/ناظر کارگاه؛ در صورت خالی بودن در PDF نمایش داده نمی‌شود.
  supervisorName: string;
  // محل/آدرس پروژه؛ در صورت خالی بودن در قالب گزارش کار نمایش داده نمی‌شود.
  projectLocation: string;

  // --- تنظیمات «ثبت حضور سریع» ---
  // ساعت پیش‌فرض سراسری برای ورود و خروج در ثبت حضور سریع (فرمت HH:mm،
  // مثلاً "08:00" و "17:00"). این مقادیر فقط زمانی استفاده می‌شوند که برای
  // یک نیرو نه شیفت ثابت اختصاصی و نه سابقهٔ حضور قبلی موجود باشد (رجوع کن
  // به getSuggestedTimes در attendanceService) — یعنی هرگز جایگزین هوشمندی
  // موجود بر اساس سابقهٔ خودِ نیرو نمی‌شوند، فقط یک راه‌حل پشتیبان برای
  // اولین‌بار هستند تا دکمهٔ «ثبت سریع» هیچ‌وقت بدون نتیجه نماند.
  //
  // نکته: قبلاً فقط quickCheckInDefaultTime وجود داشت و ساعت خروج در این
  // حالت همیشه خالی می‌ماند — یعنی «ثبت سریع» برای نیروهای بدون سابقه فقط
  // ورود را ثبت می‌کرد و خروج هرگز ثبت نمی‌شد. quickCheckOutDefaultTime
  // دقیقاً همین شکاف را پر می‌کند.
  quickCheckInDefaultTime: string;
  quickCheckOutDefaultTime: string;

  // --- تنظیمات «صبحانه سریع» / «ناهار سریع» ---
  // بازهٔ ساعت پیش‌فرض سراسری برای هر یک از این دو دکمه (فرمت HH:mm).
  // چون هر استراحت یک بازه (شروع تا پایان) است، برای هرکدام دو فیلد
  // شروع/پایان لازم است. این مقادیر برخلاف quickCheckInDefaultTime
  // کاملاً اختیاری‌اند (می‌توانند null باشند). اولویت استفاده در دکمهٔ
  // «سریع»:
  //  ۱) اگر این بازهٔ دستی این‌جا تنظیم شده باشد، همیشه همین استفاده می‌شود.
  //  ۲) وگرنه، آخرین ثبتِ واقعیِ همین نوع استراحت برای همین نیرو (سابقه).
  //  ۳) اگر هیچ‌کدام نبود، دیگر خطا داده نمی‌شود؛ فرم ثبت دستی باز می‌شود
  //     تا کاربر خودش وارد کند.
  quickBreakfastDefaultStartTime: string | null;
  quickBreakfastDefaultEndTime: string | null;
  quickLunchDefaultStartTime: string | null;
  quickLunchDefaultEndTime: string | null;

  // --- تنظیمات بکاپ ابری اختیاری (Supabase) ---
  // برنامه کاملاً آفلاین باقی می‌ماند؛ این فقط یک «آینهٔ» اضافی و اختیاری
  // روی ابر است — اگر خاموش یا بدون اتصال باشد، هیچ قابلیتی از برنامه
  // مختل نمی‌شود. آدرس/کلید مخصوص حساب هر کاربر است، پس هرگز در کد
  // هاردکد نمی‌شود؛ کاربر خودش از صفحهٔ تنظیمات وارد می‌کند.
  cloudBackupEnabled: boolean;
  // آدرس پروژهٔ Supabase کاربر (مثل https://xxxxx.supabase.co).
  cloudBackupSupabaseUrl: string;
  // کلید publishable (سمت کلاینت) پروژهٔ Supabase کاربر — نه کلید secret.
  cloudBackupSupabaseAnonKey: string;
  // یک شناسهٔ تصادفی و پایدار مخصوص همین نصب برنامه، برای تفکیک ردیف
  // بکاپ این دستگاه از دستگاه‌های دیگری که شاید از همان پروژهٔ Supabase
  // استفاده کنند (مثلاً چند گوشی یک کارگاه).
  cloudBackupDeviceId: string;
  // فاصلهٔ زمانی بین دو بکاپ ابری، بر حسب ساعت (پیش‌فرض ۲۴).
  cloudBackupIntervalHours: number;
  // زمان آخرین بکاپ ابری موفق (ISO string).
  lastCloudBackupAt?: string;
  // آخرین شکست بکاپ ابری خودکار (پیام کوتاه + زمان)؛ با اولین بکاپ ابری موفق بعدی پاک می‌شود.
  lastCloudBackupErrorAt?: string;
  lastCloudBackupErrorMessage?: string;

  // --- چند-پروژه‌ای (نسخهٔ اول — فقط زیرساخت، رجوع کن به entities/Project.ts) ---
  // شناسهٔ پروژه‌ای که کاربر الان انتخاب کرده. فعلاً فقط برای تعیین این‌که
  // کدام پروژه در سوییچر بالای برنامه «فعال» نشان داده شود استفاده می‌شود؛
  // داده‌های خودِ طبقات/نیروها/دفتر حساب هنوز بر اساس آن فیلتر نمی‌شوند.
  activeProjectId: string;

  // --- قالب‌های ساعت «حضور گروهی» ---
  // برای رکوردها/بکاپ‌های قدیمی بدون این فیلد، withDefaults آرایهٔ خالی/null می‌دهد.
  attendanceTimeTemplates: AttendanceTimeTemplate[];
  /** شناسهٔ آخرین قالبی که در حضور گروهی استفاده شد (برای انتخاب پیش‌فرض دفعهٔ بعد). */
  lastAttendanceTemplateId: string | null;
}

export interface UpdateAppSettingsInput {
  standardWorkHoursPerDay: number;
}

export interface UpdateAutoBackupSettingsInput {
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  autoBackupMaxVersions: number;
}

export interface UpdateCloudBackupSettingsInput {
  cloudBackupEnabled: boolean;
  cloudBackupSupabaseUrl: string;
  cloudBackupSupabaseAnonKey: string;
  cloudBackupIntervalHours: number;
}

export interface UpdateNotificationSettingsInput {
  activityNotificationsEnabled: boolean;
}

export interface UpdateProjectInfoInput {
  projectName: string;
  supervisorName: string;
  projectLocation: string;
}

export interface UpdateQuickCheckInSettingsInput {
  quickCheckInDefaultTime: string;
  quickCheckOutDefaultTime: string;
}

export interface UpdateQuickBreakSettingsInput {
  quickBreakfastDefaultStartTime: string | null;
  quickBreakfastDefaultEndTime: string | null;
  quickLunchDefaultStartTime: string | null;
  quickLunchDefaultEndTime: string | null;
}
