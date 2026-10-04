import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type { CreateFloorIssueInput, FloorIssue, UpdateFloorIssueInput } from "../../entities/FloorIssue";
import { floorActivityService } from "./floorActivityService";
import { projectService } from "./projectService";
import { projectWorkerService } from "./projectWorkerService";

export interface ListFloorIssueFilter {
  floorId?: string;
  stageId?: string;
  status?: FloorIssue["status"];
  severity?: FloorIssue["severity"];
}

async function validateStage(floorId: string, stageId: string | null | undefined): Promise<void> {
  if (!stageId) return;
  const stage = await db.floorStages.get(stageId);
  if (!stage || stage.floorId !== floorId) {
    throw new ValidationError("مرحلهٔ انتخاب‌شده متعلق به این طبقه نیست.");
  }
}

async function validateWorker(projectId: string, workerId: string | null | undefined): Promise<void> {
  if (!workerId) return;
  const worker = await db.workers.get(workerId);
  if (!worker) throw new NotFoundError(`نیرویی با شناسه ${workerId} یافت نشد.`);
  const [inProject, projectIds] = await Promise.all([
    projectWorkerService.isWorkerInProject(projectId, workerId),
    projectWorkerService.listProjectIdsForWorker(workerId),
  ]);
  if (projectIds.length > 0 && !inProject) throw new ValidationError("این نیرو به پروژه فعال اختصاص داده نشده است.");
}

async function validateTask(floorId: string, taskId: string | null | undefined): Promise<void> {
  if (!taskId) return;
  const task = await db.floorTasks.get(taskId);
  if (!task || task.floorId !== floorId) {
    throw new ValidationError("کار انتخاب‌شده متعلق به این طبقه نیست.");
  }
}

export const floorIssueService = {
  async listByFloor(floorId: string): Promise<FloorIssue[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== projectId) return [];
    const items = await db.floorIssues.where({ floorId }).toArray();
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async list(filter: ListFloorIssueFilter): Promise<FloorIssue[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const activeFloors = await db.floors.where({ projectId: activeProjectId }).toArray();
    const activeFloorIds = new Set(activeFloors.map((floor) => floor.id));
    let items: FloorIssue[];
    if (filter.floorId) {
      if (!activeFloorIds.has(filter.floorId)) return [];
      items = await db.floorIssues.where({ floorId: filter.floorId }).toArray();
    } else {
      const all = await db.floorIssues.toArray();
      items = all.filter((issue) => activeFloorIds.has(issue.floorId));
    }
    return items
      .filter((i) => !filter.stageId || i.stageId === filter.stageId)
      .filter((i) => !filter.status || i.status === filter.status)
      .filter((i) => !filter.severity || i.severity === filter.severity)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async listAll(): Promise<FloorIssue[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floors = await db.floors.where({ projectId }).toArray();
    const floorIds = new Set(floors.map((floor) => floor.id));
    const issues = await db.floorIssues.toArray();
    return issues.filter((issue) => floorIds.has(issue.floorId));
  },

  async getById(id: string): Promise<FloorIssue | null> {
    const issue = await db.floorIssues.get(id);
    if (!issue) return null;
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(issue.floorId);
    if (!floor || floor.projectId !== projectId) return null;
    return issue;
  },

  async create(input: CreateFloorIssueInput): Promise<FloorIssue> {
    if (!input.title?.trim()) throw new ValidationError("عنوان مشکل الزامی است.");
    const floor = await db.floors.get(input.floorId);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError(`طبقه‌ای با شناسه ${input.floorId} یافت نشد.`);
    await validateStage(input.floorId, input.stageId);
    await validateTask(input.floorId, input.taskId);
    await validateWorker(activeProjectId, input.assignedWorkerId);

    const now = new Date().toISOString();
    const created: FloorIssue = {
      id: randomUUID(),
      floorId: input.floorId,
      stageId: input.stageId ?? null,
      taskId: input.taskId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      severity: input.severity ?? "medium",
      status: "open",
      assignedWorkerId: input.assignedWorkerId ?? null,
      dueDate: input.dueDate ?? null,
      resolvedAt: null,
      resolutionNote: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.floorIssues.add(created);
    await floorActivityService.log({
      floorId: input.floorId,
      stageId: created.stageId,
      type: "issue_created",
      messageKey: "floor.activity.issueCreated",
      params: { title: created.title, severity: created.severity },
    });
    return created;
  },

  async update(id: string, input: UpdateFloorIssueInput): Promise<FloorIssue> {
    const existing = await db.floorIssues.get(id);
    if (!existing) throw new NotFoundError(`مشکلی با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این مشکل متعلق به پروژه فعال نیست.");

    if (input.stageId !== undefined) await validateStage(existing.floorId, input.stageId);
    if (input.taskId !== undefined) await validateTask(existing.floorId, input.taskId);
    if (input.assignedWorkerId !== undefined) await validateWorker(activeProjectId, input.assignedWorkerId);

    const becomingResolved = input.status === "resolved" && existing.status !== "resolved";
    const now = new Date().toISOString();
    const updated: FloorIssue = {
      ...existing,
      stageId: input.stageId !== undefined ? input.stageId : existing.stageId,
      taskId: input.taskId !== undefined ? input.taskId : existing.taskId,
      title: input.title?.trim() ?? existing.title,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      severity: input.severity ?? existing.severity,
      status: input.status ?? existing.status,
      assignedWorkerId: input.assignedWorkerId !== undefined ? input.assignedWorkerId : existing.assignedWorkerId,
      dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
      resolvedAt: becomingResolved ? now : input.status && input.status !== "resolved" ? null : existing.resolvedAt,
      resolutionNote:
        input.resolutionNote !== undefined ? input.resolutionNote?.trim() || null : existing.resolutionNote,
      updatedAt: now,
    };
    await db.floorIssues.put(updated);
    if (becomingResolved) {
      await floorActivityService.log({
        floorId: updated.floorId,
        stageId: updated.stageId,
        type: "issue_resolved",
        messageKey: "floor.activity.issueResolved",
        params: { title: updated.title },
      });
    }
    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.floorIssues.get(id);
    if (!existing) throw new NotFoundError(`مشکلی با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این مشکل متعلق به پروژه فعال نیست.");
    // عکس‌های Issue مستقل باقی می‌مانند؛ فقط رابطهٔ Issue قطع می‌شود.
    await db.photos.where({ issueId: id }).modify({ issueId: null });
    await db.floorIssues.delete(id);
  },

  async removeAllForFloor(floorId: string): Promise<void> {
    await db.floorIssues.where({ floorId }).delete();
  },
};
