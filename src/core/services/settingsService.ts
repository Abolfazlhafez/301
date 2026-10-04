import { db, SETTINGS_ROW_ID, ensureDatabaseSeeded } from "../db";
import { ValidationError } from "../errors";
import { randomUUID } from "../utils/uuid";
import {
  MAX_ATTENDANCE_TIME_TEMPLATES,
  type AppSettings,
  type AttendanceTimeTemplate,
  UpdateAppSettingsInput,
  UpdateAutoBackupSettingsInput,
  UpdateCloudBackupSettingsInput,
  UpdateNotificationSettingsInput,
  UpdateProjectInfoInput,
  UpdateQuickCheckInSettingsInput,
  UpdateQuickBreakSettingsInput,
} from "../../entities/AppSettings";

const TEMPLATE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** آرایهٔ قالب‌ها را از ورودی نامطمئن (رکورد قدیمی/بکاپ) به شکل امن برمی‌گرداند. */
function sanitizeTemplates(raw: unknown): AttendanceTimeTemplate[] {
  if (!Array.isArray(raw)) return [];
  const out: AttendanceTimeTemplate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const t = item as Partial<AttendanceTimeTemplate>;
    if (typeof t.id !== "string" || !t.id) continue;
    if (typeof t.name !== "string" || !t.name.trim()) continue;
    if (typeof t.checkIn !== "string" || !TEMPLATE_TIME_PATTERN.test(t.checkIn)) continue;
    if (typeof t.checkOut !== "string" || !TEMPLATE_TIME_PATTERN.test(t.checkOut)) continue;
    out.push({ id: t.id, name: t.name.trim(), checkIn: t.checkIn, checkOut: t.checkOut });
    if (out.length >= MAX_ATTENDANCE_TIME_TEMPLATES) break;
  }
  return out;
}

function validateTemplateFields(name: string, checkIn: string, checkOut: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError("نام قالب الزامی است.");
  if (!TEMPLATE_TIME_PATTERN.test(checkIn) || !TEMPLATE_TIME_PATTERN.test(checkOut)) {
    throw new ValidationError("فرمت ساعت قالب باید HH:mm باشد.");
  }
  return trimmed;
}

// مقادیر پیش‌فرض بکاپ خودکار: فعال، هر ۲۴ ساعت یک‌بار، نگهداری ۵ نسخه آخر.
export const DEFAULT_AUTO_BACKUP_SETTINGS = {
  autoBackupEnabled: true,
  autoBackupIntervalHours: 24,
  autoBackupMaxVersions: 5,
};

// بکاپ ابری برخلاف بکاپ محلی، پیش‌فرض غیرفعال است — چون نیاز به اطلاعات
// حساب Supabase شخصی کاربر دارد که تا وقتی خودش وارد نکند، معنایی ندارد.
export const DEFAULT_CLOUD_BACKUP_SETTINGS = {
  cloudBackupEnabled: false,
  cloudBackupSupabaseUrl: "",
  cloudBackupSupabaseAnonKey: "",
  cloudBackupIntervalHours: 24,
};

// ساعت پیش‌فرض «ثبت حضور سریع» پیش از هر تنظیم دستی کاربر — فقط یک مقدار
// شروع منطقی است، نه یک عدد ثابت هاردکد در منطق محاسبه؛ کاربر می‌تواند این
// را در تنظیمات یا مستقیماً از صفحهٔ حضور و غیاب تغییر دهد.
export const DEFAULT_QUICK_CHECKIN_TIME = "08:00";
// ساعت پیش‌فرض خروج، هم‌خانواده با DEFAULT_QUICK_CHECKIN_TIME — قبلاً این
// مقدار اصلاً وجود نداشت و به همین دلیل «ثبت سریع» برای نیروهای بدون سابقه
// فقط ساعت ورود را ثبت می‌کرد.
export const DEFAULT_QUICK_CHECKOUT_TIME = "17:00";

