import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db, SETTINGS_ROW_ID } from "../db";
import { projectService } from "../services/projectService";
import { workLogNoteService } from "../services/workLogNoteService";
import { futureActivityService } from "../services/futureActivityService";

async function main() {
  await db.delete();
  await db.open();
  const projectA = await projectService.create({ name: "A" });
  const projectB = await projectService.create({ name: "B" });
  await db.settings.put({ id: SETTINGS_ROW_ID, projectName: "A", supervisorName: "", projectLocation: "", activeProjectId: projectA.id } as never);
  const now = new Date().toISOString();
  await db.floors.bulkPut([
    { id: "fa", projectId: projectA.id, name: "FA", number: 1, usageType: "residential", area: null, height: null, description: null, status: "not_started", progressMode: "calculated", manualProgress: null, unitType: "single" as const, unitCount: null, createdAt: now, updatedAt: now },
    { id: "fb", projectId: projectB.id, name: "FB", number: 2, usageType: "residential", area: null, height: null, description: null, status: "not_started", progressMode: "calculated", manualProgress: null, unitType: "single" as const, unitCount: null, createdAt: now, updatedAt: now },
  ]);
  await db.workLogNotes.put({ id: `${projectB.id}:2026-09-10`, projectId: projectB.id, date: "2026-09-10", description: "foreign", floorId: "fb", stageId: null, updatedAt: now });
  await db.futureActivities.put({ id: "foreign-activity", projectId: projectB.id, seriesId: null, date: "2026-09-11", endDate: null, time: null, title: "foreign", description: null, priority: "medium", isCompleted: false, workerId: null, floorId: "fb", stageId: null, taskId: null, createdAt: now, updatedAt: now });

  assert.deepEqual(await workLogNoteService.listByFloor("fb"), []);
  assert.deepEqual(await futureActivityService.listByFloor("fb"), []);
  await assert.rejects(() => futureActivityService.create({ date: "2026-09-11", title: "invalid", priority: "medium", floorId: "fb" }));

  await db.close();
  console.log("floor-related read/write isolation checks passed");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
