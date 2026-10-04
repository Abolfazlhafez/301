import { jobTypeService } from "../../core/services/jobTypeService";
import type { CreateJobTypeInput, JobType, UpdateJobTypeInput } from "../../entities/JobType";

export const jobTypeApi = {
  async list(): Promise<JobType[]> {
    return jobTypeService.list();
  },
  async findByIdOrNull(id: string): Promise<JobType | null> {
    return jobTypeService.findByIdOrNull(id);
  },
  async create(input: CreateJobTypeInput): Promise<JobType> {
    return jobTypeService.create(input);
  },
  async update(id: string, input: UpdateJobTypeInput): Promise<JobType> {
    return jobTypeService.update(id, input);
  },
  async restoreToDefault(id: string): Promise<JobType> {
    return jobTypeService.restoreToDefault(id);
  },
  async remove(id: string): Promise<void> {
    return jobTypeService.remove(id);
  },
  async duplicate(id: string): Promise<JobType> {
    return jobTypeService.duplicate(id);
  },
};