function withDefaults(row: Partial<AppSettings> | undefined): AppSettings {
  return {
    standardWorkHoursPerDay: row?.standardWorkHoursPerDay ?? 8,
    updatedAt: row?.updatedAt ?? new Date().toISOString(),
    autoBackupEnabled: row?.autoBackupEnabled ?? DEFAULT_AUTO_BACKUP_SETTINGS.autoBackupEnabled,
    autoBackupIntervalHours:
      row?.autoBackupIntervalHours ?? DEFAULT_AUTO_BACKUP_SETTINGS.autoBackupIntervalHours,
    autoBackupMaxVersions:
      row?.autoBackupMaxVersions ?? DEFAULT_AUTO_BACKUP_SETTINGS.autoBackupMaxVersions,
    lastAutoBackupAt: row?.lastAutoBackupAt,
    lastAutoBackupErrorAt: row?.lastAutoBackupErrorAt,
    lastAutoBackupErrorMessage: row?.lastAutoBackupErrorMessage,
    activityNotificationsEnabled: row?.activityNotificationsEnabled ?? true,
    projectName: row?.projectName ?? "",
    supervisorName: row?.supervisorName ?? "",
    projectLocation: row?.projectLocation ?? "",
    activeProjectId: row?.activeProjectId ?? "",
    quickCheckInDefaultTime: row?.quickCheckInDefaultTime ?? DEFAULT_QUICK_CHECKIN_TIME,
    quickCheckOutDefaultTime: row?.quickCheckOutDefaultTime ?? DEFAULT_QUICK_CHECKOUT_TIME,
    // برخلاف quickCheckInDefaultTime، این‌ها پیش‌فرض ندارند — یعنی «تنظیم
    // نشده» (null) کاملاً معتبر است و باعث می‌شود دکمهٔ «سریع» به سابقهٔ
    // خودِ نیرو رجوع کند، نه یک عدد حدسی.
    quickBreakfastDefaultStartTime: row?.quickBreakfastDefaultStartTime ?? null,
    quickBreakfastDefaultEndTime: row?.quickBreakfastDefaultEndTime ?? null,
    quickLunchDefaultStartTime: row?.quickLunchDefaultStartTime ?? null,
    quickLunchDefaultEndTime: row?.quickLunchDefaultEndTime ?? null,
    cloudBackupEnabled: row?.cloudBackupEnabled ?? DEFAULT_CLOUD_BACKUP_SETTINGS.cloudBackupEnabled,
    cloudBackupSupabaseUrl: row?.cloudBackupSupabaseUrl ?? DEFAULT_CLOUD_BACKUP_SETTINGS.cloudBackupSupabaseUrl,
    cloudBackupSupabaseAnonKey:
      row?.cloudBackupSupabaseAnonKey ?? DEFAULT_CLOUD_BACKUP_SETTINGS.cloudBackupSupabaseAnonKey,
    // اگر هنوز شناسهٔ دستگاه ساخته نشده (اولین اجرا)، یک شناسهٔ تصادفی و
    // پایدار می‌سازیم — این باید بعداً در db.settings.put ذخیره شود تا در
    // فراخوانی بعدی همان مقدار خوانده شود، نه هر بار عدد تصادفی جدید.
    cloudBackupDeviceId: row?.cloudBackupDeviceId ?? randomUUID(),
    cloudBackupIntervalHours:
      row?.cloudBackupIntervalHours ?? DEFAULT_CLOUD_BACKUP_SETTINGS.cloudBackupIntervalHours,
    lastCloudBackupAt: row?.lastCloudBackupAt,
    lastCloudBackupErrorAt: row?.lastCloudBackupErrorAt,
    lastCloudBackupErrorMessage: row?.lastCloudBackupErrorMessage,
    attendanceTimeTemplates: sanitizeTemplates(row?.attendanceTimeTemplates),
    lastAttendanceTemplateId: row?.lastAttendanceTemplateId ?? null,
  };
}

