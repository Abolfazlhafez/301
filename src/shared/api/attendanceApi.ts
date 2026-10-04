import { attendanceService, SuggestedAttendanceTimes } from "../../core/services/attendanceService";
import {
  Attendance,
  BulkAttendanceEntry,
  BulkAttendanceOptions,
  BulkAttendanceResult,
  UpsertAttendanceInput,
} from "../../entities/Attendance";

export const attendanceApi = {
  async list(params?: { workerId?: string; date?: string; from?: string; to?: string }): Promise<
    Attendance[]
  > {
    return attendanceService.list(params);
  },

  async upsert(input: UpsertAttendanceInput): Promise<Attendance> {
    return attendanceService.upsert(input);
  },

  async getSuggestedTimes(workerId: string): Promise<SuggestedAttendanceTimes> {
    return attendanceService.getSuggestedTimes(workerId);
  },

  async bulkUpsert(entries: BulkAttendanceEntry[], options: BulkAttendanceOptions): Promise<BulkAttendanceResult> {
    return attendanceService.bulkUpsert(entries, options);
  },

  async undoBulk(saved: BulkAttendanceResult["saved"]): Promise<number> {
    return attendanceService.undoBulk(saved);
  },

  async remove(id: string): Promise<void> {
    return attendanceService.remove(id);
  },
};
