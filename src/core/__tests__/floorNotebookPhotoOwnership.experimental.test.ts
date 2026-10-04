import "fake-indexeddb/auto";
import assert from "node:assert/strict";

async function run() {
  const { photoService } = await import("../services/photoService");
  const { db } = await import("../db");
  const { projectService } = await import("../services/projectService");
  const activeProjectId = await projectService.getOrCreateActiveProjectId();
  const otherProjectId = "photo-other-project";
  const otherFloorId = "photo-other-floor";
  const now = new Date().toISOString();

  await db.floors.put({
    id: otherFloorId,
    projectId: otherProjectId,
    name: "Other Project Floor",
    number: 2,
    usageType: "other",
    area: null,
    height: null,
    description: null,
    status: "not_started",
    progressMode: "calculated",
    manualProgress: null, unitType: "single" as const, unitCount: null,
    createdAt: now,
    updatedAt: now,
  });

  const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], "tiny.png", { type: "image/png" });

  await assert.rejects(
    () => photoService.upload({ file, relatedType: "floor", relatedId: otherFloorId, date: now.slice(0, 10) }),
    /متعلق به پروژه فعال نیست/
  );

  await assert.rejects(
    () => photoService.upload({ file, relatedType: "floor", relatedId: otherFloorId, floorId: "wrong-floor", date: now.slice(0, 10) }),
    /شناسه طبقه و ارتباط اصلی عکس باید یکسان باشند/
  );

  await db.floors.delete(otherFloorId);
  assert.equal(activeProjectId.length > 0, true);
  console.log("PASS floor photo ownership guards");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
