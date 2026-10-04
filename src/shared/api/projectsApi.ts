import { projectService } from "../../core/services/projectService";
import type { CreateProjectInput, Project, UpdateProjectInput } from "../../entities/Project";

export const projectsApi = {
  async list(): Promise<Project[]> {
    return projectService.list();
  },
  async create(input: CreateProjectInput): Promise<Project> {
    return projectService.create(input);
  },
  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    return projectService.update(id, input);
  },
  async remove(id: string): Promise<void> {
    return projectService.remove(id);
  },
  async getActiveProjectId(): Promise<string> {
    return projectService.getOrCreateActiveProjectId();
  },
  async setActiveProjectId(id: string): Promise<void> {
    return projectService.setActiveProjectId(id);
  },
};
