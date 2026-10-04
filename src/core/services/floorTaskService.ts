import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type { CreateFloorTaskInput, FloorTask, UpdateFloorTaskInput } from "../../entities/FloorTask";
import { floorActivityService } from "./floorActivityService";
import { projectService } from "./projectService";

export interface ListFloorTaskFilter {
  floorId?: string;
  stageId?: string;
  status?: FloorTask["status"];
  priority?: FloorTask["priority"];
  workerId?: string;
}

async function validateStage(floorId: string, stageId: string | null | undefined): Promise<void> {
  if (!stageId) return;
  const stage = await db.floorStages.get(stageId);
  if (!stage || stage.floorId !== floorId) {
    throw new ValidationError("مرحلهٔ انتخاب‌شده متعلق به این طبقه نیست.");
  }
}

async function validateWorker(workerId: string | null | undefined, projectId: string): Promise<void> {
  if (!workerId) return;
  const worker = await db.workers.get(workerId);
  if (!worker) throw new NotFoundError(`نیرویی با شناسه ${workerId} یافت نشد.`);
  const [link, anyProjectLink] = await Promise.all([
    db.projectWorkers.where({ projectId, workerId }).first(),
    db.projectWorkers.where({ workerId }).first(),
  ]);
  if (anyProjectLink && !link) throw new ValidationError("این نیرو به پروژه فعال اختصاص داده نشده است.");
}

export const floorTaskService = {
  async listByFloor(floorId: string): Promise<FloorTask[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== projectId) return [];
    const items = await db.floorTasks.where({ floorId }).toArray();
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async list(filter: ListFloorTaskFilter): Promise<FloorTask[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floors = await db.floors.where({ projectId }).toArray();
    const floorIds = new Set(floors.map((f) => f.id));
    let items: FloorTask[];
    if (filter.floorId) {
      if (!floorIds.has(filter.floorId)) return [];
      items = await db.floorTasks.where({ floorId: filter.floorId }).toArray();
    } else {
      const all = await db.floorTasks.toArray();
      items = all.filter((task) => floorIds.has(task.floorId));
    }
    return items
      .filter((t) => !filter.stageId || t.stageId === filter.stageId)
      .filter((t) => !filter.status || t.status === filter.status)
      .filter((t) => !filter.priority || t.priority === filter.priority)
      .filter((t) => !filter.workerId || t.workerId === filter.workerId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  /** برای جست‌وجوی سراسری برنامه (Global Search) — همهٔ کارهای همهٔ طبقات. */
  async listAll(): Promise<FloorTask[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floors = await db.floors.where({ projectId }).toArray();
    const floorIds = new Set(floors.map((floor) => floor.id));
    const tasks = await db.floorTasks.toArray();
    return tasks.filter((task) => floorIds.has(task.floorId));
  },

  async getById(id: string): Promise<FloorTask | null> {
    const task = await db.floorTasks.get(id);
    if (!task) return null;
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(task.floorId);
    return floor?.projectId === projectId ? task : null;
  },

  async create(input: CreateFloorTaskInput): Promise<FloorTask> {
    if (!input.title?.trim()) throw new ValidationError("عنوان کار الزامی است.");
    const floor = await db.floors.get(input.floorId);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError(`طبقه‌ای با شناسه ${input.floorId} یافت نشد.`);
    await validateStage(input.floorId, input.stageId);
    await validateWorker(input.workerId, activeProjectId);

    if (input.estimatedCost !== undefined && input.estimatedCost !== null && input.estimatedCost < 0) {
      throw new ValidationError("هزینهٔ برآوردی نمی‌تواند منفی باشد.");
    }

    const now = new Date().toISOString();
    const created: FloorTask = {
      id: randomUUID(),
      floorId: input.floorId,
      stageId: input.stageId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: "todo",
      priority: input.priority ?? "medium",
      progress: 0,
      workerId: input.workerId ?? null,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      completedAt: null,
      estimatedCost: input.estimatedCost ?? null,
      actualCost: null,
      note: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    await db.floorTasks.add(created);
    await floorActivityService.log({
      floorId: input.floorId,
      stageId: created.stageId,
      type: "task_created",
      messageKey: "floor.activity.taskCreated",
      params: { title: created.title },
    });
    return created;
  },

  async update(id: string, input: UpdateFloorTaskInput): Promise<FloorTask> {
    const existing = await db.floorTasks.get(id);
    if (!existing) throw new NotFoundError(`کاری با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این کار متعلق به پروژه فعال نیست.");

    if (input.stageId !== undefined) await validateStage(existing.floorId, input.stageId);
    if (input.workerId !== undefined) await validateWorker(input.workerId, activeProjectId);
    if (input.progress !== undefined && (input.progress < 0 || input.progress > 100)) {
      throw new ValidationError("درصد پیشرفت باید بین ۰ تا ۱۰۰ باشد.");
    }
    if (input.estimatedCost !== undefined && input.estimatedCost !== null && input.estimatedCost < 0) {
      throw new ValidationError("هزینهٔ برآوردی نمی‌تواند منفی باشد.");
    }
    if (input.actualCost !== undefined && input.actualCost !== null && input.actualCost < 0) {
      throw new ValidationError("هزینهٔ واقعی نمی‌تواند منفی باشد.");
    }

    const becomingDone = input.status === "done" && existing.status !== "done";
    const now = new Date().toISOString();
    const updated: FloorTask = {
      ...existing,
      stageId: input.stageId !== undefined ? input.stageId : existing.stageId,
      title: input.title?.trim() ?? existing.title,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      status: input.status ?? existing.status,
      priority: input.priority ?? existing.priority,
      progress: input.status === "done" ? 100 : input.progress ?? existing.progress,
      workerId: input.workerId !== undefined ? input.workerId : existing.workerId,
      startDate: input.startDate !== undefined ? input.startDate : existing.startDate,
      dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
      completedAt: becomingDone ? now : input.status && input.status !== "done" ? null : existing.completedAt,
      estimatedCost: input.estimatedCost !== undefined ? input.estimatedCost : existing.estimatedCost,
      actualCost: input.actualCost !== undefined ? input.actualCost : existing.actualCost,
      note: input.note !== undefined ? input.note?.trim() || null : existing.note,
      updatedAt: now,
    };
    await db.floorTasks.put(updated);
    if (becomingDone) {
      await floorActivityService.log({
        floorId: updated.floorId,
        stageId: updated.stageId,
        type: "task_completed",
        messageKey: "floor.activity.taskCompleted",
        params: { title: updated.title },
      });
    }
    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.floorTasks.get(id);
    if (!existing) throw new NotFoundError(`کاری با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این کار متعلق به پروژه فعال نیست.");
    // داده‌های مستقل طبقه حذف نمی‌شوند؛ فقط Relationهای وابسته قطع می‌شوند.
    await db.floorIssues.where({ taskId: id }).modify({ taskId: null });
    await db.photos.where({ taskId: id }).modify({ taskId: null });
    await db.floorTasks.delete(id);
  },

  async removeAllForFloor(floorId: string): Promise<void> {
    await db.floorTasks.where({ floorId }).delete();
  },
};
