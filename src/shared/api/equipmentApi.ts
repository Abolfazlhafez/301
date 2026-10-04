import { equipmentService } from "../../core/services/equipmentService";
import {
  CreateEquipmentInput,
  Equipment,
  EquipmentWithAvailability,
  UpdateEquipmentInput,
} from "../../entities/Equipment";

export const equipmentApi = {
  async list(params?: { search?: string }): Promise<Equipment[]> {
    return equipmentService.list(params);
  },

  async listWithAvailability(params?: { search?: string }): Promise<EquipmentWithAvailability[]> {
    return equipmentService.listWithAvailability(params);
  },

  async create(input: CreateEquipmentInput): Promise<Equipment> {
    return equipmentService.create(input);
  },

  async update(id: string, input: UpdateEquipmentInput): Promise<Equipment> {
    return equipmentService.update(id, input);
  },

  async remove(id: string): Promise<void> {
    return equipmentService.remove(id);
  },
};
