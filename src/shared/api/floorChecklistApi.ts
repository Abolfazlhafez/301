import { floorChecklistService } from "../../core/services/floorChecklistService";
import type {
  CreateFloorChecklistItemInput,
  FloorChecklistItem,
  UpdateFloorChecklistItemInput,
} from "../../entities/FloorChecklistItem";

export const floorChecklistApi = {
  async listByFloor(floorId: string): Promise<FloorChecklistItem[]> {
    return floorChecklistService.listByFloor(floorId);
  },
  async create(input: CreateFloorChecklistItemInput): Promise<FloorChecklistItem> {
    return floorChecklistService.create(input);
  },
  async update(id: string, input: UpdateFloorChecklistItemInput): Promise<FloorChecklistItem> {
    return floorChecklistService.update(id, input);
  },
  async remove(id: string): Promise<void> {
    return floorChecklistService.remove(id);
  },
};
