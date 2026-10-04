import { wageAssignmentService } from "../../core/services/wageAssignmentService";
import type {
  CreateWageAssignmentInput,
  UpdateWageAssignmentInput,
  WageAssignment,
} from "../../entities/WageAssignment";

export const wageAssignmentApi = {
  async listByWorker(workerId: string, includeInactive?: boolean): Promise<WageAssignment[]> {
    return wageAssignmentService.listByWorker(workerId, includeInactive);
  },
  async findByIdOrNull(id: string): Promise<WageAssignment | null> {
    return wageAssignmentService.findByIdOrNull(id);
  },
  async create(input: CreateWageAssignmentInput): Promise<WageAssignment> {
    return wageAssignmentService.create(input);
  },
  async update(id: string, input: UpdateWageAssignmentInput): Promise<WageAssignment> {
    return wageAssignmentService.update(id, input);
  },
  async remove(id: string): Promise<void> {
    return wageAssignmentService.remove(id);
  },
};
