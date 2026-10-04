/**
 * تست تجربی «دفترچهٔ دیجیتال طبقه» — دقیقاً روی core/db.ts و سرویس‌های
 * واقعی پروژه (نه کپی) اجرا می‌شود، با fake-indexeddb به‌جای IndexedDB واقعی.
 *
 * پوشش:
 *   ۱) ساخت طبقه، seed خودکار ۸ مرحلهٔ استاندارد + ۱۲ مورد چک‌لیست پیش‌فرض
 *   ۲) محاسبهٔ derived پیشرفت مرحله از روی وضعیت Taskها (نه ذخیره‌شده)
 *   ۳) اعتبارسنجی «مرحله باید متعلق به همان طبقه باشد» هنگام ساخت Task/Issue
 *   ۴) حذف طبقه: Cascade کامل روی داده‌های متعلق به خودش، اما Worker/تراکنش
 *      دفتر حساب/عکس فقط unlink می‌شوند، هرگز حذف نمی‌شوند
 *   ۵) امتیاز سلامت (healthScore) با وجود مشکل بحرانی باز کاهش می‌یابد
 */

import "fake-indexeddb/auto";

import { db } from "../db";
import { floorService } from "../services/floorService";
import { floorStageService } from "../services/floorStageService";
import { floorTaskService } from "../services/floorTaskService";
import { floorIssueService } from "../services/floorIssueService";
import { floorChecklistService } from "../services/floorChecklistService";
import { floorWorkerService } from "../services/floorWorkerService";
import { cashbookService } from "../services/cashbookService";
import { cashboxFundService } from "../services/cashboxFundService";
import { workerService } from "../services/workerService";
import { STANDARD_STAGE_KEYS, DEFAULT_CHECKLIST_ITEM_KEYS } from "../seedFloorStages";
import { BACKUP_TABLE_NAMES } from "../services/backupService";

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
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}`);
  }
}

async function assertThrows(fn: () => Promise<unknown>, testName: string) {
  try {
    await fn();
    failed++;
    console.log(`  ❌ ${testName} (خطایی پرتاب نشد)`);
  } catch {
    passed++;
    console.log(`  ✅ ${testName}`);
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("بخش ۱: ساخت طبقه، seed خودکار مراحل و چک‌لیست پیش‌فرض");
  console.log("=".repeat(70));

  const floor = await floorService.create({ name: "طبقهٔ سوم", usageType: "residential" });

  const stages = await floorStageService.listByFloor(floor.id);
  assertEqual(stages.length, STANDARD_STAGE_KEYS.length, "دقیقاً ۸ مرحلهٔ استاندارد seed شد");
  assertTrue(
    stages.every((s) => !s.isCustom),
    "همهٔ مراحل seed‌شده isCustom=false هستند (پیش‌فرض)"
  );

  const checklist = await floorChecklistService.listByFloor(floor.id);
  assertEqual(checklist.length, DEFAULT_CHECKLIST_ITEM_KEYS.length, "دقیقاً ۱۲ مورد چک‌لیست پیش‌فرض seed شد");

  console.log();
  console.log("=".repeat(70));
  console.log("بخش ۲: پیشرفت مرحله همیشه از روی Taskها محاسبه می‌شود (derived، نه ذخیره‌شده)");
  console.log("=".repeat(70));

  const targetStage = stages[1]; // اسکلت
  const task1 = await floorTaskService.create({ floorId: floor.id, stageId: targetStage.id, title: "بتن‌ریزی ستون‌ها" });
  const task2 = await floorTaskService.create({ floorId: floor.id, stageId: targetStage.id, title: "قالب‌بندی سقف" });

  let stageWithStats = await floorStageService.getById(targetStage.id);
  assertEqual(stageWithStats?.progress, 0, "قبل از انجام هیچ کاری، پیشرفت مرحله صفر است");

  await floorTaskService.update(task1.id, { status: "done" });
  stageWithStats = await floorStageService.getById(targetStage.id);
  assertEqual(stageWithStats?.progress, 50, "بعد از تکمیل یکی از دو کار، پیشرفت مرحله ۵۰٪ محاسبه می‌شود");

  await floorTaskService.update(task2.id, { status: "done" });
  stageWithStats = await floorStageService.getById(targetStage.id);
  assertEqual(stageWithStats?.progress, 100, "بعد از تکمیل هر دو کار، پیشرفت مرحله ۱۰۰٪ است");

  console.log();
  console.log("=".repeat(70));
  console.log("بخش ۳: اعتبارسنجی تعلق مرحله/کار به طبقهٔ درست (جلوگیری از داده ناسازگار بین طبقات)");
  console.log("=".repeat(70));

  const otherFloor = await floorService.create({ name: "طبقهٔ چهارم", usageType: "residential" });
  const otherStages = await floorStageService.listByFloor(otherFloor.id);

  await assertThrows(
    () => floorTaskService.create({ floorId: floor.id, stageId: otherStages[0].id, title: "کار نامعتبر" }),
    "ساخت Task با stageId از طبقهٔ دیگر رد می‌شود"
  );

  await assertThrows(
    () => floorIssueService.create({ floorId: floor.id, stageId: otherStages[0].id, title: "مشکل نامعتبر" }),
    "ساخت Issue با stageId از طبقهٔ دیگر رد می‌شود"
  );

  console.log();
  console.log("=".repeat(70));
  console.log("بخش ۴: امتیاز سلامت با مشکل بحرانی باز کاهش می‌یابد");
  console.log("=".repeat(70));

  const healthBefore = (await floorService.getById(floor.id))?.healthScore ?? 0;
  await floorIssueService.create({ floorId: floor.id, title: "نشتی لولهٔ اصلی آب", severity: "critical" });
  const healthAfter = (await floorService.getById(floor.id))?.healthScore ?? 0;
  assertTrue(healthAfter < healthBefore, `امتیاز سلامت بعد از مشکل بحرانی کاهش یافت (${healthBefore} → ${healthAfter})`);

  console.log();
  console.log("=".repeat(70));
  console.log("بخش ۵: حذف طبقه — Cascade کامل روی دادهٔ خودش، اما Worker/تراکنش/عکس فقط Unlink می‌شوند");
  console.log("=".repeat(70));

  const worker = await workerService.create({
    firstName: "علی",
    lastName: "محمدی",
    position: "بنا",
    dailyBaseSalary: 1000000,
  });
  await floorWorkerService.create({ floorId: floor.id, workerId: worker.id, role: "سرکارگر" });

  await cashboxFundService.create({ name: "صندوق اصلی" });
  const cashEntry = await cashbookService.create({
    type: "expense",
    title: "خرید سیمان برای طبقهٔ سوم",
    amount: 5_000_000,
    date: "2026-01-01",
    floorId: floor.id,
  });

  const stagesCountBefore = (await floorStageService.listByFloor(floor.id)).length;
  assertTrue(stagesCountBefore > 0, "قبل از حذف، طبقه مراحل دارد (پیش‌شرط تست)");

  await floorService.remove(floor.id);

  const floorAfterDelete = await floorService.getById(floor.id);
  assertEqual(floorAfterDelete, null, "بعد از حذف، خودِ طبقه دیگر پیدا نمی‌شود");

  const stagesAfterDelete = await db.floorStages.where({ floorId: floor.id }).toArray();
  assertEqual(stagesAfterDelete.length, 0, "همهٔ مراحل طبقهٔ حذف‌شده Cascade حذف شدند");

  const tasksAfterDelete = await db.floorTasks.where({ floorId: floor.id }).toArray();
  assertEqual(tasksAfterDelete.length, 0, "همهٔ کارهای طبقهٔ حذف‌شده Cascade حذف شدند");

  const workerStillExists = await db.workers.get(worker.id);
  assertTrue(!!workerStillExists, "نیرو (Worker) بعد از حذف طبقه هنوز در سیستم موجود است (حذف نشده)");

  const cashEntryAfter = await db.cashbookEntries.get(cashEntry.id);
  assertTrue(!!cashEntryAfter, "تراکنش دفتر حساب بعد از حذف طبقه هنوز موجود است (حذف نشده)");
  assertEqual(cashEntryAfter?.floorId ?? null, null, "تراکنش دفتر حساب فقط از طبقه Unlink شد (floorId=null)");

  console.log();
  console.log("=".repeat(70));
  console.log("بخش ۶: هر ۸ جدول جدید در فهرست بکاپ (BACKUP_TABLE_NAMES) حاضرند");
  console.log("=".repeat(70));

  const expectedFloorTables = [
    "floors",
    "floorStages",
    "floorTasks",
    "floorPlans",
    "floorIssues",
    "floorWorkers",
    "floorChecklistItems",
    "floorActivityEvents",
  ];
  for (const tableName of expectedFloorTables) {
    assertTrue((BACKUP_TABLE_NAMES as readonly string[]).includes(tableName), `جدول '${tableName}' در BACKUP_TABLE_NAMES حاضر است`);
  }

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));

  if (failed > 0) {
    // به‌جای process.exit(1): این فایل داخل src/ پروژه است و tsconfig.app.json
    // فقط types بدون node دارد؛ throw کردن هم exit code ناموفق را به tsx منتقل می‌کند.
    throw new Error(`${failed} بررسی از مجموع ${passed + failed} ناموفق بود — جزئیات در خروجی بالا.`);
  }
}

main().catch((err) => {
  console.error("خطای غیرمنتظره در اجرای تست:", err);
  throw err;
});
