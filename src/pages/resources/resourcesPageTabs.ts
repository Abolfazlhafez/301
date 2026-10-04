/**
 * منطق زیرتب‌های صفحهٔ «تیم و تجهیزات» (ResourcesPage) و نمای داخلی «نیروها»
 * (TeamHub) از روی پارامترهای URL — جدا از UI تا مستقیم تست شود.
 *
 * ساختار فعلی:
 *  - زیرتب‌ها: «نیروها» و «تجهیزات».
 *  - داخل «نیروها» سه نما: فهرست نیروها، حضور و غیاب، حقوق (پارامتر view).
 *  - «دفتر حساب» به صفحهٔ «گزارش‌ها» رفته؛ ?tab=cashbook اینجا به آنجا هدایت می‌شود.
 */

export const RESOURCES_TAB_VALUES = ["workers", "equipment"] as const;
export type ResourcesTabValue = (typeof RESOURCES_TAB_VALUES)[number];

export const TEAM_VIEW_VALUES = ["list", "attendance", "payroll"] as const;
export type TeamView = (typeof TEAM_VIEW_VALUES)[number];

// مقادیر قدیمی tab که اکنون یکی از نماهای داخلی «نیروها» هستند.
const LEGACY_TAB_TO_TEAM_VIEW: Record<string, TeamView> = {
  attendance: "attendance",
  payroll: "payroll",
};

// بخش‌هایی که به صفحهٔ دیگری رفته‌اند → مسیر مقصد.
const MOVED_TAB_REDIRECTS: Record<string, string> = {
  cashbook: "/reports?tab=cashbook",
};

/** اندیس زیرتب (۰ = نیروها، ۱ = تجهیزات)، یا -1 اگر ناشناخته بود. مقادیر قدیمی attendance/payroll روی «نیروها» می‌افتند. */
export function resolveResourcesTabIndex(tab: string | null): number {
  if (!tab) return -1;
  const direct = (RESOURCES_TAB_VALUES as readonly string[]).indexOf(tab);
  if (direct >= 0) return direct;
  if (tab in LEGACY_TAB_TO_TEAM_VIEW) return 0;
  return -1;
}

/** نمای داخلی «نیروها»: اول پارامتر view، بعد مقدار قدیمی tab، در غیر این صورت فهرست. */
export function resolveTeamView(tab: string | null, view: string | null): TeamView {
  if (view && (TEAM_VIEW_VALUES as readonly string[]).includes(view)) return view as TeamView;
  if (tab && tab in LEGACY_TAB_TO_TEAM_VIEW) return LEGACY_TAB_TO_TEAM_VIEW[tab];
  return "list";
}

/** اگر این tab به صفحهٔ دیگری منتقل شده، مسیر مقصد؛ وگرنه null. */
export function resolveResourcesRedirect(tab: string | null): string | null {
  if (!tab) return null;
  return MOVED_TAB_REDIRECTS[tab] ?? null;
}
