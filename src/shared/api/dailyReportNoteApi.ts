import { dailyReportNoteService } from "../../core/services/dailyReportNoteService";
import type { DailyReportNote } from "../../entities/DailyReportNote";

export const dailyReportNoteApi = {
  async getByDate(date: string): Promise<DailyReportNote> {
    return dailyReportNoteService.getByDate(date);
  },
  async upsert(date: string, supervisorNote: string): Promise<DailyReportNote> {
    return dailyReportNoteService.upsert(date, supervisorNote);
  },
};
