/**
 * تست تجربی واقعی برای دو باگ واقعی مرتبط با guardShiftService.findByWorkerAndDate:
 *
 * ۱) باگ گزارش‌شده توسط کاربر — «KeyPath [workerId+date] on object store
 *    guardShifts is not indexed». ریشه: ایندکس ترکیبی [workerId+date] از
 *    نسخهٔ ۵ وجود داشت، اما در نسخهٔ ۲۰ (هنگام افزودن فیلد projectId به
 *    همین جدول) از stores() جا افتاد. در Dexie هر versionی که یک جدول را
 *    دوباره تعریف می‌کند باید کل فهرست ایندکس‌های آن را کامل بنویسد؛
 *    ایندکس‌های نیامده حذف می‌شوند. رفع: نسخهٔ ۲۳ که ایندکس را برمی‌گرداند.
 *
 * ۲) باگ ایزوله‌سازی پروژه که ضمن بررسی مورد ۱ پیدا شد: findByWorkerAndDate
 *    برخلاف list() (که صریحاً با projectId فیلتر می‌شود) هیچ فیلتر پروژه‌ای
 *    نداشت. چون یک نیرو می‌تواند هم‌زمان به چند پروژه لینک باشد
 *    (projectWorkers، رابطهٔ many-to-many)، اگر همان نیرو در پروژهٔ دیگری هم
 *    نوبت نگهبانی همان تاریخ داشته باشد، آن نوبت هم برمی‌گشت و گزارش
 *    روزانه/ماهانهٔ پروژهٔ فعال را با دادهٔ پروژهٔ دیگر آلوده می‌کرد. رفع:
 *    نتیجهٔ خام (که همچنان از روی ایندکس ترکیبی گرفته می‌شود) در حافظه به
 *    projectId پروژهٔ فعال محدود شد.
 *
 * این تست هر دو را با schema و سرویس‌های واقعی core/db.ts شبیه‌سازی می‌کند،
 * نه یک نسخهٔ ساده‌شده.
 */

import "fake-indexeddb/auto";
import Dexie from "dexie";

const REAL_DB_NAME = "karegah-yar-db";
// دقیقاً همان چیزی که در نسخهٔ ۲۰ تا ۲۲ واقعی core/db.ts تعریف شده بود —
// بدون [workerId+date]. جدول‌های projects/settings هم لازم‌اند چون
// getOrCreateActiveProjectId (که هر دو fix از آن استفاده می‌کنند) به آن‌ها نیاز دارد.
const BUGGY_V22_SCHEMA = {
  guardShifts: "id, projectId, workerId, date",
  projects: "id, createdAt",
  settings: "id",
};

let passed = 0;
let failed = 0;

function assertTrue(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}${detail ? " — " + detail : ""}`);
  }
}

async function main() {
  const { SETTINGS_ROW_ID } = await import("../db");
  const activeProjectId = "test-project-active";
  const otherProjectId = "test-project-other";

  console.log("=".repeat(70));
  console.log("مرحلهٔ ۱: دیتابیس با schema واقعی نسخهٔ ۲۲ (حالت باگ‌دار، بدون");
  console.log("   [workerId+date])، دو پروژه، و شیفت‌های نگهبانی در هر دو");
  console.log("=".repeat(70));

  const oldDb = new Dexie(REAL_DB_NAME);
  oldDb.version(22).stores(BUGGY_V22_SCHEMA);
  await oldDb.open();
  await oldDb.table("projects").bulkAdd([
    { id: activeProjectId, name: "پروژهٔ فعال", createdAt: new Date().toISOString() },
    { id: otherProjectId, name: "پروژهٔ دیگر", createdAt: new Date().toISOString() },
  ]);
  await oldDb.table("settings").add({ id: SETTINGS_ROW_ID, activeProjectId });
  await oldDb.table("guardShifts").bulkAdd([
    { id: "gs1", projectId: activeProjectId, workerId: "w1", date: "1405-06-20", startTime: "20:00", endTime: "06:00" },
    { id: "gs2", projectId: activeProjectId, workerId: "w1", date: "1405-06-19", startTime: "20:00", endTime: "06:00" },
    { id: "gs3", projectId: activeProjectId, workerId: "w2", date: "1405-06-20", startTime: "20:00", endTime: "06:00" },
    // شیفت همین نیرو (w1) در همان تاریخ ولی زیر یک پروژهٔ دیگر — بعد از رفع
    // باگ ایزوله‌سازی، هرگز نباید در نتیجهٔ پروژهٔ فعال دیده شود.
    { id: "gs4", projectId: otherProjectId, workerId: "w1", date: "1405-06-20", startTime: "08:00", endTime: "12:00" },
  ]);
  const countBefore = await oldDb.table("guardShifts").count();
  assertTrue(countBefore === 4, "دیتابیس نسخهٔ قدیمی حاوی دقیقاً ۴ شیفت نگهبانی (۳ پروژهٔ فعال + ۱ پروژهٔ دیگر) است");
  oldDb.close();

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۲: تکرار دقیق باگ ایندکس — همون کوئری‌ای که خطا می‌داد،");
  console.log("   روی همون schema باگ‌دار باید واقعاً fail بشه");
  console.log("=".repeat(70));

  const buggyDb = new Dexie(REAL_DB_NAME);
  buggyDb.version(22).stores(BUGGY_V22_SCHEMA);
  await buggyDb.open();
  let reproducedOriginalBug = false;
  try {
    await buggyDb.table("guardShifts").where("[workerId+date]").equals(["w1", "1405-06-20"]).sortBy("startTime");
  } catch (err) {
    reproducedOriginalBug = err instanceof Error && /is not indexed/.test(err.message);
  }
  assertTrue(reproducedOriginalBug, "روی schema باگ‌دار، همون خطای «is not indexed» واقعاً رخ می‌دهد (تأیید بازتولید باگ)");
  buggyDb.close();

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۳: باز کردن همون دیتابیس با core/db.ts واقعی (شامل هر دو");
  console.log("   رفع) و اجرای واقعیِ همون سرویسی که کاربر با آن به خطا برخورد");
  console.log("=".repeat(70));

  const { guardShiftService } = await import("../services/guardShiftService");

  let queryError: Error | null = null;
  let result: Array<{ id: string; projectId: string }> = [];
  try {
    result = (await guardShiftService.findByWorkerAndDate("w1", "1405-06-20")) as typeof result;
  } catch (err) {
    queryError = err as Error;
  }

  assertTrue(queryError === null, "بعد از fix، findByWorkerAndDate دیگر خطای «is not indexed» نمی‌دهد", queryError?.message);
  assertTrue(result.length === 1, "فقط شیفت پروژهٔ فعال برگردانده شده (نه شیفت پروژهٔ دیگر با همان نیرو/تاریخ)");
  assertTrue(result[0]?.id === "gs1", "همان رکورد درست (gs1) برگردانده شده");
  assertTrue(
    result.every((s) => s.projectId === activeProjectId),
    "هیچ شیفتی از پروژهٔ دیگر (otherProjectId) درون نتیجه نیست — رفع باگ ایزوله‌سازی پروژه"
  );

  const finalCount = await (await import("../db")).db.guardShifts.count();
  assertTrue(finalCount === 4, "بعد از ارتقا، هر ۴ شیفت نگهبانی قبلی (هر دو پروژه) سالم مانده‌اند");

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));

  if (failed > 0) {
    throw new Error(`${failed} بررسی ناموفق بود`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
