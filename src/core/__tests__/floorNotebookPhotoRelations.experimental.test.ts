import "fake-indexeddb/auto";
import assert from "node:assert/strict";

async function run() {
  const { photoService } = await import("../services/photoService");
  const { db } = await import("../db");
  const { projectService } = await import("../services/projectService");
  const projectId = await projectService.getOrCreateActiveProjectId();
  const floorId = "photo-relation-floor"; const issueId = "photo-relation-issue"; const checklistItemId = "photo-relation-checklist";
  const now = new Date().toISOString();
  await db.floors.put({ id: floorId, projectId, name: "Photo Relation Floor", number: 99, usageType: "other", area: null, height: null, description: null, status: "not_started", progressMode: "calculated", manualProgress: null, unitType: "single" as const, unitCount: null, createdAt: now, updatedAt: now });
  await db.floorIssues.put({ id: issueId, floorId, stageId: null, taskId: null, title: "Issue", description: null, severity: "medium", status: "open", assignedWorkerId: null, dueDate: null, resolvedAt: null, resolutionNote: null, createdAt: now, updatedAt: now });
  await db.floorChecklistItems.put({ id: checklistItemId, floorId, key: null, title: "Checklist", status: "pending", workerId: null, note: null, checkedAt: null, isCustom: true, createdAt: now, updatedAt: now });
  const file = new File([new Uint8Array([137,80,78,71,13,10,26,10,0])], "tiny.png", { type: "image/png" });
  await assert.rejects(() => photoService.upload({ file, relatedType: "floor", relatedId: floorId, floorId, issueId: "missing-issue", date: "2026-09-10" }));
  await assert.rejects(() => photoService.upload({ file, relatedType: "floor", relatedId: floorId, floorId, checklistItemId: "missing-checklist", date: "2026-09-10" }));
  await db.floors.delete(floorId); await db.floorIssues.delete(issueId); await db.floorChecklistItems.delete(checklistItemId);
  console.log("PASS floor notebook photo relation guards");
}
run().catch((error) => { console.error(error); process.exit(1); });
