import { floorIssueService, type ListFloorIssueFilter } from "../../core/services/floorIssueService";
import type { CreateFloorIssueInput, FloorIssue, UpdateFloorIssueInput } from "../../entities/FloorIssue";

export const floorIssuesApi = {
  async listByFloor(floorId: string): Promise<FloorIssue[]> {
    return floorIssueService.listByFloor(floorId);
  },
  async list(filter: ListFloorIssueFilter): Promise<FloorIssue[]> {
    return floorIssueService.list(filter);
  },
  async listAll(): Promise<FloorIssue[]> {
    return floorIssueService.listAll();
  },
  async create(input: CreateFloorIssueInput): Promise<FloorIssue> {
    return floorIssueService.create(input);
  },
  async update(id: string, input: UpdateFloorIssueInput): Promise<FloorIssue> {
    return floorIssueService.update(id, input);
  },
  async remove(id: string): Promise<void> {
    return floorIssueService.remove(id);
  },
};
