/**
 * تست تجربی واقعی: عکس رسید باید پس از یک چرخهٔ کامل Backup → پاک‌سازی
 * دیتابیس → Restore، دقیقاً سالم و قابل‌بازیابی بماند.
 *
 * این دقیقاً همان الزام صریح پرامپت اصلی است: «پس از Backup و Restore
 * قابل بازیابی باشد» و «کل زنجیره را اصلاح کن: ... → Backup → Restore →
 * نمایش مجدد». نه فقط این‌که Backup تولید شود، بلکه بعد از Restore واقعی،
 * خودِ بایت‌های عکس (نه فقط شناسهٔ آن) باید یکسان با قبل باشد.
 *
 * مسیر: backupService.exportAll() و importAll() — همان دو تابعی که دکمهٔ
 * «تهیه پشتیبان» و «بازیابی از فایل» در صفحهٔ تنظیمات صدا می‌زنند.
 */

import "fake-indexeddb/auto";

// --- Polyfill حداقلی FileReader برای محیط Node ---
// backupService.ts (و blobToBase64 داخل آن) از FileReader استفاده می‌کند که
// یک API استاندارد مرورگری است و در Node.js وجود ندارد — بر خلاف Blob/File/
// URL.createObjectURL که در Node ۲۰+ به‌صورت بومی موجودند. این polyfill فقط
// دقیقاً همان دو متد (readAsDataURL + رویدادهای onloadend/onerror) را که
// backupService.ts واقعاً استفاده می‌کند پیاده می‌کند، تا بتوان مسیر واقعی
// production را (بدون هیچ تغییری در خودِ backupService.ts) در این محیط تست
// اجرا کرد. خودِ برنامه همیشه در مرورگر/WebView اجرا می‌شود که FileReader
// واقعی آن‌جا از قبل موجود است؛ این polyfill صرفاً برای اجراپذیری تست است.
class NodeFileReaderPolyfill {
  onloadend: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  result: string | ArrayBuffer | null = null;

  readAsDataURL(blob: Blob): void {
    blob
      .arrayBuffer()
      .then((buf) => {
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        this.result = `data:${blob.type || "application/octet-stream"};base64,${base64}`;
        this.onloadend?.();
      })
      .catch((err) => this.onerror?.(err));
  }
}
(globalThis as { FileReader?: unknown }).FileReader ??= NodeFileReaderPolyfill;

import { db, ensureDatabaseSeeded } from "../db";
import { cashbookService } from "../services/cashbookService";
import { backupService } from "../services/backupService";

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

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function makeTestImageFile(name: string): File {
  const bytes = base64ToUint8Array(MINIMAL_PNG_BASE64);
  const arrayBuffer = new ArrayBuffer(bytes.length);
  new Uint8Array(arrayBuffer).set(bytes);
  return new File([arrayBuffer], name, { type: "image/png" });
}

