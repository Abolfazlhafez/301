/**
 * منطق تشخیص زیرتبِ صفحهٔ «گزارش‌ها» (ReportsPage) از روی پارامتر URL.
 *
 * این منطق عمداً از خودِ کامپوننت React جدا شده تا بدون رندر UI و با داده‌های
 * واقعی تست شود؛ چون سازگاری با لینک‌های قدیمی (بعد از هر جابه‌جایی بخش‌ها)
 * همین‌جا رعایت می‌شود.
 *
 * ساختار فعلی (بازطراحی سوم ناوبری):
 *  - «دفتر حساب» از «تیم و تجهیزات» به این صفحه آمد (تب دوم).
 *  - «حقوق نیروها» (و حضور و غیاب) از این صفحه به زیرتب «نیروها» در
 *    «تیم و تجهیزات» رفت؛ لینک‌های قدیمی آن‌ها با resolveMovedTabRedirect به
 *    مقصد جدید هدایت می‌شوند (کار ریدایرکت واقعی با ReportsPage.tsx است).
 */

// مقادیر معتبر فعلی، دقیقاً به همان ترتیب اندیس تب‌ها در UI.
export const TAB_PARAM_VALUES = ["daily-monthly", "cashbook"] as const;
export type TabParamValue = (typeof TAB_PARAM_VALUES)[number];

// مقادیر قدیمی‌ای که هنوز در همین صفحه معادل دارند (فعلاً هیچ).
export const LEGACY_TAB_PARAM_MAP: Record<string, TabParamValue> = {};

// مقادیری که زمانی تب همین صفحه بودند ولی بخششان به صفحهٔ دیگری رفته است.
// کلید = مقدار قدیمی پارامتر tab، مقدار = مسیر کامل مقصد جدید.
//   - «payroll-account» / «payroll-cashbook» / «worker-account» → حقوق نیروها
//     که حالا در «تیم و تجهیزات ← نیروها ← حقوق» است.
export const MOVED_TAB_REDIRECTS: Record<string, string> = {
  "payroll-account": "/resources?tab=workers&view=payroll",
  "payroll-cashbook": "/resources?tab=workers&view=payroll",
  "worker-account": "/resources?tab=workers&view=payroll",
};

/** مقدار خام پارامتر URL را به یک مقدار معتبر فعلی (یا null) تبدیل می‌کند. */
export function resolveTabParam(raw: string | null): TabParamValue | null {
  if (!raw) return null;
  if ((TAB_PARAM_VALUES as readonly string[]).includes(raw)) return raw as TabParamValue;
  return LEGACY_TAB_PARAM_MAP[raw] ?? null;
}

/** اندیس تب متناظر با یک مقدار پارامتر خام، یا -1 اگر قابل تشخیص نبود. */
export function resolveTabIndex(raw: string | null): number {
  const resolved = resolveTabParam(raw);
  return resolved ? TAB_PARAM_VALUES.indexOf(resolved) : -1;
}

/** اگر این مقدار خام به بخشی اشاره دارد که به صفحهٔ دیگری رفته، مسیر مقصد را برمی‌گرداند؛ وگرنه null. */
export function resolveMovedTabRedirect(raw: string | null): string | null {
  if (!raw) return null;
  return MOVED_TAB_REDIRECTS[raw] ?? null;
}
