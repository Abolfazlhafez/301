import { floorStageService } from "../../core/services/floorStageService";
import type { CreateFloorStageInput, FloorStage, FloorStageWithStats, UpdateFloorStageInput } from "../../entities/FloorStage";

export const floorStagesApi = {
  async listByFloor(floorId: string): Promise<FloorStageWithStats[]> {
    return floorStageService.listByFloor(floorId);
  },
  async getById(id: string): Promise<FloorStageWithStats | null> {
    return floorStageService.getById(id);
  },
  async create(input: CreateFloorStageInput): Promise<FloorStage> {
    return floorStageService.create(input);
  },
  async update(id: string, input: UpdateFloorStageInput): Promise<FloorStage> {
    return floorStageService.update(id, input);
  },
  async remove(id: string): Promise<void> {
    return floorStageService.remove(id);
  },
  async swapOrder(id: string, direction: "up" | "down"): Promise<void> {
    return floorStageService.swapOrder(id, direction);
  },
};
