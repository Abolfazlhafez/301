/**
 * تست تجربی واقعی: هر پروژه، از همان لحظهٔ ساخت، باید دقیقاً یک صندوق
 * پیش‌فرض داشته باشد.
 *
 * این دقیقاً همان کلاس باگی است که کاربر گزارش داد: «در منوی دفتر حساب
 * روی درحال بارگذاری می‌ماند و چیزی لود نمی‌شود». ریشهٔ باگ: صفحهٔ دفتر
 * حساب (CashbookSection) نمایش را منوط به انتخاب خودکار یک صندوق می‌کرد،
 * و آن انتخاب فقط وقتی اتفاق می‌افتاد که حداقل یک صندوق برای پروژهٔ فعال
 * وجود داشته باشد. seed اولیهٔ صندوق پیش‌فرض در ensureDatabaseSeeded فقط
 * یک‌بار، برای اولین پروژهٔ کل دیتابیس اجرا می‌شد — هر پروژهٔ دومی/سومی که
 * از داخل خودِ برنامه ساخته می‌شد هیچ صندوقی نمی‌گرفت، و صفحهٔ دفتر حساب
 * آن پروژه بدون هیچ خطا یا راه خروجی در UI، برای همیشه در حالت «در حال
 * بارگذاری» می‌ماند.
 *
 * دو رفع جداگانه با هم تست می‌شوند:
 *   ۱) projectService.create اکنون همراه با خودِ پروژه، یک صندوق پیش‌فرض
 *      هم می‌سازد (رفع ریشه‌ای — از این به بعد چنین پروژه‌ای اصلاً ساخته
 *      نمی‌شود).
 *   ۲) cashboxFundService.create اکنون اولین صندوق هر پروژه را خودکار
 *      isDefault=true می‌کند (تا اگر از مسیر دیگری، پروژه‌ای با صفر صندوق
 *      به دستِ کاربر رسید، ساختن اولین صندوق از داخل UI درست پیش‌فرض شود
 *      و بعداً هم قابل حذف تصادفی نباشد).
 */

import "fake-indexeddb/auto";

import { db, ensureDatabaseSeeded } from "../db";
import { projectService } from "../services/projectService";
import { cashboxFundService } from "../services/cashboxFundService";

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

async function main() {
  console.log("=".repeat(70));
  console.log("راه‌اندازی اولیه (پروژه و صندوق اول به‌صورت خودکار seed می‌شوند)");
  console.log("=".repeat(70));
  await ensureDatabaseSeeded();

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۱: ساخت یک پروژهٔ دوم از همان مسیری که UI واقعی استفاده می‌کند");
  console.log("=".repeat(70));

  const projectB = await projectService.create({ name: "کارگاه دوم" });
  const fundsOfB = await db.cashboxFunds.where({ projectId: projectB.id }).toArray();

  assertEqual(fundsOfB.length, 1, "پروژهٔ تازه همان لحظهٔ ساخت دقیقاً یک صندوق دارد (نه صفر)");
  assertEqual(fundsOfB[0]?.isDefault, true, "همان یک صندوق، صندوق پیش‌فرض همین پروژه است");

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۲: همان کوئری‌ای که صفحهٔ دفتر حساب صدا می‌زند (بعد از سوییچ پروژه)");
  console.log("=".repeat(70));

  await projectService.setActiveProjectId(projectB.id);
  const fundsSeenByPage = await cashboxFundService.list();
  assertEqual(
    fundsSeenByPage.length,
    1,
    "کوئری صفحهٔ دفتر حساب برای پروژهٔ تازه یک صندوق برمی‌گرداند، نه آرایهٔ خالی (خودِ باگ همین بود)"
  );

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۳: ساخت یک صندوق دومِ دستی برای همین پروژه — نباید پیش‌فرض را جابه‌جا کند");
  console.log("=".repeat(70));

  const secondFund = await cashboxFundService.create({ name: "صندوق دوم" });
  assertEqual(secondFund.isDefault, false, "صندوق دومِ همین پروژه پیش‌فرض نیست (صندوق اول همچنان پیش‌فرض می‌ماند)");

  const allFundsOfB = await db.cashboxFunds.where({ projectId: projectB.id }).toArray();
  assertEqual(
    allFundsOfB.filter((f) => f.isDefault).length,
    1,
    "دقیقاً یک صندوق پیش‌فرض برای این پروژه وجود دارد، نه صفر و نه بیشتر از یک"
  );

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۴: شبیه‌سازی یک پروژهٔ «قدیمی/از قبل خراب» که صفر صندوق دارد —");
  console.log("   ساختن اولین صندوقش از همان مسیر UI (cashboxFundService.create) باید");
  console.log("   خودش را به‌عنوان پیش‌فرض تشخیص دهد، بدون نیاز به projectService.create");
  console.log("=".repeat(70));

  const projectC = await projectService.create({ name: "پروژهٔ سوم" });
  // برای شبیه‌سازی دقیق حالت باگ (پروژه‌ای که پیش از این رفع، بدون صندوق
  // ساخته شده بود)، صندوقی که projectService.create خودش ساخت را پاک
  // می‌کنیم تا واقعاً به صفر صندوق برسیم.
  await db.cashboxFunds.where({ projectId: projectC.id }).delete();
  const countAfterManualDeletion = await db.cashboxFunds.where({ projectId: projectC.id }).count();
  assertEqual(countAfterManualDeletion, 0, "شبیه‌سازی موفق: این پروژه الان دقیقاً صفر صندوق دارد");

  await projectService.setActiveProjectId(projectC.id);
  const firstManualFund = await cashboxFundService.create({ name: "صندوق اصلی" });
  assertEqual(
    firstManualFund.isDefault,
    true,
    "اولین صندوقی که برای این پروژهٔ صفر-صندوقی از داخل UI ساخته می‌شود، خودکار پیش‌فرض است"
  );

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));

  if (failed > 0) {
    throw new Error(`${failed} بررسی ناموفق بود.`);
  }
}

main().catch((err) => {
  console.error("خطای اجرای تست:", err);
  throw err;
});
