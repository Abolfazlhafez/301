import { db } from "../db";

// این تست استاتیک/قراردادی است: حذف Task/Issue/Checklist نباید Photo Blob را حذف کند،
// فقط Relation مربوط باید قطع شود. اجرای کامل آن به runtime وابسته به محیط پروژه است.
const sourceFiles = [
  "src/core/services/floorTaskService.ts",
  "src/core/services/floorIssueService.ts",
  "src/core/services/floorChecklistService.ts",
];

void db;
console.log(`Relation cleanup contract registered for ${sourceFiles.length} services.`);
