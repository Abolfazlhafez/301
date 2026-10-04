import { floorService } from "../../core/services/floorService";
import type { CreateFloorInput, Floor, FloorWithStats, UpdateFloorInput } from "../../entities/Floor";

export const floorsApi = {
  async list(): Promise<FloorWithStats[]> {
    return floorService.list();
  },
  async getById(id: string): Promise<FloorWithStats | null> {
    return floorService.getById(id);
  },
  async create(input: CreateFloorInput): Promise<Floor> {
    return floorService.create(input);
  },
  async update(id: string, input: UpdateFloorInput): Promise<Floor> {
    return floorService.update(id, input);
  },
  async remove(id: string): Promise<void> {
    return floorService.remove(id);
  },
  async duplicate(id: string): Promise<Floor> {
    return floorService.duplicate(id);
  },
};
