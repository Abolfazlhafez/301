import { breakTimeService } from "../../core/services/breakTimeService";
import { BreakTime, BreakTimeType, CreateBreakTimeInput } from "../../entities/BreakTime";
import type { SuggestedBreakTime, QuickBreakTimeResult } from "../../core/services/breakTimeService";

export const breakTimeApi = {
  async list(params?: { workerId?: string; attendanceId?: string }): Promise<BreakTime[]> {
    return breakTimeService.list(params);
  },

  async getSuggestedTimes(workerId: string, type: BreakTimeType): Promise<SuggestedBreakTime> {
    return breakTimeService.getSuggestedTimes(workerId, type);
  },

  async getQuickBreakTime(workerId: string, type: BreakTimeType): Promise<QuickBreakTimeResult> {
    return breakTimeService.getQuickBreakTime(workerId, type);
  },

  async create(input: CreateBreakTimeInput): Promise<BreakTime> {
    return breakTimeService.create(input);
  },

  async remove(id: string): Promise<void> {
    return breakTimeService.remove(id);
  },
};
