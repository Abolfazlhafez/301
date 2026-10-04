import { floorPlanService } from "../../core/services/floorPlanService";
import type { CreateFloorPlanInput, FloorPlan, UpdateFloorPlanInput } from "../../entities/FloorPlan";

export const floorPlansApi = {
  async listByFloor(floorId: string): Promise<FloorPlan[]> {
    return floorPlanService.listByFloor(floorId);
  },
  async listAll(): Promise<FloorPlan[]> {
    return floorPlanService.listAll();
  },
  async listRevisionChain(planId: string): Promise<FloorPlan[]> {
    return floorPlanService.listRevisionChain(planId);
  },
  async create(input: CreateFloorPlanInput): Promise<FloorPlan> {
    return floorPlanService.create(input);
  },
  async update(id: string, input: UpdateFloorPlanInput): Promise<FloorPlan> {
    return floorPlanService.update(id, input);
  },
  async remove(id: string): Promise<void> {
    return floorPlanService.remove(id);
  },
};
