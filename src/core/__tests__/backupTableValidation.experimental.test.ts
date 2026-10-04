/**
 * تست تجربی مکانیزم اعتبارسنجی «فهرست جدول‌های بکاپ کامل است».
 *
 * این تست به‌جای ساختن یک کپی جداگانه از db.ts (که با backupService.ts
 * واقعی هیچ ارتباطی نمی‌داشت و عملاً چیز اشتباهی را تست می‌کرد)، مستقیماً
 * روی همان نمونهٔ db واقعی پروژه یک جدول جدید در زمان اجرا (runtime) به
 * schema اضافه می‌کند — این دقیقاً شبیه‌سازی روزی است که یک توسعه‌دهنده
 * جدول جدیدی را در db.ts واقعی اضافه می‌کند اما فراموش می‌کند آن را به
 * BACKUP_TABLE_NAMES در backupService.ts هم اضافه کند.
 *
 * نکتهٔ فنی: Dexie اجازه می‌دهد بعد از import شدن یک نمونهٔ دیتابیس، تا
 * قبل از باز شدن واقعی آن (اولین تراکنش/کوئری)، نسخه‌های schema بیشتری
 * هم به همان نمونه اضافه شوند. این تست از همین ویژگی استفاده می‌کند تا
 * import اصلی db و backupService (که در پروژهٔ واقعی هم دقیقاً همین دو
 * فایل‌اند، نه کپی) دست‌نخورده بماند.
 */

import "fake-indexeddb/auto";

import { db, ensureDatabaseSeeded } from "../db";
import { backupService, assertBackupTableListIsComplete } from "../services/backupService";

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
  console.log("راه‌اندازی: افزودن یک جدول جدید به schema واقعی db، در زمان اجرا");
  console.log("   (شبیه‌سازی: توسعه‌دهنده جدول جدید اضافه کرده، فراموش کرده");
  console.log("   آن را به BACKUP_TABLE_NAMES در backupService.ts هم اضافه کند)");
  console.log("=".repeat(70));

  // این خط باید قبل از هر تراکنش/کوئری روی db اجرا شود — قبل از
  // ensureDatabaseSeeded (که خودش اولین باعث باز شدن واقعی دیتابیس می‌شود).
  db.version(12).stores({ _testForgottenTable: "id" });

  await ensureDatabaseSeeded();

  // یک رکورد واقعی در جدول فراموش‌شده می‌گذاریم — با db.table() که به هر
  // جدولی با نام رشته‌ای دسترسی می‌دهد، حتی جدول‌هایی که در کلاس
  // KaregahYarDatabase به‌عنوان property تعریف نشده‌اند (این خودش دقیقاً
  // همان چیزی است که پرامپت نگرانش بود: جدولی که در TypeScript تعریف
  // نشده اما در دیتابیس واقعی وجود دارد و داده دارد).
  await db.table("_testForgottenTable").add({ id: "test-1", secretData: "این داده نباید بی‌صدا گم شود" });
  const countBefore = await db.table("_testForgottenTable").count();
  assertTrue(countBefore === 1, "جدول تازه‌اضافه‌شده حاوی یک رکورد واقعی است");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۱: فراخوانی مستقیم assertBackupTableListIsComplete خطا می‌دهد");
  console.log("=".repeat(70));

  let threwDirect = false;
  let directErrorMessage = "";
  try {
    assertBackupTableListIsComplete();
  } catch (err) {
    threwDirect = true;
    directErrorMessage = err instanceof Error ? err.message : String(err);
  }
  assertTrue(threwDirect, "assertBackupTableListIsComplete() مستقیماً خطا پرتاب کرد");
  assertTrue(
    directErrorMessage.includes("_testForgottenTable"),
    "پیام خطا دقیقاً نام جدول فراموش‌شده را ذکر می‌کند"
  );
  assertTrue(
    directErrorMessage.includes("BACKUP_TABLE_NAMES"),
    "پیام خطا مکان دقیق رفع مشکل (BACKUP_TABLE_NAMES) را می‌گوید"
  );

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۲: exportAll() واقعی هم به‌خاطر همین جدول خطا می‌دهد");
  console.log("   (نه فقط تابع اعتبارسنجی مجزا، بلکه کل مسیر Backup واقعی)");
  console.log("=".repeat(70));

  let threwViaExport = false;
  try {
    await backupService.exportAll();
  } catch {
    threwViaExport = true;
  }
  assertTrue(threwViaExport, "exportAll() هم خطا می‌دهد — بکاپ ناقص هرگز ساخته نشد");

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
