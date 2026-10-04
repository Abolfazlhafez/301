import "fake-indexeddb/auto";

import { db, SETTINGS_ROW_ID } from "../db";
import { projectService } from "../services/projectService";
import { floorService } from "../services/floorService";
import { floorTaskService } from "../services/floorTaskService";
import { floorIssueService } from "../services/floorIssueService";
import { floorPlanService } from "../services/floorPlanService";
import { floorStageService } from "../services/floorStageService";
import { floorChecklistService } from "../services/floorChecklistService";

let passed = 0;
let failed = 0;

function assertTrue(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
  }
}

async function assertResolvesNull(fn: () => Promise<unknown>, name: string) {
  try {
    const result = await fn();
    assertTrue(result === null, name);
  } catch {
    failed++;
    console.log(`  ❌ ${name} (نباید خطا پرتاب می‌کرد)`);
  }
}

async function main() {
  await db.delete();
  await db.open();

  const projectA = await projectService.create({ name: "پروژه A" });
  const projectB = await projectService.create({ name: "پروژه B" });
  await db.settings.put({
    id: SETTINGS_ROW_ID,
    projectName: "پروژه A",
    supervisorName: "",
    projectLocation: "",
    activeProjectId: projectA.id,
  } as never);

  const floorA = await floorService.create({ name: "طبقه A", usageType: "residential" });
  await db.settings.update(SETTINGS_ROW_ID, { activeProjectId: projectB.id });
  const floorB = await floorService.create({ name: "طبقه B", usageType: "residential" });

  await db.settings.update(SETTINGS_ROW_ID, { activeProjectId: projectA.id });

  assertTrue((await floorService.getById(floorA.id))?.id === floorA.id, "طبقهٔ پروژه A در پروژه A قابل مشاهده است");
  assertTrue((await floorService.getById(floorB.id)) === null, "طبقهٔ پروژه B از پروژه A پنهان است");
  assertTrue((await floorTaskService.listByFloor(floorB.id)).length === 0, "Taskهای پروژه B از پروژه A پنهان هستند");
  assertTrue((await floorIssueService.listByFloor(floorB.id)).length === 0, "Issueهای پروژه B از پروژه A پنهان هستند");
  assertTrue((await floorPlanService.listByFloor(floorB.id)).length === 0, "Planهای پروژه B از پروژه A پنهان هستند");
  assertTrue((await floorStageService.listByFloor(floorB.id)).length === 0, "Stageهای پروژه B از پروژه A پنهان هستند");
  assertTrue((await floorChecklistService.listByFloor(floorB.id)).length === 0, "Checklist پروژه B از پروژه A پنهان است");

  await assertResolvesNull(() => floorTaskService.getById("missing-cross-project"), "getById کار غیرموجود null می‌دهد");

  console.log("=".repeat(70));
  console.log(`نتیجه: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed}`);
  console.log("=".repeat(70));
  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
}

main().catch((err) => {
  console.error(err);
  throw err;
});
