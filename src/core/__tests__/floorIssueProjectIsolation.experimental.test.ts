import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = readFileSync(join(process.cwd(), "src/core/services/floorIssueService.ts"), "utf8");

if (!file.includes("getOrCreateActiveProjectId()")) throw new Error("FloorIssue service must resolve the active project.");
if (!file.includes("activeFloorIds")) throw new Error("FloorIssue list must scope results to active-project floors.");
if (!file.includes("floor.projectId !== projectId")) throw new Error("FloorIssue getById must enforce project isolation.");

console.log("✓ FloorIssue project isolation guard passed");
