/**
 * Regression guard: future activities linked to a Floor must stay inside the
 * existing notification pipeline. The notification service itself is a safe
 * no-op on web, so this test exercises the service contract without creating a
 * second notification engine.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { futureActivityService } from "../services/futureActivityService";
import { db } from "../db";
import { projectService } from "../services/projectService";

await db.delete();
await db.open();
const projectId = await projectService.getOrCreateActiveProjectId();
const floorId = crypto.randomUUID();
await db.floors.add({
  id: floorId,
  projectId,
  name: "Floor Test",
  number: 1,
  usageType: "residential",
  area: null,
  height: null,
  description: null,
  status: "not_started",
  progressMode: "calculated",
  manualProgress: null, unitType: "single" as const, unitCount: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const created = await futureActivityService.create({
  date: "2999-01-01",
  title: "Floor activity notification test",
  description: null,
  priority: "medium",
  workerId: null,
  floorId,
  stageId: null,
  taskId: null,
  time: "09:00",
  recurrence: null,
});
assert.equal(created.length, 1);
assert.equal((await futureActivityService.listByFloor(floorId)).length, 1);

await futureActivityService.toggleCompleted(created[0].id);
assert.equal((await db.futureActivities.get(created[0].id))?.isCompleted, true);

await futureActivityService.remove(created[0].id);
assert.equal(await db.futureActivities.get(created[0].id), undefined);

await db.close();
console.log("future activity notification integration guard: OK");
