import "fake-indexeddb/auto";
import { db } from "../db";
import { floorService } from "../services/floorService";
import { floorPlanService } from "../services/floorPlanService";

async function main() {
  const floor = await floorService.create({ name: "Revision QA", usageType: "other" });
  const r1 = await floorPlanService.create({ floorId: floor.id, title: "A-101", category: "architecture", code: "A-101", revision: "01" });
  const r2 = await floorPlanService.create({ floorId: floor.id, title: "A-101", category: "architecture", code: "A-101", revision: "02", parentPlanId: r1.id });
  const r3 = await floorPlanService.create({ floorId: floor.id, title: "A-101", category: "architecture", code: "A-101", revision: "03", parentPlanId: r1.id });

  const chainAfterBranch = await floorPlanService.listByFloor(floor.id);
  const activeAfterBranch = chainAfterBranch.filter((p) => p.isActiveRevision);
  if (activeAfterBranch.length !== 1 || activeAfterBranch[0].id !== r3.id) throw new Error("Revision chain must have exactly one active revision after branching");
  if (r2.id === r3.id) throw new Error("Revision ids must be unique");

  await floorPlanService.remove(r3.id);
  const fallback = await db.floorPlans.get(r1.id);
  const r2After = await db.floorPlans.get(r2.id);
  if (!fallback?.isActiveRevision && !r2After?.isActiveRevision) throw new Error("Deleting active revision must restore an active revision");
  if (fallback?.isActiveRevision && r2After?.isActiveRevision) throw new Error("Only one revision may be active after deletion");

  await floorService.remove(floor.id);
  console.log("PASS floor plan revision active-state guards");
}

main().catch((error) => { console.error(error); process.exit(1); });
