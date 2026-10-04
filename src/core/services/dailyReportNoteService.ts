import { db } from "../db";
import { projectService } from "./projectService";
import type { DailyReportNote } from "../../entities/DailyReportNote";

function makeId(projectId: string, date: string): string {
  return `${projectId}:${date}`;
}

export const dailyReportNoteService = {
  /** یادداشت سرپرست یک تاریخ مشخص، برای پروژهٔ فعال؛ اگر وجود نداشته باشد رشته خالی برمی‌گرداند. */
  async getByDate(date: string): Promise<DailyReportNote> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const row = await db.dailyReportNotes.get(makeId(projectId, date));
    return row ?? { id: makeId(projectId, date), projectId, date, supervisorNote: "", updatedAt: new Date().toISOString() };
  },

  /** ذخیره یا به‌روزرسانی یادداشت سرپرست یک تاریخ، برای پروژهٔ فعال. */
  async upsert(date: string, supervisorNote: string): Promise<DailyReportNote> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const row: DailyReportNote = {
      id: makeId(projectId, date),
      projectId,
      date,
      supervisorNote,
      updatedAt: new Date().toISOString(),
    };
    await db.dailyReportNotes.put(row);
    return row;
  },
};
