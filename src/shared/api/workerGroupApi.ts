import { workerGroupService } from "../../core/services/workerGroupService";
import type { CreateWorkerGroupInput, UpdateWorkerGroupInput, WorkerGroup } from "../../entities/WorkerGroup";

export const workerGroupApi = {
  async list(): Promise<WorkerGroup[]> {
    return workerGroupService.list();
  },
  async findByIdOrNull(id: string): Promise<WorkerGroup | null> {
    return workerGroupService.findByIdOrNull(id);
  },
  async create(input: CreateWorkerGroupInput): Promise<WorkerGroup> {
    return workerGroupService.create(input);
  },
  async update(id: string, input: UpdateWorkerGroupInput): Promise<WorkerGroup> {
    return workerGroupService.update(id, input);
  },
  async remove(id: string): Promise<void> {
    return workerGroupService.remove(id);
  },
  async toggleActive(id: string): Promise<WorkerGroup> {
    return workerGroupService.toggleActive(id);
  },
};
