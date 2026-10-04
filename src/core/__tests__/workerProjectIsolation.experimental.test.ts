/**
 * تست تجربی واقعی برای بخشی از مورد ۲ فهرست کارها: «ایزوله‌سازی کامل
 * داده‌ها بین پروژه‌ها» — به‌طور مشخص برای فهرست نیروها.
 *
 * ریشهٔ باگ واقعی که پیدا شد: جدول رابطهٔ `projectWorkers` (که هر نیرو را
 * به یک یا چند پروژه وصل می‌کند) از قبل درست ساخته و پر می‌شد — اما
 * `workerService.list()` هرگز از آن استفاده نمی‌کرد؛ همیشه *همهٔ* نیروهای
 * دیتابیس را برمی‌گرداند، صرف‌نظر از این‌که کاربر کدام پروژه را فعال کرده.
 * یعنی سوییچ پروژه در بالای صفحه هیچ اثری روی صفحهٔ «نیروها» نداشت.
 *
 * راه‌حل تست‌شده در این فایل: `workerService.list({ projectId })` اکنون
 * نتیجه را به دو دسته محدود می‌کند: نیروهای صریحاً لینک‌شده به آن پروژه، و
 * نیروهایی که اصلاً به هیچ پروژه‌ای لینک نیستند (برای سازگاری با داده‌های
 * قدیمی — تا نیرویی «گم» نشود). وقتی filter داده نشود (پارامتر اختیاری
 * است)، رفتار قبلی (بدون فیلتر) دقیقاً حفظ می‌شود — پس این تست هم رفتار
 * جدید (فیلترشده) و هم رفتار قدیمی (بدون فیلتر، برای سازگاری عقب‌رو با
 * مصرف‌کننده‌های دیگر که هنوز projectId پاس نمی‌دهند) را بررسی می‌کند.
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
  const { db } = await import("../db");
  const { projectService } = await import("../services/projectService");
  const { projectWorkerService } = await import("../services/projectWorkerService");
  const { workerService } = await import("../services/workerService");

  console.log("=".repeat(70));
  console.log("مرحلهٔ ۱: ساخت دو پروژه و سه نیرو (یکی برای هرکدام + یک نیروی");
  console.log("   قدیمی/بدون‌لینک که مستقیماً و بدون عبور از create() اضافه شده)");
  console.log("=".repeat(70));

  const projectA = await projectService.create({ name: "پروژهٔ الف" });
  const projectB = await projectService.create({ name: "پروژهٔ ب" });

  const workerA = await workerService.create({
    firstName: "علی",
    lastName: "پروژه‌الف",
    position: "بنا",
    dailyBaseSalary: 1000000,
  });
  await projectWorkerService.unassign(await projectService.getOrCreateActiveProjectId(), workerA.id);
  await projectWorkerService.assign(projectA.id, workerA.id);

  const workerB = await workerService.create({
    firstName: "رضا",
    lastName: "پروژه‌ب",
    position: "برقکار",
    dailyBaseSalary: 1200000,
  });
  await projectWorkerService.unassign(await projectService.getOrCreateActiveProjectId(), workerB.id);
  await projectWorkerService.assign(projectB.id, workerB.id);

  // نیروی «قدیمی»: مستقیماً در جدول درج می‌شود، بدون هیچ ارتباط
  // projectWorker — دقیقاً شبیه نیرویی که پیش از وجود این فیچر ساخته شده.
  const now = new Date().toISOString();
  const legacyWorkerId = "legacy-worker-1";
  await db.workers.add({
    id: legacyWorkerId,
    firstName: "قدیمی",
    lastName: "بدون‌لینک",
    phoneNumber: null,
    position: "کارگر ساده",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  } as never);

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۲: بررسی فیلتر بر اساس هر پروژه");
  console.log("=".repeat(70));

  const listForA = await workerService.list({ projectId: projectA.id });
  const idsForA = listForA.map((w) => w.id).sort();
  assertTrue(idsForA.includes(workerA.id), "لیست پروژهٔ الف شامل نیروی خودِ پروژهٔ الف است");
  assertTrue(!idsForA.includes(workerB.id), "لیست پروژهٔ الف شامل نیروی پروژهٔ ب نیست");
  assertTrue(idsForA.includes(legacyWorkerId), "لیست پروژهٔ الف شامل نیروی قدیمی/بدون‌لینک هم هست (سازگاری با داده‌های قدیمی)");

  const listForB = await workerService.list({ projectId: projectB.id });
  const idsForB = listForB.map((w) => w.id).sort();
  assertTrue(idsForB.includes(workerB.id), "لیست پروژهٔ ب شامل نیروی خودِ پروژهٔ ب است");
  assertTrue(!idsForB.includes(workerA.id), "لیست پروژهٔ ب شامل نیروی پروژهٔ الف نیست");
  assertTrue(idsForB.includes(legacyWorkerId), "لیست پروژهٔ ب هم شامل همان نیروی قدیمی/بدون‌لینک است");

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۳: بدون فیلتر projectId، رفتار قبلی (همهٔ نیروها) حفظ شده باشد");
  console.log("=".repeat(70));

  const listUnfiltered = await workerService.list();
  const idsUnfiltered = listUnfiltered.map((w) => w.id);
  assertTrue(idsUnfiltered.includes(workerA.id), "بدون فیلتر: نیروی پروژهٔ الف هم هست");
  assertTrue(idsUnfiltered.includes(workerB.id), "بدون فیلتر: نیروی پروژهٔ ب هم هست");
  assertTrue(idsUnfiltered.includes(legacyWorkerId), "بدون فیلتر: نیروی قدیمی هم هست");

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
