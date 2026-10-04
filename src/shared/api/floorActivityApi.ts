import { floorActivityService } from "../../core/services/floorActivityService";
import type { FloorActivityEvent } from "../../entities/FloorActivityEvent";

export const floorActivityApi = {
  async listByFloor(floorId: string, limit?: number): Promise<FloorActivityEvent[]> {
    return floorActivityService.listByFloor(floorId, limit);
  },
};
