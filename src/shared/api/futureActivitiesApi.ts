import { futureActivityService } from "../../core/services/futureActivityService";
import type {
  CreateFutureActivityInput,
  FutureActivity,
  UpdateFutureActivityInput,
} from "../../entities/FutureActivity";

export const futureActivitiesApi = {
  async listAll(filter?: { scope?: "upcoming" | "history" | "all"; includeCompleted?: boolean; workerId?: string }): Promise<FutureActivity[]> {
    return futureActivityService.listAll(filter);
  },
  async listUpcomingSummary(limit?: number): Promise<FutureActivity[]> {
    return futureActivityService.listUpcomingSummary(limit);
  },
  async countDueOrOverdue(): Promise<number> {
    return futureActivityService.countDueOrOverdue();
  },
  async create(input: CreateFutureActivityInput): Promise<FutureActivity[]> {
    return futureActivityService.create(input);
  },
  async update(id: string, input: UpdateFutureActivityInput): Promise<FutureActivity> {
    return futureActivityService.update(id, input);
  },
  async toggleCompleted(id: string): Promise<FutureActivity> {
    return futureActivityService.toggleCompleted(id);
  },
  async remove(id: string): Promise<void> {
    return futureActivityService.remove(id);
  },
  async removeSeries(seriesId: string): Promise<void> {
    return futureActivityService.removeSeries(seriesId);
  },
  async listByFloor(floorId: string): Promise<FutureActivity[]> {
    return futureActivityService.listByFloor(floorId);
  },
};
