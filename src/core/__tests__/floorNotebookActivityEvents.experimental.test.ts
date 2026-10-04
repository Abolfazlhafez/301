import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { db } from "../db";
import { projectService } from "../services/projectService";
import { floorService } from "../services/floorService";
import { floorActivityService } from "../services/floorActivityService";
import { workLogNoteService } from "../services/workLogNoteService";
import { photoService } from "../services/photoService";

const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  )
);

async function main(): Promise<void> {
  await db.delete();
  await db.open();

  const projectId = await projectService.getOrCreateActiveProjectId();
  const floor = await floorService.create({
    name: "Activity QA Floor",
    number: 1,
    usageType: "residential",
  });
  const [stage] = await db.floorStages.where({ floorId: floor.id }).toArray();
  assert.ok(stage, "default stage should exist");

  await workLogNoteService.upsert("2026-09-10", "اجرای لوله‌کشی انجام شد", {
    floorId: floor.id,
    stageId: stage.id,
  });

  const file = new File([PNG_1X1], "progress.png", { type: "image/png" });
  await photoService.upload({
    file,
    relatedType: "floor",
    relatedId: floor.id,
    floorId: floor.id,
    stageId: stage.id,
    phase: "during",
    date: "2026-09-10",
    caption: "عکس پیشرفت",
  });

  const events = await floorActivityService.listByFloor(floor.id, 50);
  assert.ok(events.some((e) => e.type === "report_saved"), "floor-linked report must create report_saved event");
  const photoEvent = events.find((e) => e.type === "photo_added");
  assert.ok(photoEvent, "floor-linked photo must create photo_added event");
  assert.equal(photoEvent?.stageId, stage.id, "photo activity must preserve stage relation");

  const genericEvents = await floorActivityService.listByFloor(floor.id, 50);
  assert.equal(genericEvents.filter((e) => e.floorId === floor.id).length, events.length);
  assert.equal((await db.photos.where({ floorId: floor.id }).count()), 1);

  // Keep the test deterministic and ensure no data from another project is involved.
  assert.equal(floor.projectId, projectId);

  await db.delete();
  console.log("PASS floor notebook activity events");
}

main().catch(async (error) => {
  console.error(error);
  try {
    await db.delete();
  } catch {
    // Ignore cleanup failures after the original assertion/error.
  }
  process.exitCode = 1;
});
