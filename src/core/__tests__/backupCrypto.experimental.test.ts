/**
 * تست تجربی مستقل ماژول رمزنگاری backupCrypto.ts — قبل از وصل‌شدن به
 * backupService، خودِ منطق رمزنگاری/رمزگشایی را با داده و رمز عبور واقعی
 * بررسی می‌کند.
 */

import {
  generateDeviceKeyBase64,
  encryptWithDeviceKey,
  decryptWithDeviceKey,
  encryptWithPassword,
  decryptWithPassword,
  isEncryptedPayloadShape,
} from "../services/backupCrypto";

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
  const samplePlaintext = JSON.stringify({
    app: "karegah-yar",
    workers: [{ firstName: "رضا", lastName: "احمدی", phoneNumber: "09121234567" }],
    note: "این یک متن نمونهٔ فارسی با کاراکترهای خاص است: ۱۲۳۴۵ - ٪ ! ؟",
  });

  console.log("=".repeat(70));
  console.log("تست ۱: رمزنگاری/رمزگشایی با کلید دستگاهی");
  console.log("=".repeat(70));
  {
    const deviceKey = generateDeviceKeyBase64();
    assertTrue(deviceKey.length > 0, "کلید دستگاهی تولید شد");

    const encrypted = await encryptWithDeviceKey(samplePlaintext, deviceKey);
    assertEqual(encrypted.keySource, "device", "keySource برابر 'device' است");
    assertTrue(isEncryptedPayloadShape(encrypted), "خروجی رمزنگاری شکل EncryptedPayload معتبر دارد");
    assertTrue(
      !encrypted.ciphertextBase64.includes("کارگاه") && !encrypted.ciphertextBase64.includes("رضا"),
      "متن رمزنگاری‌شده هیچ ردی از متن اصلی خوانا ندارد"
    );

    const decrypted = await decryptWithDeviceKey(encrypted, deviceKey);
    assertEqual(decrypted, samplePlaintext, "رمزگشایی با همان کلید دستگاهی، متن اصلی را دقیقاً بازمی‌گرداند");
  }

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۲: کلید دستگاهی اشتباه نباید رمزگشایی موفق بدهد");
  console.log("=".repeat(70));
  {
    const deviceKey1 = generateDeviceKeyBase64();
    const deviceKey2 = generateDeviceKeyBase64();
    const encrypted = await encryptWithDeviceKey(samplePlaintext, deviceKey1);

    let threw = false;
    try {
      await decryptWithDeviceKey(encrypted, deviceKey2);
    } catch {
      threw = true;
    }
    assertTrue(threw, "رمزگشایی با کلید دستگاهی نادرست، خطا پرتاب می‌کند (نه یک خروجی خراب بی‌صدا)");
  }

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۳: رمزنگاری/رمزگشایی با رمز عبور کاربر");
  console.log("=".repeat(70));
  {
    const password = "رمز-عبور-قوی-۱۲۳۴";
    const encrypted = await encryptWithPassword(samplePlaintext, password);
    assertEqual(encrypted.keySource, "password", "keySource برابر 'password' است");
    assertTrue(encrypted.saltBase64.length > 0, "salt برای مشتق‌سازی کلید تولید و ذخیره شده است");
    assertTrue(encrypted.iterations >= 100_000, "تعداد تکرار PBKDF2 در محدودهٔ امن (حداقل ۱۰۰٬۰۰۰) است");

    const decrypted = await decryptWithPassword(encrypted, password);
    assertEqual(decrypted, samplePlaintext, "رمزگشایی با همان رمز عبور، متن اصلی را دقیقاً بازمی‌گرداند");
  }

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۴: رمز عبور اشتباه باید خطای مشخص بدهد، نه خروجی نامفهوم");
  console.log("=".repeat(70));
  {
    const encrypted = await encryptWithPassword(samplePlaintext, "رمز-درست");
    let threw = false;
    let errorMessage = "";
    try {
      await decryptWithPassword(encrypted, "رمز-غلط");
    } catch (err) {
      threw = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    assertTrue(threw, "رمزگشایی با رمز عبور نادرست خطا پرتاب می‌کند");
    assertTrue(errorMessage.includes("رمز عبور") || errorMessage.includes("خراب"), "پیام خطا برای کاربر قابل‌فهم است");
  }

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۵: دستکاری متن رمزنگاری‌شده باید توسط تگ احراز اصالت GCM شناسایی شود");
  console.log("   (این دقیقاً همان 'Integrity Check' خواسته‌شده در پرامپت است)");
  console.log("=".repeat(70));
  {
    const deviceKey = generateDeviceKeyBase64();
    const encrypted = await encryptWithDeviceKey(samplePlaintext, deviceKey);

    // یک بایت از وسط متن رمزنگاری‌شده را دستکاری می‌کنیم — دقیقاً شبیه‌سازی
    // یک فایل بکاپ که توسط یک ابزار خارجی یا حین انتقال خراب/دستکاری شده.
    const tampered = { ...encrypted, ciphertextBase64: encrypted.ciphertextBase64.slice(0, -4) + "XXXX" };

    let threw = false;
    try {
      await decryptWithDeviceKey(tampered, deviceKey);
    } catch {
      threw = true;
    }
    assertTrue(threw, "دستکاری متن رمزنگاری‌شده باعث شکست رمزگشایی می‌شود (تشخیص خودکار دستکاری)");
  }

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۶: دو رمزنگاری متوالی از یک متن یکسان، دو خروجی متفاوت می‌دهند");
  console.log("   (IV تصادفی — یعنی الگوی متن ثابت در بکاپ‌های مختلف قابل تشخیص نیست)");
  console.log("=".repeat(70));
  {
    const deviceKey = generateDeviceKeyBase64();
    const encrypted1 = await encryptWithDeviceKey(samplePlaintext, deviceKey);
    const encrypted2 = await encryptWithDeviceKey(samplePlaintext, deviceKey);
    assertTrue(
      encrypted1.ciphertextBase64 !== encrypted2.ciphertextBase64,
      "دو رمزنگاری از همان متن با همان کلید، ciphertext متفاوت تولید می‌کنند (IV تصادفی)"
    );
    // ولی هر دو باید درست رمزگشایی شوند.
    const d1 = await decryptWithDeviceKey(encrypted1, deviceKey);
    const d2 = await decryptWithDeviceKey(encrypted2, deviceKey);
    assertEqual(d1, samplePlaintext, "رمزگشایی خروجی اول درست است");
    assertEqual(d2, samplePlaintext, "رمزگشایی خروجی دوم هم درست است");
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
