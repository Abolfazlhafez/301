/**
 * تست تجربی: فهرست BACKUP_TABLE_NAMES باید همین الان، روی schema واقعی و
 * دست‌نخوردهٔ db.ts، کامل باشد — یعنی assertBackupTableListIsComplete()
 * نباید هیچ خطایی بدهد.
 *
 * چرا این تست از backupTableValidation.experimental.test.ts جداست: آن تست
 * یک جدول جعلی اضافه می‌کند و فقط بررسی می‌کند که وجود *آن* جدول جعلی در
 * پیام خطا ذکر می‌شود — یعنی حتی اگر جدول‌های واقعی دیگری (غیر از جدول
 * جعلی) از قبل در BACKUP_TABLE_NAMES فراموش شده باشند، آن تست همچنان سبز
 * می‌ماند، چون هدفش فقط تشخیصِ «افزودن یک جدول جدید» است، نه اعتبارسنجی کل
 * لیست. دقیقاً همین شکاف باعث شد جدول‌های workerGroups و groupWagePayments
 * (وقتی فیچر گروه‌های نیرو اضافه شد) هفته‌ها در BACKUP_TABLE_NAMES نبودند و
 * هیچ تستی متوجه نشد — نتیجه‌اش این بود که هم «دانلود فایل پشتیبان» هم بکاپ
 * خودکار دوره‌ای، از همان لحظه، برای هر کاربری همیشه با خطا شکست می‌خوردند
 * (بکاپ خودکار چون بی‌صدا catch می‌شد، حتی توستی هم نشان نمی‌داد).
 *
 * این تست آن شکاف را می‌بندد: مستقیماً روی همان db واقعی (بدون هیچ جدول
 * جعلی اضافه‌شده)، assertBackupTableListIsComplete() را صدا می‌زند و انتظار
 * دارد خطایی پرتاب نشود. از این به بعد، هر بار توسعه‌دهنده‌ای جدول جدیدی به
 * db.ts اضافه کند ولی فراموش کند آن را به BACKUP_TABLE_NAMES (یا در صورت
 * عمدی‌بودن، DEVICE_ONLY_TABLE_NAMES) در backupService.ts هم اضافه کند،
 * همین‌جا و در CI/pre-commit — نه فقط وقتی یک کاربر واقعی دکمهٔ بکاپ را
 * می‌زند — متوجه می‌شود.
 */

import "fake-indexeddb/auto";

import { ensureDatabaseSeeded } from "../db";
import { assertBackupTableListIsComplete, BACKUP_TABLE_NAMES } from "../services/backupService";

let passed = 0;
let failed = 0;

function assertTrue(condition: boolean, testName: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}`);
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("تست: BACKUP_TABLE_NAMES باید همین الان با schema واقعی db یکی باشد");
  console.log("=".repeat(70));

  await ensureDatabaseSeeded();

  assertTrue(BACKUP_TABLE_NAMES.length > 0, "BACKUP_TABLE_NAMES خالی نیست (خودِ import درست کار کرده)");

  let threw = false;
  let errorMessage = "";
  try {
    assertBackupTableListIsComplete();
  } catch (err) {
    threw = true;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  assertTrue(
    !threw,
    threw
      ? `assertBackupTableListIsComplete() روی schema واقعی خطا داد (یعنی جدولی فراموش شده): ${errorMessage}`
      : "assertBackupTableListIsComplete() روی schema واقعی هیچ خطایی نداد"
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
