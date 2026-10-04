import { floorTaskService, type ListFloorTaskFilter } from "../../core/services/floorTaskService";
import type { CreateFloorTaskInput, FloorTask, UpdateFloorTaskInput } from "../../entities/FloorTask";

export const floorTasksApi = {
  async listByFloor(floorId: string): Promise<FloorTask[]> {
    return floorTaskService.listByFloor(floorId);
  },
  async list(filter: ListFloorTaskFilter): Promise<FloorTask[]> {
    return floorTaskService.list(filter);
  },
  async listAll(): Promise<FloorTask[]> {
    return floorTaskService.listAll();
  },
  async create(input: CreateFloorTaskInput): Promise<FloorTask> {
    return floorTaskService.create(input);
  },
  async update(id: string, input: UpdateFloorTaskInput): Promise<FloorTask> {
    return floorTaskService.update(id, input);
  },
  async remove(id: string): Promise<void> {
    return floorTaskService.remove(id);
  },
};
