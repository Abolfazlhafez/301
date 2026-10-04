/**
 * تست تجربی واقعی تابع dataUrlToFile — تبدیل خروجی Camera.getPhoto
 * (Data URL با فرمت "data:image/jpeg;base64,...") به یک File واقعی که
 * بقیهٔ کد پروژه (photoService.upload و غیره) انتظار دارد.
 *
 * این دقیقاً همان قطعه‌ای از usePhotoPicker است که واقعاً منطق دارد (نه
 * صرفاً فراخوانی یک API خارجی) و بیشترین ریسک باگ (بایت‌های خراب، نوع
 * MIME اشتباه) را دارد — بقیهٔ هوک به React/DOM واقعی وابسته است و در
 * این محیط تست مستقیم قابل اجرا نیست.
 */

import { dataUrlToFile } from "../../shared/hooks/usePhotoPicker";

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

// همان PNG معتبر و کمینه که در تست‌های زنجیرهٔ عکس رسید استفاده شده — یک
// تصویر ۱×۱ پیکسل شفاف با magic bytes واقعی.
const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function main() {
  console.log("=".repeat(70));
  console.log("تست ۱: تبدیل یک Data URL معتبر JPEG-mime به File واقعی");
  console.log("=".repeat(70));
  {
    const dataUrl = `data:image/jpeg;base64,${MINIMAL_PNG_BASE64}`;
    const file = dataUrlToFile(dataUrl, "test-photo.jpg");

    assertTrue(file instanceof File, "خروجی واقعاً یک نمونهٔ File است");
    assertEqual(file.name, "test-photo.jpg", "نام فایل دقیقاً همان مقدار پاس‌داده‌شده است");
    assertEqual(file.type, "image/jpeg", "نوع MIME از هدر Data URL به‌درستی استخراج شد");
    assertTrue(file.size > 0, "فایل خروجی حجم غیرصفر دارد (بایت‌ها واقعاً منتقل شدند)");
  }

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۲: بایت‌های فایل خروجی دقیقاً با بایت‌های اصلی base64 یکسان‌اند");
  console.log("   (نه فقط 'یک فایلی' ساخته شد، بلکه محتوا واقعاً درست است)");
  console.log("=".repeat(70));
  {
    const dataUrl = `data:image/png;base64,${MINIMAL_PNG_BASE64}`;
    const file = dataUrlToFile(dataUrl, "receipt.png");

    const originalBytes = Uint8Array.from(atob(MINIMAL_PNG_BASE64), (c) => c.charCodeAt(0));
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    assertEqual(fileBytes.length, originalBytes.length, "طول بایت‌های فایل با طول اصلی یکسان است");
    assertEqual(Array.from(fileBytes), Array.from(originalBytes), "محتوای بایت‌به‌بایت فایل دقیقاً با base64 اصلی یکسان است");

    // بررسی magic bytes واقعی PNG (89 50 4E 47) در ابتدای فایل — این تأیید
    // می‌کند که تصویر تولیدشده واقعاً یک PNG معتبر است، نه فقط بایت‌های تصادفی.
    assertEqual(
      [fileBytes[0], fileBytes[1], fileBytes[2], fileBytes[3]],
      [0x89, 0x50, 0x4e, 0x47],
      "چهار بایت اول فایل خروجی دقیقاً magic bytes استاندارد PNG است"
    );
  }

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۳: نوع MIME نامعتبر/غایب در هدر، به پیش‌فرض امن (image/jpeg) سقوط می‌کند");
  console.log("=".repeat(70));
  {
    // یک هدر عمداً بدون فرمت MIME استاندارد.
    const malformedDataUrl = `data:;base64,${MINIMAL_PNG_BASE64}`;
    const file = dataUrlToFile(malformedDataUrl, "fallback-test.jpg");
    assertEqual(file.type, "image/jpeg", "وقتی MIME از هدر قابل‌استخراج نیست، به‌طور امن روی image/jpeg پیش‌فرض می‌شود");
    assertTrue(file.size > 0, "حتی با هدر ناقص، محتوای فایل همچنان درست منتقل شده است");
  }

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
