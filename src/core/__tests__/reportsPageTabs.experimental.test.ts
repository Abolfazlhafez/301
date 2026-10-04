/**
 * (به‌روزرسانی بازطراحی سوم) «دفتر حساب» به «گزارش‌ها» برگشت و «حقوق نیروها»
 * به «تیم و تجهیزات ← نیروها» رفت.
 *
 * تست تجربی واقعی منطق تشخیص زیرتبِ صفحهٔ «گزارش‌ها» بعد از بازطراحی دوم
 * ناوبری (انتقال تب «دفتر حساب» به صفحهٔ «تیم و تجهیزات»).
 *
 * این دقیقاً همان الزام صریح پرامپت اصلی است: تغییر ساختار Navigation
 * نباید لینک‌های قدیمی (بوکمارک‌شده یا از جاهای دیگر اپ) را بشکند. تست‌های
 * زیر هر دو مقدار فعلی، مقادیر قدیمی، مقدار منتقل‌شدهٔ «cashbook»، و چند
 * حالت لبه‌ای (null، مقدار ناشناخته، رشتهٔ خالی) را با مقایسهٔ مستقیم مقدار
 * بازگشتی بررسی می‌کنند.
 */

import {
  resolveTabParam,
  resolveTabIndex,
  resolveMovedTabRedirect,
  TAB_PARAM_VALUES,
} from "../../pages/reports/reportsPageTabs";

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, testName: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}`);
    console.log(`     انتظار: ${JSON.stringify(expected)}`);
    console.log(`     دریافت: ${JSON.stringify(actual)}`);
  }
}

console.log("تست ۱: مقادیر معتبر فعلی");
assertEqual(resolveTabParam("daily-monthly"), "daily-monthly", "'daily-monthly' بدون تغییر");
assertEqual(resolveTabParam("cashbook"), "cashbook", "'cashbook' (دفتر حساب) دوباره تب معتبر گزارش‌هاست");
assertEqual(resolveTabIndex("daily-monthly"), 0, "اندیس daily-monthly = ۰");
assertEqual(resolveTabIndex("cashbook"), 1, "اندیس cashbook = ۱");

console.log("تست ۲: بخش‌های منتقل‌شده دیگر تب این صفحه نیستند");
for (const old of ["payroll-account", "payroll-cashbook", "worker-account"]) {
  assertEqual(resolveTabParam(old), null, `'${old}' دیگر تب معتبر نیست`);
  assertEqual(resolveTabIndex(old), -1, `اندیس '${old}' = -۱`);
}

console.log("تست ۳: لینک‌های قدیمی حقوق به مقصد جدید در «نیروها» هدایت می‌شوند");
for (const old of ["payroll-account", "payroll-cashbook", "worker-account"]) {
  assertEqual(resolveMovedTabRedirect(old), "/resources?tab=workers&view=payroll", `ریدایرکت '${old}'`);
}
assertEqual(resolveMovedTabRedirect("daily-monthly"), null, "تب معتبر فعلی ریدایرکت نمی‌شود");
assertEqual(resolveMovedTabRedirect("cashbook"), null, "cashbook ریدایرکت نمی‌شود (خودش تب این صفحه است)");
assertEqual(resolveMovedTabRedirect(null), null, "null ریدایرکت ندارد");
assertEqual(resolveMovedTabRedirect(""), null, "رشتهٔ خالی ریدایرکت ندارد");

console.log("تست ۴: مقادیر نامعتبر");
assertEqual(resolveTabParam(null), null, "null → null");
assertEqual(resolveTabParam(""), null, "رشتهٔ خالی → null");
assertEqual(resolveTabParam("چیز-ناشناخته-تصادفی"), null, "ناشناخته → null");
assertEqual(resolveTabParam("Cashbook"), null, "حساسیت به حروف رعایت می‌شود");
assertEqual(resolveMovedTabRedirect("Payroll-Account"), null, "ریدایرکت هم حساس به حروف است");

console.log("تست ۵: تعداد تب‌ها");
assertEqual(TAB_PARAM_VALUES.length, 2, "دقیقاً ۲ تب: روزانه/ماهانه و دفتر حساب");

console.log(`\nنتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
if (failed > 0) {
  throw new Error(`${failed} بررسی ناموفق بود.`);
}
