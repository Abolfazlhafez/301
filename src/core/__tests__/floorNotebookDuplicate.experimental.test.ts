/**
 * تست تجربی قابلیت «کپی طبقه».
 * هدف: اطمینان از این‌که کپی، داده‌های اجرایی دفترچه را با شناسه‌های تازه
 * و ارتباط‌های داخلی صحیح می‌سازد و داده‌های مالیِ متصل به طبقه را دوبل نمی‌کند.
 */
import "fake-indexeddb/auto";

import { db } from "../db";
import { floorService } from "../services/floorService";
import { floorStageService } from "../services/floorStageService";
import { floorTaskService } from "../services/floorTaskService";
import { floorIssueService } from "../services/floorIssueService";
import { floorPlanService } from "../services/floorPlanService";
import { floorChecklistService } from "../services/floorChecklistService";
import { floorWorkerService } from "../services/floorWorkerService";
import { workerService } from "../services/workerService";
import { cashboxFundService } from "../services/cashboxFundService";
import { cashbookService } from "../services/cashbookService";

let passed = 0;
let failed = 0;

function assertTrue(ok: boolean, message: string) {
  if (ok) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

async function main() {
  const source = await floorService.create({ name: "طبقهٔ نمونه", usageType: "residential" });
  const stages = await floorStageService.listByFloor(source.id);
  const stage = stages[1];
  const worker = await workerService.create({
    firstName: "کاربر",
    lastName: "نمونه",
    position: "بنا",
    dailyBaseSalary: 1_000_000,
  });

  await floorWorkerService.create({ floorId: source.id, workerId: worker.id, role: "سرکارگر", stageId: stage.id });
  const task = await floorTaskService.create({ floorId: source.id, stageId: stage.id, title: "کار نمونه", workerId: worker.id });
  const issue = await floorIssueService.create({ floorId: source.id, stageId: stage.id, taskId: task.id, title: "ایراد نمونه" });
  const checklist = await floorChecklistService.create({ floorId: source.id, title: "مورد نمونه" });
  const plan = await floorPlanService.create({ floorId: source.id, stageId: stage.id, title: "نقشه نمونه", category: "architecture" });

  await cashboxFundService.create({ name: "صندوق تست" });
  const cashbook = await cashbookService.create({
    type: "expense",
    title: "هزینه نمونه",
    amount: 123_000,
    date: "2026-01-01",
    floorId: source.id,
  });

  const duplicate = await floorService.duplicate(source.id);
  const duplicateStages = await floorStageService.listByFloor(duplicate.id);
  const duplicateTasks = await floorTaskService.listByFloor(duplicate.id);
  const duplicateIssues = await floorIssueService.listByFloor(duplicate.id);
  const duplicateChecklist = await floorChecklistService.listByFloor(duplicate.id);
  const duplicateWorkers = await floorWorkerService.listByFloor(duplicate.id);
  const duplicatePlans = await floorPlanService.listByFloor(duplicate.id);

  assertTrue(duplicate.id !== source.id, "شناسهٔ طبقهٔ کپی مستقل است");
  assertTrue(duplicate.name.endsWith("(کپی)"), "نام طبقهٔ کپی با پسوند مناسب ساخته شده است");
  assertTrue(duplicateStages.length === stages.length, "همهٔ مراحل کپی شدند");
  assertTrue(duplicateStages.every((s) => s.id !== stages.find((x) => x.key === s.key)?.id), "شناسهٔ مراحل تازه ساخته شده‌اند");
  assertTrue(duplicateTasks.length === 1 && duplicateTasks[0].stageId === duplicateStages[1].id, "ارتباط Task با Stage کپی‌شده صحیح است");
  assertTrue(duplicateIssues.length === 1 && duplicateIssues[0].stageId === duplicateStages[1].id && duplicateIssues[0].taskId === duplicateTasks[0].id, "ارتباط Issue با Stage و Task کپی‌شده صحیح است");
  assertTrue(duplicateIssues[0].id !== issue.id, "شناسهٔ Issue کپی مستقل از اصلی است");
  assertTrue(duplicateChecklist.some((x) => x.title === checklist.title), "چک‌لیست کپی شد");
  assertTrue(duplicateWorkers.length === 1 && duplicateWorkers[0].workerId === worker.id && duplicateWorkers[0].stageId === duplicateStages[1].id, "رابطهٔ Worker حفظ و به Stage جدید وصل شد");
  assertTrue(duplicatePlans.length === 1 && duplicatePlans[0].stageId === duplicateStages[1].id, "نقشه کپی شد و به Stage جدید وصل شد");
  assertTrue(duplicatePlans[0].id !== plan.id, "شناسهٔ نقشهٔ کپی مستقل از اصلی است");

  const sourceCashbook = await db.cashbookEntries.get(cashbook.id);
  const duplicateCashbook = await db.cashbookEntries.where({ floorId: duplicate.id }).toArray();
  assertTrue(!!sourceCashbook && sourceCashbook.floorId === source.id, "تراکنش مالی اصلی دست‌نخورده ماند");
  assertTrue(duplicateCashbook.length === 0, "تراکنش مالی برای طبقهٔ کپی دوبل نشد");

  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
  console.log(`نتیجه: ${passed} موفق، ${failed} ناموفق`);
}

main().catch((error) => {
  console.error(error);
  throw error;
});