export const settingsService = {
  async get(): Promise<AppSettings> {
    await ensureDatabaseSeeded();
    const row = await db.settings.get(SETTINGS_ROW_ID);
    const settings = withDefaults(row);

    // اگر شناسهٔ دستگاه تازه ساخته شده (یعنی در رکورد قبلی وجود نداشت)،
    // همین‌جا آن را persist می‌کنیم — وگرنه هر فراخوانی بعدی get() دوباره
    // یک UUID تصادفی دیگر می‌ساخت که با مقدار قبلی فرق داشت، و شناسهٔ
    // دستگاه دیگر «پایدار» نمی‌ماند (که کل هدفش همین پایداری است، برای
    // تفکیک ردیف این دستگاه از دستگاه‌های دیگر در همان جدول ابری).
    if (!row?.cloudBackupDeviceId) {
      await db.settings.put({ ...settings, id: SETTINGS_ROW_ID });
    }

    return settings;
  },

  async update(input: UpdateAppSettingsInput): Promise<AppSettings> {
    if (!input.standardWorkHoursPerDay || input.standardWorkHoursPerDay <= 0) {
      throw new ValidationError("ساعت کاری استاندارد باید عددی مثبت باشد.");
    }
    if (input.standardWorkHoursPerDay > 24) {
      throw new ValidationError("ساعت کاری استاندارد نمی‌تواند بیشتر از ۲۴ ساعت باشد.");
    }

    const current = await this.get();
    const updated: AppSettings & { id: string } = {
      ...current,
      id: SETTINGS_ROW_ID,
      standardWorkHoursPerDay: input.standardWorkHoursPerDay,
      updatedAt: new Date().toISOString(),
    };
    await db.settings.put(updated);
    return updated;
  },

  async updateAutoBackupSettings(input: UpdateAutoBackupSettingsInput): Promise<AppSettings> {
    if (input.autoBackupIntervalHours <= 0) {
      throw new ValidationError("فاصله زمانی بکاپ خودکار باید عددی مثبت باشد.");
    }
    if (input.autoBackupMaxVersions <= 0 || input.autoBackupMaxVersions > 30) {
      throw new ValidationError("تعداد نسخه‌های بکاپ باید بین ۱ تا ۳۰ باشد.");
    }

    const current = await this.get();
    const updated: AppSettings & { id: string } = {
      ...current,
      id: SETTINGS_ROW_ID,
      autoBackupEnabled: input.autoBackupEnabled,
      autoBackupIntervalHours: input.autoBackupIntervalHours,
      autoBackupMaxVersions: input.autoBackupMaxVersions,
      updatedAt: new Date().toISOString(),
    };
    await db.settings.put(updated);
    return updated;
  },

  /**
   * فقط زمان آخرین بکاپ خودکار موفق را به‌روزرسانی می‌کند، بدون تغییر سایر تنظیمات.
   * چون این یعنی بکاپ همین الان موفق شده، هر خطای ثبت‌شدهٔ قبلی هم پاک می‌شود —
   * وگرنه یک خطای قدیمی که از بین رفته، برای همیشه در تنظیمات نمایش داده می‌شد.
   */
  async markAutoBackupDone(timestamp: string): Promise<void> {
    const current = await this.get();
    await db.settings.put({
      ...current,
      id: SETTINGS_ROW_ID,
      lastAutoBackupAt: timestamp,
      lastAutoBackupErrorAt: undefined,
      lastAutoBackupErrorMessage: undefined,
    });
  },

  /**
   * ثبت شکست یک تلاش بکاپ خودکار (چه دوره‌ای و چه دستی). این پیام تا زمانی
   * که یک بکاپ خودکار بعدی موفق شود، در تنظیمات نمایش داده می‌شود.
   */
  async markAutoBackupError(message: string): Promise<void> {
    const current = await this.get();
    await db.settings.put({
      ...current,
      id: SETTINGS_ROW_ID,
      lastAutoBackupErrorAt: new Date().toISOString(),
      lastAutoBackupErrorMessage: message,
    });
  },

  async updateNotificationSettings(input: UpdateNotificationSettingsInput): Promise<AppSettings> {
    const current = await this.get();
    const updated: AppSettings & { id: string } = {
      ...current,
      id: SETTINGS_ROW_ID,
      activityNotificationsEnabled: input.activityNotificationsEnabled,
      updatedAt: new Date().toISOString(),
    };
    await db.settings.put(updated);
    return updated;
  },

  /** به‌روزرسانی نام پروژه/کارگاه و سرپرست، برای نمایش در سربرگ گزارش روزانه و PDF. */
  async updateProjectInfo(input: UpdateProjectInfoInput): Promise<AppSettings> {
    const current = await this.get();
    const updated: AppSettings & { id: string } = {
      ...current,
      id: SETTINGS_ROW_ID,
      projectName: input.projectName.trim(),
      supervisorName: input.supervisorName.trim(),
      projectLocation: input.projectLocation.trim(),
      updatedAt: new Date().toISOString(),
    };
    await db.settings.put(updated);
    return updated;
  },

  /**
   * به‌روزرسانی ساعت پیش‌فرض «ثبت حضور سریع» (هم ورود، هم خروج). چون این
   * مقادیر به‌صورت مستقیم در ثبت رکورد حضور استفاده می‌شوند، فرمتشان
   * اعتبارسنجی می‌شود تا یک مقدار نامعتبر باعث ثبت ساعت خراب برای همهٔ
   * نیروهایی که سابقه ندارند نشود.
   */
  async updateQuickCheckInSettings(input: UpdateQuickCheckInSettingsInput): Promise<AppSettings> {
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(input.quickCheckInDefaultTime)) {
      throw new ValidationError("فرمت ساعت ورود نامعتبر است. باید به‌صورت HH:mm باشد (مثلاً 08:00).");
    }
    if (!timePattern.test(input.quickCheckOutDefaultTime)) {
      throw new ValidationError("فرمت ساعت خروج نامعتبر است. باید به‌صورت HH:mm باشد (مثلاً 17:00).");
    }
    const current = await this.get();
    const updated: AppSettings & { id: string } = {
      ...current,
      id: SETTINGS_ROW_ID,
      quickCheckInDefaultTime: input.quickCheckInDefaultTime,
      quickCheckOutDefaultTime: input.quickCheckOutDefaultTime,
      updatedAt: new Date().toISOString(),
    };
    await db.settings.put(updated);
    return updated;
  },

  /**
   * به‌روزرسانی بازهٔ ساعت پیش‌فرض «صبحانه سریع» و «ناهار سریع». هر چهار
   * فیلد اختیاری‌اند (می‌توانند خالی/null باشند)؛ در آن صورت دکمهٔ سریع
   * به جای این تنظیم، سراغ سابقهٔ خودِ نیرو می‌رود. اگر یکی از شروع/پایان
   * یک نوع پر شده و دیگری خالی مانده باشد، خطا می‌دهیم — چون یک بازهٔ
   * ناقص معنایی ندارد؛ یا هر دو باید پر باشند یا هیچ‌کدام.
   */
  async updateQuickBreakSettings(input: UpdateQuickBreakSettingsInput): Promise<AppSettings> {
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

    function validatePair(start: string | null, end: string | null, label: string) {
      if (!start && !end) return;
      if (!start || !end) {
        throw new ValidationError(`برای ${label} باید هم ساعت شروع و هم ساعت پایان وارد شود، یا هر دو خالی بمانند.`);
      }
      if (!timePattern.test(start) || !timePattern.test(end)) {
        throw new ValidationError(`فرمت ساعت ${label} نامعتبر است. باید به‌صورت HH:mm باشد.`);
      }
    }

    validatePair(input.quickBreakfastDefaultStartTime, input.quickBreakfastDefaultEndTime, "صبحانه سریع");
    validatePair(input.quickLunchDefaultStartTime, input.quickLunchDefaultEndTime, "ناهار سریع");

    const current = await this.get();
    const updated: AppSettings & { id: string } = {
      ...current,
      id: SETTINGS_ROW_ID,
      quickBreakfastDefaultStartTime: input.quickBreakfastDefaultStartTime || null,
      quickBreakfastDefaultEndTime: input.quickBreakfastDefaultEndTime || null,
      quickLunchDefaultStartTime: input.quickLunchDefaultStartTime || null,
      quickLunchDefaultEndTime: input.quickLunchDefaultEndTime || null,
      updatedAt: new Date().toISOString(),
    };
    await db.settings.put(updated);
    return updated;
  },

  /**
   * به‌روزرسانی تنظیمات بکاپ ابری (Supabase). آدرس و کلید فقط از نظر شکل
   * کلی اعتبارسنجی می‌شوند (نه با یک درخواست شبکه واقعی — چون این متد
   * فقط ذخیره‌سازی محلی است؛ تست اتصال واقعی در cloudBackupService انجام
   * می‌شود، جایی که کاربر می‌تواند دکمهٔ «تست اتصال» را بزند).
   */
  async updateCloudBackupSettings(input: UpdateCloudBackupSettingsInput): Promise<AppSettings> {
    if (input.cloudBackupEnabled) {
      if (
        !input.cloudBackupSupabaseUrl.trim() ||
        !/^https:\/\/.+\.supabase\.co\/?$/.test(input.cloudBackupSupabaseUrl.trim())
      ) {
        throw new ValidationError("آدرس پروژهٔ Supabase نامعتبر است (باید شبیه https://xxxxx.supabase.co باشد).");
      }
      if (!input.cloudBackupSupabaseAnonKey.trim()) {
        throw new ValidationError("کلید Supabase را وارد کنید.");
      }
    }
    if (input.cloudBackupIntervalHours <= 0) {
      throw new ValidationError("فاصله زمانی بکاپ ابری باید عددی مثبت باشد.");
    }

    const current = await this.get();
    const updated: AppSettings & { id: string } = {
      ...current,
      id: SETTINGS_ROW_ID,
      cloudBackupEnabled: input.cloudBackupEnabled,
      cloudBackupSupabaseUrl: input.cloudBackupSupabaseUrl.trim().replace(/\/$/, ""),
      cloudBackupSupabaseAnonKey: input.cloudBackupSupabaseAnonKey.trim(),
      cloudBackupIntervalHours: input.cloudBackupIntervalHours,
      updatedAt: new Date().toISOString(),
    };
    await db.settings.put(updated);
    return updated;
  },

  // --- قالب‌های ساعت «حضور گروهی» ---

  async listAttendanceTemplates(): Promise<AttendanceTimeTemplate[]> {
    return (await this.get()).attendanceTimeTemplates;
  },

  async createAttendanceTemplate(input: { name: string; checkIn: string; checkOut: string }): Promise<AttendanceTimeTemplate> {
    const name = validateTemplateFields(input.name, input.checkIn, input.checkOut);
    const current = await this.get();
    if (current.attendanceTimeTemplates.length >= MAX_ATTENDANCE_TIME_TEMPLATES) {
      throw new ValidationError(`حداکثر ${MAX_ATTENDANCE_TIME_TEMPLATES} قالب مجاز است.`);
    }
    if (current.attendanceTimeTemplates.some((t) => t.name === name)) {
      throw new ValidationError("قالبی با این نام از قبل وجود دارد.");
    }
    const created: AttendanceTimeTemplate = { id: randomUUID(), name, checkIn: input.checkIn, checkOut: input.checkOut };
    await db.settings.put({
      ...current,
      id: SETTINGS_ROW_ID,
      attendanceTimeTemplates: [...current.attendanceTimeTemplates, created],
      updatedAt: new Date().toISOString(),
    });
    return created;
  },

  async updateAttendanceTemplate(
    id: string,
    input: { name: string; checkIn: string; checkOut: string }
  ): Promise<AttendanceTimeTemplate> {
    const name = validateTemplateFields(input.name, input.checkIn, input.checkOut);
    const current = await this.get();
    const existing = current.attendanceTimeTemplates.find((t) => t.id === id);
    if (!existing) throw new ValidationError("قالب پیدا نشد.");
    if (current.attendanceTimeTemplates.some((t) => t.id !== id && t.name === name)) {
      throw new ValidationError("قالبی با این نام از قبل وجود دارد.");
    }
    const updated: AttendanceTimeTemplate = { id, name, checkIn: input.checkIn, checkOut: input.checkOut };
    await db.settings.put({
      ...current,
      id: SETTINGS_ROW_ID,
      attendanceTimeTemplates: current.attendanceTimeTemplates.map((t) => (t.id === id ? updated : t)),
      updatedAt: new Date().toISOString(),
    });
    return updated;
  },

  async deleteAttendanceTemplate(id: string): Promise<void> {
    const current = await this.get();
    if (!current.attendanceTimeTemplates.some((t) => t.id === id)) {
      throw new ValidationError("قالب پیدا نشد.");
    }
    await db.settings.put({
      ...current,
      id: SETTINGS_ROW_ID,
      attendanceTimeTemplates: current.attendanceTimeTemplates.filter((t) => t.id !== id),
      // اگر قالب حذف‌شده «آخرین استفاده‌شده» بود، اشارهٔ معلق نماند.
      lastAttendanceTemplateId: current.lastAttendanceTemplateId === id ? null : current.lastAttendanceTemplateId,
      updatedAt: new Date().toISOString(),
    });
  },

  /** شناسهٔ آخرین قالب استفاده‌شده را ذخیره می‌کند (null = هیچ). شناسهٔ ناموجود رد می‌شود. */
  async setLastAttendanceTemplateId(id: string | null): Promise<void> {
    const current = await this.get();
    if (id !== null && !current.attendanceTimeTemplates.some((t) => t.id === id)) {
      throw new ValidationError("قالب پیدا نشد.");
    }
    await db.settings.put({ ...current, id: SETTINGS_ROW_ID, lastAttendanceTemplateId: id });
  },

  /** فقط زمان آخرین بکاپ ابری موفق را به‌روزرسانی می‌کند، بدون تغییر سایر تنظیمات. */
  async markCloudBackupDone(timestamp: string): Promise<void> {
    const current = await this.get();
    await db.settings.put({
      ...current,
      id: SETTINGS_ROW_ID,
      lastCloudBackupAt: timestamp,
      lastCloudBackupErrorAt: undefined,
      lastCloudBackupErrorMessage: undefined,
    });
  },

  /** ثبت شکست بکاپ ابری خودکار تا در کارت بکاپ ابری نشان داده شود (تا اولین موفقیت بعدی). */
  async markCloudBackupError(message: string): Promise<void> {
    const current = await this.get();
    await db.settings.put({
      ...current,
      id: SETTINGS_ROW_ID,
      lastCloudBackupErrorAt: new Date().toISOString(),
      lastCloudBackupErrorMessage: message.slice(0, 200),
    });
  },
};
