import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { db } from "../db";
import { projectService } from "../services/projectService";
import { floorActivityService } from "../services/floorActivityService";

async function main(): Promise<void> {
  await db.delete();
  await db.open();
  const now = new Date().toISOString();
  const projectA = await projectService.getOrCreateActiveProjectId();
  const projectB = "project-b";
  await db.projects.put({ id: projectB, name: "B", location: "", supervisorName: "", createdAt: now, updatedAt: now });
  await db.floors.bulkPut([
    { id: "floor-a", projectId: projectA, name: "A", number: 1, usageType: "residential", area: null, height: null, description: null, status: "not_started", progressMode: "calculated", manualProgress: null, unitType: "single" as const, unitCount: null, createdAt: now, updatedAt: now },
    { id: "floor-b", projectId: projectB, name: "B", number: 2, usageType: "residential", area: null, height: null, description: null, status: "not_started", progressMode: "calculated", manualProgress: null, unitType: "single" as const, unitCount: null, createdAt: now, updatedAt: now },
  ]);

  await assert.rejects(() => floorActivityService.log({ floorId: "floor-b", type: "floor_created", messageKey: "floor.activity.floorCreated" }));
  await floorActivityService.log({ floorId: "floor-a", type: "floor_created", messageKey: "floor.activity.floorCreated" });
  assert.equal((await floorActivityService.listByFloor("floor-b")).length, 0);

  await db.close();
  console.log("floor activity isolation checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
