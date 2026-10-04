import { optionalLeaveService, ListOptionalLeavesFilter } from "../../core/services/optionalLeaveService";
import type { OptionalLeave, UpsertOptionalLeaveInput } from "../../entities/OptionalLeave";

export const optionalLeaveApi = {
  async list(filter?: ListOptionalLeavesFilter): Promise<OptionalLeave[]> {
    return optionalLeaveService.list(filter);
  },

  async findByWorkerAndDate(workerId: string, date: string): Promise<OptionalLeave | null> {
    return optionalLeaveService.findByWorkerAndDate(workerId, date);
  },

  async upsert(input: UpsertOptionalLeaveInput): Promise<OptionalLeave> {
    return optionalLeaveService.upsert(input);
  },

  async remove(id: string): Promise<void> {
    return optionalLeaveService.remove(id);
  },
};
