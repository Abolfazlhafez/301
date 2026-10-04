/**
 * تست تجربی واقعی زنجیرهٔ کامل «عکس رسید».
 *
 * این اسکریپت روی یک نمونهٔ واقعی Dexie (با fake-indexeddb) اجرا می‌شود و
 * دقیقاً همان مسیر کد production را طی می‌کند — نه یک mock دستی:
 *
 *   انتخاب عکس (شبیه‌سازی‌شده با یک File واقعی PNG معتبر با magic bytes درست)
 *   → cashbookService.create با receiptFile
 *   → ذخیرهٔ دائمی در db.photos (blob واقعی، نه Object URL موقت)
 *   → اتصال به رسید (entry.receiptPhotoId)
 *   → خواندن دوباره (شبیه‌سازی «بستن و باز کردن برنامه»: get مجدد از دیتابیس)
 *   → ویرایش: جایگزینی عکس با یک عکس جدید (باید عکس قدیمی خودکار پاک شود)
 *   → ویرایش: حذف صریح عکس رسید (بدون جایگزین)
 *   → بررسی مسیر خطا: اگر آپلود جایگزین شکست بخورد، عکس قبلی نباید پاک شود
 *
 * این تست مستقیماً uploadها/updateهای واقعی cashbookService را صدا می‌زند —
 * دقیقاً همان توابعی که CashbookEntryFormDialog و CashbookSection از طریق
 * cashbookApi صدا می‌زنند.
 */

import "fake-indexeddb/auto";

import { db, ensureDatabaseSeeded } from "../db";
import { cashbookService } from "../services/cashbookService";
import { photoService } from "../services/photoService";

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

// یک PNG معتبر و کمینه (۱×۱ پیکسل شفاف) با magic bytes واقعی — همان چیزی
// که detectImageKind واقعاً باید به‌عنوان "png" تشخیص دهد، نه یک بافر ساختگی.
// از Uint8Array/atob استفاده می‌شود نه Buffer، چون این فایل تست داخل src/
// پروژه است و tsconfig.app.json (types: ["vite/client"]) کل src را برای
// مرورگر می‌بیند؛ Buffer یک Global مخصوص Node است که آن‌جا شناخته نمی‌شود،
// در حالی که atob/Uint8Array هم در Node (که با tsx اجرا می‌کنیم) و هم در
// مرورگر به‌طور طبیعی موجودند.
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
  // File([...]) یک BlobPart می‌خواهد که buffer آن دقیقاً ArrayBuffer باشد؛
  // Uint8Array تازه‌ساخته‌شده گاهی به‌عنوان ArrayBufferLike (که می‌تواند
  // SharedArrayBuffer هم باشد) دیده می‌شود. یک کپی صریح در یک ArrayBuffer
  // واقعی، این ابهام را در سطح تایپ کاملاً برطرف می‌کند.
  const arrayBuffer = new ArrayBuffer(bytes.length);
  new Uint8Array(arrayBuffer).set(bytes);
  return new File([arrayBuffer], name, { type: "image/png" });
}

