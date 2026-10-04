import { timeLossService } from "../../core/services/timeLossService";
import { CreateTimeLossInput, TimeLoss, UpdateTimeLossInput } from "../../entities/TimeLoss";

export const timeLossApi = {
  async list(params?: { workerId?: string; attendanceId?: string }): Promise<TimeLoss[]> {
    return timeLossService.list(params);
  },

  async create(input: CreateTimeLossInput): Promise<TimeLoss> {
    return timeLossService.create(input);
  },

  async update(id: string, input: UpdateTimeLossInput): Promise<TimeLoss> {
    return timeLossService.update(id, input);
  },

  async remove(id: string): Promise<void> {
    return timeLossService.remove(id);
  },
};
