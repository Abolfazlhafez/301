import { equipmentAssignmentService } from "../../core/services/equipmentService";
import { CreateEquipmentAssignmentInput, EquipmentAssignment } from "../../entities/Equipment";

export const equipmentAssignmentApi = {
  async list(params?: {
    workerId?: string;
    equipmentId?: string;
    onlyActive?: boolean;
  }): Promise<EquipmentAssignment[]> {
    return equipmentAssignmentService.list(params);
  },

  async create(input: CreateEquipmentAssignmentInput): Promise<EquipmentAssignment> {
    return equipmentAssignmentService.create(input);
  },

  async returnItem(id: string, returnedDate: string): Promise<EquipmentAssignment> {
    return equipmentAssignmentService.returnItem(id, returnedDate);
  },

  async remove(id: string): Promise<void> {
    return equipmentAssignmentService.remove(id);
  },
};