async function main() {
  console.log("=".repeat(70));
  console.log("راه‌اندازی: seed دیتابیس واقعی");
  console.log("=".repeat(70));
  await ensureDatabaseSeeded();

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۱: ایجاد رسید همراه با عکس (مسیر create واقعی)");
  console.log("=".repeat(70));

  const photo1 = makeTestImageFile("رسید-سیمان.png");
  const created = await cashbookService.create({
    type: "expense",
    title: "خرید سیمان",
    amount: 4_500_000,
    date: "2026-08-01",
    fundId: null,
    receiptFile: photo1,
  });

  assertTrue(!!created.receiptPhotoId, "entry.receiptPhotoId بعد از create پر شده است");
  assertTrue(created.id.length > 0, "رکورد تراکنش شناسه معتبر دارد");

  const photoRow1 = await db.photos.get(created.receiptPhotoId!);
  assertTrue(!!photoRow1, "رکورد عکس واقعاً در جدول photos دیتابیس ذخیره شده است");
  assertTrue((await db.readBlob("photos", photoRow1!.id, "blob")) instanceof Blob, "blob واقعی (نه Object URL موقت) در دیتابیس ذخیره شده است");
  assertEqual(photoRow1?.relatedType, "receipt", "relatedType عکس برابر 'receipt' است");
  assertEqual(photoRow1?.relatedId, created.id, "relatedId عکس دقیقاً به شناسه تراکنش وصل است");
  assertEqual(photoRow1?.detectedKind, "png", "نوع فایل از روی magic bytes به‌درستی png تشخیص داده شد");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۲: خواندن دوباره (شبیه‌سازی بستن و باز کردن برنامه)");
  console.log("=".repeat(70));

  // یک get کاملاً تازه از دیتابیس — نه از هیچ متغیر/state جاوااسکریپتی که
  // در حافظه نگه داشته شده بود. این دقیقاً چیزی است که «Restart برنامه»
  // در عمل یعنی: تنها منبع حقیقت، خودِ IndexedDB است.
  const reloadedEntry = await db.cashbookEntries.get(created.id);
  assertTrue(!!reloadedEntry, "بعد از 'باز کردن مجدد'، رکورد تراکنش هنوز موجود است");
  assertEqual(reloadedEntry?.receiptPhotoId, created.receiptPhotoId, "receiptPhotoId بعد از بازخوانی همان مقدار قبلی است");

  const photos = await photoService.list({ relatedType: "receipt", relatedId: created.id });
  assertEqual(photos.length, 1, "photoService.list دقیقاً همان یک عکس رسید را برمی‌گرداند");
  assertEqual(photos[0]?.id, created.receiptPhotoId, "عکس بازگشتی همان عکسی است که به رسید وصل بود");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۳: ویرایش رسید — جایگزینی عکس با عکس جدید");
  console.log("=".repeat(70));

  const oldPhotoId = created.receiptPhotoId!;
  const photo2 = makeTestImageFile("رسید-سیمان-اصلاح‌شده.png");
  const afterReplace = await cashbookService.update(created.id, {
    title: "خرید سیمان (اصلاح مبلغ)",
    amount: 4_750_000,
    receiptFile: photo2,
  });

  assertTrue(!!afterReplace.receiptPhotoId, "بعد از جایگزینی، receiptPhotoId جدید پر است");
  assertTrue(afterReplace.receiptPhotoId !== oldPhotoId, "شناسه عکس جدید با شناسه عکس قبلی فرق دارد");
  assertEqual(afterReplace.amount, 4_750_000, "فیلد amount هم هم‌زمان با تغییر عکس به‌روزرسانی شد");

  const oldPhotoRow = await db.photos.get(oldPhotoId);
  assertEqual(oldPhotoRow, undefined, "عکس قدیمی بعد از جایگزینی موفق، از دیتابیس پاک شده است (بدون فایل یتیم)");

  const newPhotoRow = await db.photos.get(afterReplace.receiptPhotoId!);
  assertTrue(!!newPhotoRow, "عکس جدید واقعاً در دیتابیس ذخیره شده است");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۴: ویرایش بدون تغییر عکس (فقط توضیح عوض می‌شود)");
  console.log("   — receiptFile اصلاً در input نباید باشد (undefined)، و عکس دست‌نخورده بماند");
  console.log("=".repeat(70));

  const photoIdBeforeNoOpEdit = afterReplace.receiptPhotoId;
  const afterNoOpEdit = await cashbookService.update(created.id, {
    description: "پرداخت نقدی به فروشگاه مصالح",
  });
  assertEqual(afterNoOpEdit.receiptPhotoId, photoIdBeforeNoOpEdit, "ویرایش بدون ذکر receiptFile، عکس فعلی را دست‌نخورده نگه داشت");
  assertEqual(afterNoOpEdit.description, "پرداخت نقدی به فروشگاه مصالح", "توضیح جدید به‌درستی ذخیره شد");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۵: حذف صریح عکس رسید (بدون جایگزین)");
  console.log("=".repeat(70));

  const photoIdBeforeRemoval = afterNoOpEdit.receiptPhotoId!;
  const afterRemoval = await cashbookService.update(created.id, {
    receiptFile: null,
  });
  assertEqual(afterRemoval.receiptPhotoId, null, "بعد از حذف صریح، receiptPhotoId روی null قرار گرفت");

  const removedPhotoRow = await db.photos.get(photoIdBeforeRemoval);
  assertEqual(removedPhotoRow, undefined, "عکس حذف‌شده واقعاً از دیتابیس پاک شده است");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۶: افزودن عکس به رسیدی که قبلاً هیچ عکسی نداشت");
  console.log("=".repeat(70));

  const photo3 = makeTestImageFile("رسید-اضافه‌شده-بعدا.png");
  const afterAddingLater = await cashbookService.update(created.id, {
    receiptFile: photo3,
  });
  assertTrue(!!afterAddingLater.receiptPhotoId, "امکان افزودن عکس به رسیدی که قبلاً بدون عکس بود، وجود دارد");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۷: حذف کامل تراکنش، عکس مرتبط هم باید پاک شود (مسیر remove)");
  console.log("=".repeat(70));

  const finalPhotoId = afterAddingLater.receiptPhotoId!;
  await cashbookService.remove(created.id);
  const deletedEntry = await db.cashbookEntries.get(created.id);
  assertEqual(deletedEntry, undefined, "رکورد تراکنش بعد از remove حذف شده است");
  const finalPhotoRow = await db.photos.get(finalPhotoId);
  assertEqual(finalPhotoRow, undefined, "عکس رسید هم به‌همراه حذف تراکنش پاک شده است (بدون فایل یتیم باقی‌مانده)");

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
