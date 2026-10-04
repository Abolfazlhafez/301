/**
 * تست منطق ناوبری «تیم و تجهیزات» (بازطراحی سوم): دفتر حساب به گزارش‌ها رفته،
 * حضور و حقوق نمای داخلی «نیروها» هستند، و لینک‌های قدیمی نباید بشکنند.
 */
import {
  resolveResourcesRedirect,
  resolveResourcesTabIndex,
  resolveTeamView,
  RESOURCES_TAB_VALUES,
  TEAM_VIEW_VALUES,
} from "../../pages/resources/resourcesPageTabs";

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, name: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}\n     انتظار: ${JSON.stringify(expected)}\n     دریافت: ${JSON.stringify(actual)}`);
  }
}

console.log("زیرتب‌ها");
assertEqual(RESOURCES_TAB_VALUES.length, 2, "دو زیرتب: نیروها و تجهیزات");
assertEqual(resolveResourcesTabIndex("workers"), 0, "workers = ۰");
assertEqual(resolveResourcesTabIndex("equipment"), 1, "equipment = ۱");
assertEqual(resolveResourcesTabIndex("attendance"), 0, "لینک قدیمی attendance روی «نیروها»");
assertEqual(resolveResourcesTabIndex("payroll"), 0, "payroll روی «نیروها»");
assertEqual(resolveResourcesTabIndex("cashbook"), -1, "cashbook دیگر زیرتب نیست");
assertEqual(resolveResourcesTabIndex(null), -1, "null = -۱");
assertEqual(resolveResourcesTabIndex("نامعتبر"), -1, "ناشناخته = -۱");

console.log("نمای داخلی نیروها");
assertEqual(TEAM_VIEW_VALUES.length, 3, "سه نما: فهرست، حضور، حقوق");
assertEqual(resolveTeamView("workers", "attendance"), "attendance", "view=attendance");
assertEqual(resolveTeamView("workers", "payroll"), "payroll", "view=payroll");
assertEqual(resolveTeamView("workers", "list"), "list", "view=list");
assertEqual(resolveTeamView("workers", null), "list", "بدون view → فهرست");
assertEqual(resolveTeamView(null, null), "list", "بدون هیچ پارامتر → فهرست");
assertEqual(resolveTeamView("attendance", null), "attendance", "tab=attendance قدیمی → حضور");
assertEqual(resolveTeamView("payroll", null), "payroll", "tab=payroll → حقوق");
assertEqual(resolveTeamView("workers", "خراب"), "list", "view نامعتبر → فهرست");
assertEqual(resolveTeamView("equipment", "payroll"), "payroll", "view معتبر بر tab مقدم است");

console.log("ریدایرکت‌ها");
assertEqual(resolveResourcesRedirect("cashbook"), "/reports?tab=cashbook", "cashbook → گزارش‌ها");
assertEqual(resolveResourcesRedirect("workers"), null, "workers ریدایرکت ندارد");
assertEqual(resolveResourcesRedirect("equipment"), null, "equipment ریدایرکت ندارد");
assertEqual(resolveResourcesRedirect(null), null, "null ریدایرکت ندارد");

console.log(`\nنتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
