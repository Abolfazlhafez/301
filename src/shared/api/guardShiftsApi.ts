import { guardShiftService, type ListGuardShiftsFilter } from "../../core/services/guardShiftService";
import type { CreateGuardShiftInput, GuardShift, UpdateGuardShiftInput } from "../../entities/GuardShift";

export const guardShiftsApi = {
  async list(filter?: ListGuardShiftsFilter): Promise<GuardShift[]> {
    return guardShiftService.list(filter);
  },
  async findByWorkerAndDate(workerId: string, date: string): Promise<GuardShift[]> {
    return guardShiftService.findByWorkerAndDate(workerId, date);
  },
  async create(input: CreateGuardShiftInput): Promise<GuardShift> {
    return guardShiftService.create(input);
  },
  async update(id: string, input: UpdateGuardShiftInput): Promise<GuardShift> {
    return guardShiftService.update(id, input);
  },
  async remove(id: string): Promise<void> {
    return guardShiftService.remove(id);
  },
};
