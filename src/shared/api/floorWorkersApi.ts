import { floorWorkerService } from "../../core/services/floorWorkerService";
import type { CreateFloorWorkerInput, FloorWorker, FloorWorkerWithDetails } from "../../entities/FloorWorker";

export const floorWorkersApi = {
  async listByFloor(floorId: string): Promise<FloorWorkerWithDetails[]> {
    return floorWorkerService.listByFloor(floorId);
  },
  async create(input: CreateFloorWorkerInput): Promise<FloorWorker> {
    return floorWorkerService.create(input);
  },
  async remove(id: string): Promise<void> {
    return floorWorkerService.remove(id);
  },
};
