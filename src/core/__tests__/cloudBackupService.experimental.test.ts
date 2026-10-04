/**
 * تست تجربی واقعی منطق تصمیم‌گیری cloudBackupService.runCloudBackupIfDue —
 * یعنی همان شرط‌هایی که *قبل* از هر تماس شبکه‌ای واقعی چک می‌شوند: آیا
 * بکاپ ابری فعال است، آیا تنظیمات کامل است، آیا از آخرین بکاپ به‌اندازهٔ
 * کافی گذشته. این‌ها دقیقاً همان منطقی هستند که تعیین می‌کنند آیا اصلاً
 * تلاش برای اتصال به Supabase انجام شود یا نه — بدون این تست، یک باگ در
 * این شرط‌ها می‌تواند باعث شود بکاپ ابری هرگز اجرا نشود (یا برعکس، هر بار
 * resume شدن اپ بی‌مورد اجرا شود) بدون این‌که هیچ‌کس متوجه شود، چون خطای
 * شبکهٔ واقعی هم همیشه بی‌صدا catch می‌شود.
 *
 * توجه: این تست عمداً *بدون* سرور Supabase واقعی اجرا می‌شود — چون در
 * این محیط چت دسترسی به یک پروژهٔ واقعی Supabase وجود ندارد. بخش‌هایی
 * که واقعاً درخواست شبکه می‌زنند (createClient().from().upsert روی یک
 * URL جعلی) قاعدتاً با خطای شبکه شکست می‌خورند و توسط try/catch داخلی
 * runCloudBackupIfDue بی‌صدا بلعیده می‌شوند — این تست همان رفتار
 * «بی‌صدا شکست بخور، برنامه را مختل نکن» را هم تأیید می‌کند.
 */

import "fake-indexeddb/auto";

