/**
 * «طبقه» — واحد اصلی «دفترچه دیجیتال طبقه». اکنون به یک Project مشخص
 * (projectId) تعلق دارد (قدم اول چند-پروژه‌ای، مورد ۱ گزارش بررسی پروژه).
 * توجه: فعلاً فقط همین Entity (Floor) و سرویس مربوطه پروژه‌محور شده‌اند؛
 * بقیهٔ Entity ها (Worker، Cashbook و...) هنوز سراسری‌اند — رجوع کن به
 * توضیح بالای entities/Project.ts برای جزئیات کامل وضعیت فعلی.
 */

export type FloorUsageType =
  | "residential"
  | "office"
  | "commercial"
  | "parking"
  | "storage"
  | "utility"
  | "common"
  | "roof"
  | "other";

export const FLOOR_USAGE_TYPES: FloorUsageType[] = [
  "residential",
  "office",
  "commercial",
  "parking",
  "storage",
  "utility",
  "common",
  "roof",
  "other",
];

export type FloorStatus = "not_started" | "in_progress" | "paused" | "completed";

export const FLOOR_STATUSES: FloorStatus[] = ["not_started", "in_progress", "paused", "completed"];

/**
 * calculated: پیشرفت طبقه از میانگین وزنی پیشرفت مراحل (Stage) محاسبه می‌شود.
 * manual: کاربر عدد پیشرفت را دستی تعیین کرده (مثلاً برای طبقه‌ای که هنوز
 * مرحله‌بندی نشده) — مقدار در manualProgress نگه داشته می‌شود.
 */
export type FloorProgressMode = "calculated" | "manual";

/**
 * تک‌واحدی: کل طبقه یک واحد یکپارچه است (مثلاً یک ویلا یا یک طبقهٔ تجاری).
 * چندواحدی: طبقه به چند واحد مستقل تقسیم شده (مثلاً آپارتمان)؛ در این حالت
 * unitCount تعداد واحدها را نگه می‌دارد.
 */
export type FloorUnitType = "single" | "multi";

export const FLOOR_UNIT_TYPES: FloorUnitType[] = ["single", "multi"];

export interface Floor {
  id: string;
  /** پروژه‌ای که این طبقه به آن تعلق دارد (رجوع کن به entities/Project.ts). */
  projectId: string;
  name: string;
  number: number | null;
  usageType: FloorUsageType;
  area: number | null;
  height: number | null;
  description: string | null;
  status: FloorStatus;
  progressMode: FloorProgressMode;
  manualProgress: number | null;
  unitType: FloorUnitType;
  /** فقط وقتی unitType برابر «multi» است معنا دارد؛ در غیر این صورت null. */
  unitCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFloorInput {
  name: string;
  number?: number | null;
  usageType: FloorUsageType;
  area?: number | null;
  height?: number | null;
  description?: string | null;
  status?: FloorStatus;
  unitType?: FloorUnitType;
  unitCount?: number | null;
}

export interface UpdateFloorInput {
  name?: string;
  number?: number | null;
  usageType?: FloorUsageType;
  area?: number | null;
  height?: number | null;
  description?: string | null;
  status?: FloorStatus;
  progressMode?: FloorProgressMode;
  manualProgress?: number | null;
  unitType?: FloorUnitType;
  unitCount?: number | null;
}

/** یک عامل جریمه در محاسبهٔ امتیاز سلامت — چرا و چقدر از ۱۰۰ کم شد. */
export interface FloorHealthFactor {
  /** کلید ترجمه برای برچسب این عامل (مثلاً «مشکل بحرانی باز»). */
  labelKey: string;
  /** تعداد موردی که این جریمه را ایجاد کرده (مثلاً ۲ مشکل بحرانی). */
  count: number;
  /** جمع امتیاز کسرشده به‌خاطر همین عامل. */
  penalty: number;
}

/** طبقه به‌همراه آمار محاسبه‌شده (هرگز ذخیره نمی‌شود، همیشه در لحظهٔ خواندن ساخته می‌شود). */
export interface FloorWithStats extends Floor {
  progress: number;
  openTasksCount: number;
  openIssuesCount: number;
  criticalOpenIssuesCount: number;
  stagesCount: number;
  completedStagesCount: number;
  /** جمع تراکنش‌های دفتر حساب که صراحتاً به این طبقه مرتبط شده‌اند (نه یک تراکنش جدید و موازی). */
  linkedCashbookTotal: number;
  lastActivityAt: string | null;
  /** امتیاز سلامت طبقه (۰ تا ۱۰۰) — فقط یک سیگنال مدیریتی، جایگزین Progress نیست. */
  healthScore: number;
  /**
   * تفکیک کامل عوامل مؤثر در healthScore — تا این عدد یک جعبهٔ سیاه نباشد؛
   * کاربر می‌تواند دقیقاً ببیند هر عامل (مشکل بحرانی، مرحلهٔ گیرکرده، کار
   * عقب‌افتاده، مورد ردشدهٔ چک‌لیست) چقدر از امتیاز را کم کرده و برای بهبود
   * عدد، دقیقاً باید کدام مورد را برطرف کند. فقط عوامل با penalty>0 لیست می‌شوند.
   */
  healthBreakdown: FloorHealthFactor[];
}
