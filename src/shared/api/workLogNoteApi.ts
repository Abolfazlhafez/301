import { workLogNoteService } from "../../core/services/workLogNoteService";
import type { WorkLogNote } from "../../entities/WorkLogNote";

export const workLogNoteApi = {
  async getByDate(date: string): Promise<WorkLogNote> {
    return workLogNoteService.getByDate(date);
  },
  async upsert(date: string, description: string, relation?: { floorId?: string | null; stageId?: string | null }): Promise<WorkLogNote> {
    return workLogNoteService.upsert(date, description, relation);
  },
  async listByFloor(floorId: string): Promise<WorkLogNote[]> {
    return workLogNoteService.listByFloor(floorId);
  },
  async listAll(): Promise<WorkLogNote[]> {
    return workLogNoteService.listAll();
  },
};