import { db, ensureDatabaseSeeded } from "../db";
import { settingsService } from "../services/settingsService";
import { cloudBackupService } from "../services/cloudBackupService";

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
  console.log("راه‌اندازی دیتابیس واقعی");
  console.log("=".repeat(70));
  await ensureDatabaseSeeded();

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۱: وقتی بکاپ ابری غیرفعال است، runCloudBackupIfDue هرگز throw نمی‌کند");
  console.log("   و lastCloudBackupAt تغییر نمی‌کند (یعنی اصلاً تلاشی برای اتصال نکرد)");
  console.log("=".repeat(70));

  const initialSettings = await settingsService.get();
  assertEqual(initialSettings.cloudBackupEnabled, false, "بکاپ ابری به‌طور پیش‌فرض غیرفعال است");
  assertEqual(initialSettings.lastCloudBackupAt, undefined, "هنوز هیچ بکاپ ابری‌ای انجام نشده");

  let threwWhileDisabled = false;
  try {
    await cloudBackupService.runCloudBackupIfDue();
  } catch {
    threwWhileDisabled = true;
  }
  assertEqual(threwWhileDisabled, false, "runCloudBackupIfDue با بکاپ ابری غیرفعال، throw نمی‌کند");

  const afterDisabledRun = await settingsService.get();
  assertEqual(afterDisabledRun.lastCloudBackupAt, undefined, "با بکاپ ابری غیرفعال، lastCloudBackupAt هنوز تنظیم نشده (تلاشی برای اتصال نشد)");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۲: بکاپ ابری فعال ولی بدون URL/کلید معتبر — هنوز نباید throw کند");
  console.log("=".repeat(70));

  // این حالت معمولاً از طریق UI رخ نمی‌دهد (چون updateCloudBackupSettings
  // اعتبارسنجی می‌کند)، اما مستقیماً در دیتابیس شبیه‌سازی می‌کنیم تا
  // مطمئن شویم لایهٔ سرویس هم به‌تنهایی در برابر این حالت مقاوم است —
  // دفاع در عمق، نه فقط تکیه به اعتبارسنجی لایهٔ بالاتر.
  await db.settings.update("app-settings", { cloudBackupEnabled: true, cloudBackupSupabaseUrl: "", cloudBackupSupabaseAnonKey: "" });

  let threwWithEmptyConfig = false;
  try {
    await cloudBackupService.runCloudBackupIfDue();
  } catch {
    threwWithEmptyConfig = true;
  }
  assertEqual(threwWithEmptyConfig, false, "با URL/کلید خالی، runCloudBackupIfDue همچنان throw نمی‌کند");

  const afterEmptyConfigRun = await settingsService.get();
  assertEqual(afterEmptyConfigRun.lastCloudBackupAt, undefined, "با تنظیمات ناقص، تلاشی برای اتصال واقعی نشد");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۳: بکاپ ابری فعال با URL/کلید (جعلی، غیرواقعی) — تلاش می‌کند اما خطای");
  console.log("   شبکه را بی‌صدا می‌بلعد (چون سرور واقعی در این تست وجود ندارد)");
  console.log("=".repeat(70));

  await db.settings.update("app-settings", {
    cloudBackupSupabaseUrl: "https://this-project-does-not-exist-xyz123.supabase.co",
    cloudBackupSupabaseAnonKey: "fake-anon-key-for-testing",
  });

  let threwWithFakeServer = false;
  try {
    await cloudBackupService.runCloudBackupIfDue();
  } catch {
    threwWithFakeServer = true;
  }
  assertEqual(threwWithFakeServer, false, "حتی با سرور غیرواقعی (خطای شبکهٔ واقعی)، runCloudBackupIfDue بیرون throw نمی‌کند");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۴: تست اتصال (testConnection) با سرور غیرواقعی، ok=false برمی‌گرداند");
  console.log("   (نه throw می‌کند، نه ok=true اشتباه می‌دهد)");
  console.log("=".repeat(70));

  const testResult = await cloudBackupService.testConnection(
    "https://this-project-does-not-exist-xyz123.supabase.co",
    "fake-anon-key-for-testing"
  );
  assertEqual(testResult.ok, false, "تست اتصال با سرور غیرواقعی، ok=false برمی‌گرداند");
  assertTrue(testResult.message.length > 0, "پیام خطای قابل‌فهم همراه با نتیجه برگردانده شد");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۵: منطق فاصلهٔ زمانی — اگر lastCloudBackupAt خیلی اخیر باشد، تلاش مجدد نمی‌شود");
  console.log("=".repeat(70));

  const recentTimestamp = new Date().toISOString(); // همین الان
  await db.settings.update("app-settings", { lastCloudBackupAt: recentTimestamp, cloudBackupIntervalHours: 24 });

  const settingsBeforeSecondRun = await settingsService.get();
  assertEqual(settingsBeforeSecondRun.lastCloudBackupAt, recentTimestamp, "lastCloudBackupAt به‌درستی تنظیم شد (برای شبیه‌سازی بکاپ اخیر)");

  await cloudBackupService.runCloudBackupIfDue();

  const settingsAfterSecondRun = await settingsService.get();
  assertEqual(
    settingsAfterSecondRun.lastCloudBackupAt,
    recentTimestamp,
    "چون کمتر از ۲۴ ساعت از آخرین بکاپ گذشته، runCloudBackupIfDue حتی تلاش هم نکرد (lastCloudBackupAt تغییر نکرد)"
  );

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));

  if (failed > 0) {
    throw new Error(`${failed} بررسی ناموفق بود.`);
  }
}

// این تست به‌صورت واقعی به یک دامنهٔ Supabase غیرواقعی درخواست می‌زند تا
// مسیر خطای شبکه را (نه فقط شرط‌های early-return) هم بسنجد. اگر شبکهٔ CI
// به هر دلیلی به‌جای رد سریع، درخواست را برای مدتی طولانی معلق نگه دارد
// (که در محیط‌های محدودشدهٔ شبکه گاهی رخ می‌دهد)، این سقف زمانی مطمئن
// می‌شود کل مجموعهٔ تست هرگز برای همیشه در انتظار نمی‌ماند.
const HARD_TIMEOUT_MS = 45_000;

const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error(`تست از سقف زمانی ${HARD_TIMEOUT_MS / 1000} ثانیه عبور کرد.`)), HARD_TIMEOUT_MS);
});

Promise.race([main(), timeoutPromise]).catch((err) => {
  console.error("خطای اجرای تست:", err);
  throw err;
});
