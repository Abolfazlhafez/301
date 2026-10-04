/**
 * تست تجربی واقعی: تراکنش‌های «یتیم» دفتر حساب (fundId نامعتبر) باید
 * توسط ensureDatabaseSeeded ترمیم شوند و دوباره در UI قابل مشاهده باشند.
 *
 * این دقیقاً همان کلاس باگی است که کاربر گزارش داد: «فقط دفتر حساب خالی
 * شد، بقیه سالم ماند» بعد از نصب یک آپدیت روی نصب قدیمی. علت دقیق ریشه‌ای
 * (چرا fundId نامعتبر شد) در محیط تست Node قابل بازتولید نبود، اما این
 * تست ثابت می‌کند که حتی اگر چنین حالتی به هر دلیلی رخ دهد، برنامه
 * دیگر داده را بی‌صدا مخفی نمی‌کند — بلکه در همان اجرای بعدی ترمیمش می‌کند.
 */

import "fake-indexeddb/auto";

import { db, ensureDatabaseSeeded } from "../db";
import { cashbookApi } from "../../shared/api/cashbookApi";

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
  console.log("راه‌اندازی اولیه (تا صندوق پیش‌فرض ساخته شود)");
  console.log("=".repeat(70));
  await ensureDatabaseSeeded();
  const funds = await db.cashboxFunds.toArray();
  assertEqual(funds.length, 1, "یک صندوق پیش‌فرض ساخته شد");
  const defaultFundId = funds[0].id;

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۱: تزریق دستی یک تراکنش 'یتیم' — fundId به هیچ صندوق موجودی اشاره ندارد");
  console.log("   (شبیه‌سازی دقیق سناریوی واقعی: داده در دیتابیس هست، اما fundId اشتباه است)");
  console.log("=".repeat(70));

  const now = new Date().toISOString();
  await db.cashbookEntries.add({
    id: "orphaned-entry-1",
    type: "expense",
    title: "تراکنش یتیم — fundId اشاره به صندوقی که وجود ندارد",
    amount: 1_500_000,
    date: "2026-05-01",
    description: null,
    fundId: "fund-id-that-does-not-exist-anymore",
    workerId: null,
    receiptPhotoId: null,
    createdAt: now,
    updatedAt: now,
  });

  const countBeforeHealing = await db.cashbookEntries.count();
  assertEqual(countBeforeHealing, 1, "تراکنش یتیم واقعاً در دیتابیس ذخیره شد");

  const entriesVisibleBeforeHealing = await cashbookApi.list({ fundId: defaultFundId });
  assertEqual(
    entriesVisibleBeforeHealing.length,
    0,
    "قبل از ترمیم: با فیلتر صندوق پیش‌فرض در UI، این تراکنش دیده نمی‌شود (این خودِ باگ است)"
  );

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۲: 'باز کردن مجدد اپ' — صدا زدن دوبارهٔ ensureDatabaseSeeded");
  console.log("   (دقیقاً همان چیزی که در هر بار باز شدن برنامه اجرا می‌شود)");
  console.log("=".repeat(70));

  await ensureDatabaseSeeded();

  const healedEntry = await db.cashbookEntries.get("orphaned-entry-1");
  assertEqual(healedEntry?.fundId, defaultFundId, "بعد از ترمیم، fundId تراکنش یتیم به صندوق پیش‌فرض اصلاح شد");

  const entriesVisibleAfterHealing = await cashbookApi.list({ fundId: defaultFundId });
  assertEqual(
    entriesVisibleAfterHealing.length,
    1,
    "بعد از ترمیم: همان کوئری UI حالا تراکنش را نشان می‌دهد — دیگر گم نیست"
  );
  assertEqual(
    entriesVisibleAfterHealing[0]?.title,
    "تراکنش یتیم — fundId اشاره به صندوقی که وجود ندارد",
    "محتوای تراکنش در فرآیند ترمیم دست‌نخورده ماند (فقط fundId اصلاح شد)"
  );

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۲: تراکنش با fundId کاملاً خالی/null هم باید ترمیم شود");
  console.log("=".repeat(70));

  await db.cashbookEntries.add({
    id: "orphaned-entry-2",
    type: "deposit",
    title: "تراکنش بدون fundId اصلاً",
    amount: 2_000_000,
    date: "2026-05-02",
    description: null,
    fundId: "" as unknown as string,
    workerId: null,
    receiptPhotoId: null,
    createdAt: now,
    updatedAt: now,
  });
  await ensureDatabaseSeeded();
  const secondHealed = await db.cashbookEntries.get("orphaned-entry-2");
  assertEqual(secondHealed?.fundId, defaultFundId, "تراکنش با fundId خالی هم به صندوق پیش‌فرض متصل شد");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۳: تراکنشی که از اول fundId معتبر داشته، دست‌نخورده می‌ماند (بدون تغییر غیرضروری)");
  console.log("=".repeat(70));

  await db.cashbookEntries.add({
    id: "healthy-entry-1",
    type: "salary",
    title: "تراکنش سالم که هیچ‌وقت نباید تغییر کند",
    amount: 500_000,
    date: "2026-05-03",
    description: null,
    fundId: defaultFundId,
    workerId: null,
    receiptPhotoId: null,
    createdAt: now,
    updatedAt: now,
  });
  await ensureDatabaseSeeded();
  const stillHealthy = await db.cashbookEntries.get("healthy-entry-1");
  assertEqual(stillHealthy?.updatedAt, now, "تراکنش سالم هیچ تغییری در updatedAt نداشت (دست‌نخورده باقی ماند)");

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
