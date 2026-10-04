/**
 * تست تجربی واقعی برای مورد ۱ گروه دوم فهرست کارها: «خرابی بکاپ‌های
 * نسخه‌های قبلی پس از هر آپدیت».
 *
 * ریشهٔ باگ واقعی که پیدا شد: از نسخهٔ schema ۱۶ به بعد، جدول‌هایی مثل
 * floors/attendances/cashboxFunds/... به یک فیلد projectId معتبر نیاز
 * دارند. Migrationهای Dexie (`db.version(N).upgrade(...)`) این فیلد را
 * برای داده‌های *موجود در همان دیتابیس* هنگام ارتقای نسخه پر می‌کنند — اما
 * این فقط زمانی اجرا می‌شود که خودِ IndexedDB واقعاً از یک نسخهٔ قدیمی‌تر
 * ارتقا پیدا کند. وقتی کاربر یک فایل پشتیبانِ گرفته‌شده با نسخهٔ *قدیمی*
 * برنامه (از قبل از افزوده‌شدن projectId) را روی یک نصب *جدید* (که schema
 * از قبل به آخرین نسخه رسیده) Restore می‌کند، `restoreFromPayload` مستقیماً
 * با `bulkAdd` این رکوردها را می‌نویسد — بدون عبور از upgrade hooks — پس
 * این رکوردها بدون projectId معتبر وارد می‌شوند و چون همهٔ فیلترهای برنامه
 * بر اساس پروژهٔ فعال کار می‌کنند، این داده‌ها عملاً «ناپدید»/خراب به‌نظر
 * می‌رسند.
 *
 * راه‌حل تست‌شده در این فایل: `ensureDatabaseSeeded()` (که در انتهای
 * `restoreFromPayload` صدا زده می‌شود) اکنون شامل یک مرحلهٔ backfill است که
 * هر رکورد بدون projectId را — از هر جدولی که باشد — به پروژهٔ پیش‌فرض/فعال
 * وصل می‌کند؛ این تست دقیقاً همان مسیر واقعی کاربر (ساخت یک بکاپ قدیمی →
 * وارد کردن آن با backupService.importAll واقعی) را طی می‌کند، نه فقط تابع
 * backfill را مجزا صدا می‌زند.
 */
import "fake-indexeddb/auto";

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
  console.log("مرحلهٔ ۱: ساخت یک «فایل پشتیبان قدیمی» دستی — دقیقاً شبیه");
  console.log("   بکاپی که با نسخه‌ای از قبل از معماری چند-پروژه‌ای گرفته شده");
  console.log("   (رکوردهای floors/attendances/cashboxFunds بدون projectId،");
  console.log("   و اصلاً بدون جدول projects/projectWorkers)");
  console.log("=".repeat(70));

  const now = new Date().toISOString();
  const oldWorkerId = "old-worker-1";
  const oldFloorId = "old-floor-1";
  const oldFundId = "old-fund-1";
  const oldAttendanceId = "old-attendance-1";

  // شبیه‌سازی دقیق ساختار BackupFile (بدون رمزنگاری، دقیقاً مثل یک بکاپ
  // قدیمی رمزنگاری‌نشده) — عمداً فیلد projectId را از رکوردها حذف کرده‌ایم
  // و جدول‌های projects/projectWorkers را خالی گذاشته‌ایم.
  const oldBackupFile = {
    app: "karegah-yar",
    version: 1,
    exportedAt: now,
    tables: {
      workers: [
        {
          id: oldWorkerId,
          firstName: "علی",
          lastName: "قدیمی",
          phoneNumber: null,
          position: "بنا",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      floors: [
        { id: oldFloorId, name: "طبقه ۱ (قدیمی)", status: "in_progress", createdAt: now, updatedAt: now },
      ],
      cashboxFunds: [
        { id: oldFundId, name: "صندوق قدیمی", description: null, isDefault: true, createdAt: now, updatedAt: now },
      ],
      attendances: [
        {
          id: oldAttendanceId,
          workerId: oldWorkerId,
          date: "2025-01-01",
          checkIn: "08:00",
          checkOut: "16:00",
          createdAt: now,
          updatedAt: now,
        },
      ],
      // بقیهٔ جدول‌های BACKUP_TABLE_NAMES خالی — چون در آن نسخهٔ قدیمی یا
      // اصلاً وجود نداشتند (projects/projectWorkers) یا صرفاً رکوردی ندارند.
      projects: [],
      projectWorkers: [],
      photos: [],
    },
  };
  const backupJson = JSON.stringify(oldBackupFile);
  const oldBackupFileObject = new File([backupJson], "old-backup.json", { type: "application/json" });

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۲: وارد کردن این فایل با backupService.importAll واقعی");
  console.log("   (دقیقاً همان مسیری که کاربر واقعی با دکمهٔ «بازیابی» طی می‌کند)");
  console.log("=".repeat(70));

  const { backupService } = await import("../services/backupService");

  let importThrew: unknown = null;
  try {
    await backupService.importAll(oldBackupFileObject);
  } catch (err) {
    importThrew = err;
  }
  assertEqual(importThrew, null, "بازیابی فایل پشتیبان قدیمی بدون خطا کامل می‌شود");

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۳: بررسی این‌که هیچ رکوردی بدون projectId باقی نمانده باشد");
  console.log("=".repeat(70));

  const { db } = await import("../db");

  const restoredFloor = await db.floors.get(oldFloorId);
  assertTrue(!!restoredFloor?.projectId, "طبقهٔ آمده از بکاپ قدیمی، پس از بازیابی یک projectId معتبر دارد");

  const restoredFund = await db.cashboxFunds.get(oldFundId);
  assertTrue(!!restoredFund?.projectId, "صندوق آمده از بکاپ قدیمی، پس از بازیابی یک projectId معتبر دارد");

  const restoredAttendance = await db.attendances.get(oldAttendanceId);
  assertTrue(!!restoredAttendance?.projectId, "رکورد حضور آمده از بکاپ قدیمی، پس از بازیابی یک projectId معتبر دارد");

  const projectWorkerLinks = await db.projectWorkers.where("workerId").equals(oldWorkerId).toArray();
  assertTrue(
    projectWorkerLinks.length > 0,
    "برای نیروی آمده از بکاپ قدیمی، یک ارتباط projectWorker به پروژهٔ پیش‌فرض ساخته شده"
  );

  // همهٔ رکوردهای بازیابی‌شده باید دقیقاً به یک پروژهٔ مشترک (نه پروژه‌های
  // پراکنده و ناسازگار) وصل شده باشند.
  const allProjects = await db.projects.toArray();
  assertTrue(allProjects.length >= 1, "حداقل یک پروژه (پیش‌فرض یا موجود) پس از بازیابی وجود دارد");
  const projectIds = new Set([restoredFloor?.projectId, restoredFund?.projectId, restoredAttendance?.projectId]);
  assertEqual(projectIds.size, 1, "طبقه، صندوق و رکورد حضورِ آمده از بکاپ قدیمی، همگی به یک پروژهٔ مشترک وصل شدند");

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("خطای غیرمنتظره در اجرای تست:", err);
  process.exitCode = 1;
});
