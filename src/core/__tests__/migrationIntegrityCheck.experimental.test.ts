/**
 * تست تجربی واقعی: Migration نسخهٔ ۸ (افزودن مفهوم «صندوق») باید تعداد
 * تراکنش‌های دفتر حساب را قبل/بعد مقایسه کند — دقیقاً همان الزام صریح
 * پرامپت اصلی: «قبل و بعد از Migration صحت داده‌ها را بررسی کن؛ تعداد
 * رکوردها را با قبل مقایسه کن».
 *
 * این تست با schema واقعی نسخهٔ ۷ (قبل از مفهوم صندوق) شروع می‌کند و
 * می‌گذارد core/db.ts واقعی (بدون هیچ تغییر یا کپی) این Migration را
 * واقعاً اجرا کند — دقیقاً همان مسیری که یک کاربر واقعی با نصب قدیمی طی
 * می‌کند.
 */

import "fake-indexeddb/auto";
import Dexie from "dexie";

const REAL_DB_NAME = "karegah-yar-db";

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

function assertTrue(condition: boolean, testName: string) {
  assertEqual(condition, true, testName);
}

async function main() {
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۱: دیتابیس با schema واقعی نسخهٔ ۷ (قبل از مفهوم صندوق)");
  console.log("   و چند تراکنش دفتر حساب واقعی، بدون fundId");
  console.log("=".repeat(70));

  const oldDb = new Dexie(REAL_DB_NAME);
  oldDb.version(1).stores({ workers: "id, isActive", attendances: "id, workerId, date" });
  oldDb.version(4).stores({ ledgerEntries: "id, workerId, date" });
  oldDb.version(5).stores({ cashbookEntries: "id, workerId, date, type" });
  oldDb.version(7).stores({ dailyReportNotes: "id, date", workLogNotes: "id, date" });

  await oldDb.open();

  const now = new Date().toISOString();
  const entryIds = ["entry-1", "entry-2", "entry-3"];
  for (const id of entryIds) {
    await oldDb.table("cashbookEntries").add({
      id,
      type: "expense",
      title: `هزینهٔ قدیمی ${id}`,
      amount: 1_000_000,
      date: "2025-01-01",
      description: null,
      workerId: null,
      createdAt: now,
      updatedAt: now,
    });
  }
  const countBeforeMigration = await oldDb.table("cashbookEntries").count();
  assertEqual(countBeforeMigration, 3, "دیتابیس نسخهٔ قدیمی حاوی دقیقاً ۳ تراکنش (بدون fundId) است");
  oldDb.close();

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۲: باز کردن با core/db.ts واقعی — Migration نسخهٔ ۸ باید اجرا شود");
  console.log("   و اعتبارسنجی صحت (تعداد رکورد قبل/بعد) را با موفقیت رد کند");
  console.log("=".repeat(70));

  const { db, ensureDatabaseSeeded } = await import("../db");

  let threwDuringUpgrade = false;
  try {
    await ensureDatabaseSeeded();
  } catch {
    threwDuringUpgrade = true;
  }
  assertEqual(threwDuringUpgrade, false, "Migration نسخهٔ ۸ روی دادهٔ سالم، بدون خطا کامل می‌شود");

  const countAfterMigration = await db.cashbookEntries.count();
  assertEqual(countAfterMigration, 3, "بعد از Migration، دقیقاً همان ۳ تراکنش (نه بیشتر، نه کمتر) موجود است");

  const allEntries = await db.cashbookEntries.toArray();
  const allHaveFundId = allEntries.every((e) => typeof e.fundId === "string" && e.fundId.length > 0);
  assertTrue(allHaveFundId, "همهٔ ۳ تراکنش بعد از Migration یک fundId معتبر دریافت کرده‌اند");

  const uniqueFundIds = new Set(allEntries.map((e) => e.fundId));
  assertEqual(uniqueFundIds.size, 1, "همهٔ تراکنش‌ها دقیقاً به یک صندوق پیش‌فرض مشترک وصل شدند (نه صندوق‌های پراکنده)");

  console.log();
  console.log("=".repeat(70));
  console.log("تست تکمیلی: خودِ منطق اعتبارسنجی (شبیه‌سازی‌شده) واقعاً نامساوی را می‌گیرد");
  console.log("   — این بخش مستقل، صرفاً منطق ریاضی مقایسهٔ شمارش را با اعداد واقعی می‌سنجد");
  console.log("=".repeat(70));

  function validateMigrationIntegrity(countBefore: number, countAfter: number): { ok: boolean; message?: string } {
    if (countAfter !== countBefore) {
      return {
        ok: false,
        message: `Migration ناقص است: تعداد قبل (${countBefore}) با بعد (${countAfter}) برابر نیست.`,
      };
    }
    return { ok: true };
  }

  const validCase = validateMigrationIntegrity(3, 3);
  assertTrue(validCase.ok, "وقتی تعداد رکورد قبل/بعد برابر است، اعتبارسنجی موفق است");

  const invalidCaseLoss = validateMigrationIntegrity(3, 2);
  assertEqual(invalidCaseLoss.ok, false, "وقتی رکوردی در حین Migration گم شده (۳→۲)، اعتبارسنجی شکست را تشخیص می‌دهد");

  const invalidCaseDuplication = validateMigrationIntegrity(3, 6);
  assertEqual(
    invalidCaseDuplication.ok,
    false,
    "وقتی رکوردها به‌اشتباه تکرار شده‌اند (۳→۶)، اعتبارسنجی این ناهنجاری را هم می‌گیرد"
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
