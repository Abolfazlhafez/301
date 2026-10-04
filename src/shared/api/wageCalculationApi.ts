import { wageCalculationService, WagePreviewResult } from "../../core/services/wageCalculationService";
import type { CreateWageCalculationInput, WageCalculationRecord } from "../../entities/WageAssignment";

export const wageCalculationApi = {
  async listByWorker(workerId: string): Promise<WageCalculationRecord[]> {
    return wageCalculationService.listByWorker(workerId);
  },
  async listByAssignment(wageAssignmentId: string): Promise<WageCalculationRecord[]> {
    return wageCalculationService.listByAssignment(wageAssignmentId);
  },
  async preview(wageAssignmentId: string, variableValues: Record<string, number>): Promise<WagePreviewResult> {
    return wageCalculationService.preview(wageAssignmentId, variableValues);
  },
  async calculateAndSave(input: CreateWageCalculationInput): Promise<WageCalculationRecord> {
    return wageCalculationService.calculateAndSave(input);
  },
  async remove(id: string): Promise<void> {
    return wageCalculationService.remove(id);
  },
};
