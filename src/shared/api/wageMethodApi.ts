import { wageMethodService } from "../../core/services/wageMethodService";
import type { CreateWageMethodInput, UpdateWageMethodInput, WageMethod } from "../../entities/JobType";

export const wageMethodApi = {
  async list(): Promise<WageMethod[]> {
    return wageMethodService.list();
  },
  async findByIdOrNull(id: string): Promise<WageMethod | null> {
    return wageMethodService.findByIdOrNull(id);
  },
  async create(input: CreateWageMethodInput): Promise<WageMethod> {
    return wageMethodService.create(input);
  },
  async update(id: string, input: UpdateWageMethodInput): Promise<WageMethod> {
    return wageMethodService.update(id, input);
  },
  async restoreToDefault(id: string): Promise<WageMethod> {
    return wageMethodService.restoreToDefault(id);
  },
  async remove(id: string): Promise<void> {
    return wageMethodService.remove(id);
  },
  async duplicate(id: string): Promise<WageMethod> {
    return wageMethodService.duplicate(id);
  },
  async countUsages(id: string): Promise<number> {
    return wageMethodService.countUsages(id);
  },
};