/** یک Blob را به رشتهٔ base64 تبدیل می‌کند تا محتوای دو Blob قابل مقایسهٔ مستقیم باشد. */
async function blobToBase64ForComparison(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function main() {
  console.log("=".repeat(70));
  console.log("راه‌اندازی: seed دیتابیس واقعی");
  console.log("=".repeat(70));
  await ensureDatabaseSeeded();

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۱: ساخت یک رسید واقعی همراه با عکس، قبل از گرفتن Backup");
  console.log("=".repeat(70));

  const originalPhotoFile = makeTestImageFile("رسید-قبل-از-بکاپ.png");
  const entryBeforeBackup = await cashbookService.create({
    type: "expense",
    title: "خرید میلگرد",
    amount: 12_300_000,
    date: "2026-08-10",
    fundId: null,
    description: "برای اسکلت طبقه دوم",
    receiptFile: originalPhotoFile,
  });

  assertTrue(!!entryBeforeBackup.receiptPhotoId, "رسید قبل از بکاپ، عکس دارد");
  const originalPhotoRow = await db.photos.get(entryBeforeBackup.receiptPhotoId!);
  assertTrue(!!originalPhotoRow, "رکورد عکس قبل از بکاپ در دیتابیس موجود است");
  const originalBlobBase64 = await blobToBase64ForComparison((await db.readBlob("photos", originalPhotoRow!.id, "blob"))!);

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۲: گرفتن Backup واقعی (همان مسیر دکمهٔ 'تهیه پشتیبان')");
  console.log("   — و تأیید این‌که فایل رمزنگاری‌شده است (نه JSON خام و خوانا)");
  console.log("=".repeat(70));

  const backupBlob = await backupService.exportAll();
  assertTrue(backupBlob instanceof Blob, "خروجی exportAll یک Blob واقعی است");
  assertTrue(backupBlob.size > 0, "فایل بکاپ خالی نیست");

  const backupJsonText = await backupBlob.text();
  // فرمت نسخهٔ ۲: خط اول هدر آشکار است و بقیهٔ خط‌ها تکه‌های رمزنگاری‌شده
  const backupParsed = JSON.parse(backupJsonText.split("\n")[0]);

  // این دقیقاً همان الزام امنیتی صریح پرامپت اصلی است: «اطلاعات کاربر نباید
  // با باز کردن ساده فایل Backup قابل مشاهده باشد». پس هیچ‌کدام از داده‌های
  // واقعی (نام تراکنش، مبلغ، توضیحات) نباید به‌صورت متن خوانا در فایل باشند.
  assertTrue(backupParsed.encrypted === true, "فایل بکاپ به‌صورت صریح رمزنگاری‌شده علامت‌گذاری شده است");
  assertTrue(
    typeof backupParsed.tables === "undefined",
    "ساختار داخلی tables/photos دیگر مستقیماً در فایل قابل مشاهده نیست (هر تکه جداگانه رمزنگاری شده است)"
  );
  assertTrue(
    !backupJsonText.includes("خرید میلگرد") && !backupJsonText.includes("اسکلت طبقه دوم"),
    "متن خام عنوان/توضیح تراکنش در هیچ‌کجای فایل بکاپ به‌صورت خوانا وجود ندارد"
  );
  assertTrue(
    !backupJsonText.includes("12300000") && !backupJsonText.includes("12,300,000"),
    "مبلغ تراکنش به‌صورت خوانا در فایل بکاپ وجود ندارد"
  );
  assertEqual(backupParsed.keySource, "device", "بکاپ دستی بدون رمز عبور، با کلید دستگاهی رمزنگاری شده است");

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۳: پاک‌سازی کامل دیتابیس (شبیه‌سازی نصب روی دستگاه جدید / از دست رفتن داده)");
  console.log("=".repeat(70));

  await db.cashbookEntries.clear();
  await db.photos.clear();
  const entriesAfterClear = await db.cashbookEntries.count();
  const photosAfterClear = await db.photos.count();
  assertEqual(entriesAfterClear, 0, "بعد از پاک‌سازی، هیچ تراکنشی باقی نمانده (شرط لازم برای تست معنادار Restore)");
  assertEqual(photosAfterClear, 0, "بعد از پاک‌سازی، هیچ عکسی باقی نمانده");

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۴: Restore از همان فایل بکاپ (همان مسیر دکمهٔ 'بازیابی از فایل')");
  console.log("=".repeat(70));

  const backupAsFile = new File([backupBlob], "karegah-yar-backup-test.json", { type: "application/json" });
  await backupService.importAll(backupAsFile);

  const restoredEntry = await db.cashbookEntries.get(entryBeforeBackup.id);
  assertTrue(!!restoredEntry, "تراکنش رسید بعد از Restore دوباره در دیتابیس موجود است");
  assertEqual(restoredEntry?.title, "خرید میلگرد", "عنوان تراکنش بعد از Restore دقیقاً همان قبلی است");
  assertEqual(restoredEntry?.amount, 12_300_000, "مبلغ تراکنش بعد از Restore دقیقاً همان قبلی است");
  assertEqual(restoredEntry?.receiptPhotoId, entryBeforeBackup.receiptPhotoId, "receiptPhotoId بعد از Restore همان شناسهٔ قبلی است");

  const restoredPhotoRow = await db.photos.get(entryBeforeBackup.receiptPhotoId!);
  assertTrue(!!restoredPhotoRow, "رکورد عکس رسید بعد از Restore دوباره در دیتابیس موجود است");
  assertTrue((await db.readBlob("photos", restoredPhotoRow!.id, "blob")) instanceof Blob, "بعد از Restore، فیلد blob دوباره یک Blob واقعی است (نه رشتهٔ base64 خام)");

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۵: بررسی نهایی — خودِ بایت‌های عکسِ بازیابی‌شده دقیقاً با عکس اصلی یکسان‌اند");
  console.log("   (نه فقط این‌که 'یک عکسی' هست، بلکه همان عکس دقیق، بدون خرابی در انتقال base64)");
  console.log("=".repeat(70));

  const restoredBlobBase64 = await blobToBase64ForComparison((await db.readBlob("photos", restoredPhotoRow!.id, "blob"))!);
  assertEqual(restoredBlobBase64, originalBlobBase64, "بایت‌به‌بایت عکس بازیابی‌شده با عکس اصلی قبل از بکاپ یکسان است");
  assertEqual(restoredPhotoRow?.mimeType, originalPhotoRow?.mimeType, "mimeType عکس بعد از Restore حفظ شده است");
  assertEqual(restoredPhotoRow?.relatedType, "receipt", "relatedType عکس بعد از Restore هنوز 'receipt' است");
  assertEqual(restoredPhotoRow?.relatedId, entryBeforeBackup.id, "relatedId عکس بعد از Restore هنوز به همان تراکنش وصل است");

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۶: بکاپ با رمز عبور کاربر — و رد شدن Restore بدون رمز صحیح");
  console.log("=".repeat(70));

  const passwordProtectedBlob = await backupService.exportAll("رمز-قوی-من-۱۳۴۵");
  const passwordProtectedText = await passwordProtectedBlob.text();
  const passwordProtectedParsed = JSON.parse(passwordProtectedText.split("\n")[0]);
  assertEqual(passwordProtectedParsed.keySource, "password", "با دادن رمز عبور، keySource برابر 'password' است");

  const passwordFile = new File([passwordProtectedBlob], "backup-with-password.json", { type: "application/json" });

  let threwWithoutPassword = false;
  try {
    await backupService.importAll(passwordFile); // بدون دادن رمز عبور
  } catch {
    threwWithoutPassword = true;
  }
  assertTrue(threwWithoutPassword, "Restore بدون دادن رمز عبور برای فایل رمزدار، خطا می‌دهد (نه سکوت یا داده خراب)");

  let threwWithWrongPassword = false;
  try {
    await backupService.importAll(passwordFile, "رمز-اشتباه");
  } catch {
    threwWithWrongPassword = true;
  }
  assertTrue(threwWithWrongPassword, "Restore با رمز عبور نادرست، خطا می‌دهد");

  // حالا Restore واقعی با رمز درست — باید کاملاً موفق باشد.
  await db.cashbookEntries.clear();
  await db.photos.clear();
  await backupService.importAll(passwordFile, "رمز-قوی-من-۱۳۴۵");
  const restoredWithPassword = await db.cashbookEntries.get(entryBeforeBackup.id);
  assertTrue(!!restoredWithPassword, "Restore با رمز عبور صحیح، تراکنش را به‌درستی بازمی‌گرداند");

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۷: سازگاری عقب‌رو — فایل بکاپ قدیمی (رمزنگاری‌نشده) هنوز قابل Restore است");
  console.log("   (کاربرانی که قبل از افزوده‌شدن رمزنگاری بکاپ گرفته‌اند نباید داده‌شان را از دست بدهند)");
  console.log("=".repeat(70));

  const legacyPlainBackup = {
    app: "karegah-yar",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      workers: [],
      attendances: [],
      breakTimes: [],
      timeLosses: [],
      equipment: [],
      equipmentAssignments: [],
      ledgerEntries: [],
      cashbookEntries: [
        {
          id: "legacy-entry-1",
          type: "expense",
          title: "یک تراکنش قدیمی از قبل از رمزنگاری",
          amount: 500000,
          date: "2025-01-01",
          description: null,
          fundId: "legacy-fund",
          workerId: null,
          receiptPhotoId: null,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      cashboxFunds: [
        {
          id: "legacy-fund",
          name: "صندوق قدیمی",
          description: null,
          isDefault: true,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      optionalLeaves: [],
      jobTypes: [],
      wageMethods: [],
      wageAssignments: [],
      wageCalculations: [],
      settings: [],
      photos: [],
      pictureCards: [],
      futureActivities: [],
      guardShifts: [],
      dailyReportNotes: [],
      workLogNotes: [],
    },
  };
  const legacyFile = new File([JSON.stringify(legacyPlainBackup)], "legacy-plain-backup.json", {
    type: "application/json",
  });
  await backupService.importAll(legacyFile);
  const legacyRestored = await db.cashbookEntries.get("legacy-entry-1");
  assertTrue(!!legacyRestored, "فایل بکاپ قدیمی (بدون رمزنگاری) همچنان با موفقیت Restore می‌شود");
  assertEqual(legacyRestored?.title, "یک تراکنش قدیمی از قبل از رمزنگاری", "محتوای فایل قدیمی درست بازیابی شد");

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
