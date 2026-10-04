import { db } from "../db";
import { projectService } from "./projectService";
import { NotFoundError, ValidationError } from "../errors";
import type { WorkLogNote } from "../../entities/WorkLogNote";
import { floorActivityService } from "./floorActivityService";

function makeId(projectId: string, date: string): string {
  return `${projectId}:${date}`;
}

export const workLogNoteService = {
  async getByDate(date: string): Promise<WorkLogNote> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const row = await db.workLogNotes.get(makeId(projectId, date));
    return row ?? { id: makeId(projectId, date), projectId, date, description: "", floorId: null, stageId: null, updatedAt: new Date().toISOString() };
  },

  async upsert(date: string, description: string, relation?: { floorId?: string | null; stageId?: string | null }): Promise<WorkLogNote> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    if (relation?.floorId) {
      const floor = await db.floors.get(relation.floorId);
      if (!floor) throw new NotFoundError("طبقه انتخاب‌شده پیدا نشد.");
      if (floor.projectId !== projectId) throw new ValidationError("طبقه انتخاب‌شده متعلق به پروژه فعال نیست.");
      if (relation.stageId) {
        const stage = await db.floorStages.get(relation.stageId);
        if (!stage || stage.floorId !== relation.floorId) throw new ValidationError("مرحله انتخاب‌شده متعلق به این طبقه نیست.");
      }
    } else if (relation?.stageId) {
      throw new ValidationError("مرحله بدون طبقه معتبر نیست.");
    }
    const existing = await db.workLogNotes.get(makeId(projectId, date));
    const row: WorkLogNote = {
      id: makeId(projectId, date),
      projectId,
      date,
      description,
      floorId: relation?.floorId !== undefined ? relation.floorId : existing?.floorId ?? null,
      stageId: relation?.stageId !== undefined ? relation.stageId : existing?.stageId ?? null,
      updatedAt: new Date().toISOString(),
    };
    await db.workLogNotes.put(row);
    if (row.floorId && row.description.trim()) {
      await floorActivityService.log({
        floorId: row.floorId,
        stageId: row.stageId,
        type: "report_saved",
        messageKey: "floor.activity.reportSaved",
        params: { date: row.date },
      });
    }
    return row;
  },

  async listByFloor(floorId: string): Promise<WorkLogNote[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== projectId) return [];
    return db.workLogNotes
      .where({ projectId, floorId })
      .toArray()
      .then((rows) => rows.sort((a, b) => b.date.localeCompare(a.date)));
  },

  async listAll(): Promise<WorkLogNote[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    return db.workLogNotes.where({ projectId }).toArray().then((rows) => rows.sort((a, b) => b.date.localeCompare(a.date)));
  },
};
