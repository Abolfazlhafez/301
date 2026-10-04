import { workerService } from "../../core/services/workerService";
import { CreateWorkerInput, UpdateWorkerInput, Worker } from "../../entities/Worker";

export const workersApi = {
  async list(params?: { search?: string; isActive?: boolean; projectId?: string }): Promise<Worker[]> {
    return workerService.list(params);
  },

  async getById(id: string): Promise<Worker> {
    return workerService.getById(id);
  },

  async create(input: CreateWorkerInput): Promise<Worker> {
    return workerService.create(input);
  },

  async update(id: string, input: UpdateWorkerInput): Promise<Worker> {
    return workerService.update(id, input);
  },

  async remove(id: string): Promise<void> {
    return workerService.remove(id);
  },

  async toggleActive(id: string): Promise<Worker> {
    return workerService.toggleActive(id);
  },
};
