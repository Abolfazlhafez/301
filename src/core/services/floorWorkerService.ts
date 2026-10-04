import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type { CreateFloorWorkerInput, FloorWorker, FloorWorkerWithDetails } from "../../entities/FloorWorker";
import { floorActivityService } from "./floorActivityService";
import { projectService } from "./projectService";
import { projectWorkerService } from "./projectWorkerService";

async function withDetails(rel: FloorWorker): Promise<FloorWorkerWithDetails> {
  const worker = await db.workers.get(rel.workerId);
  return {
    ...rel,
    workerFullName: worker ? `${worker.firstName} ${worker.lastName}`.trim() : "",
    workerPosition: worker?.position ?? "",
  };
}

export const floorWorkerService = {
  async listByFloor(floorId: string): Promise<FloorWorkerWithDetails[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== projectId) return [];
    const items = await db.floorWorkers.where({ floorId }).toArray();
    return Promise.all(items.map(withDetails));
  },

  async create(input: CreateFloorWorkerInput): Promise<FloorWorker> {
    const floor = await db.floors.get(input.floorId);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError(`طبقه‌ای با شناسه ${input.floorId} یافت نشد.`);
    const worker = await db.workers.get(input.workerId);
    if (!worker) throw new NotFoundError(`نیرویی با شناسه ${input.workerId} یافت نشد.`);
    const inProject = await projectWorkerService.isWorkerInProject(activeProjectId, input.workerId);
    const hasAnyProjectLink = (await projectWorkerService.listProjectIdsForWorker(input.workerId)).length > 0;
    if (hasAnyProjectLink && !inProject) {
      throw new ValidationError("این نیرو به پروژه فعال اختصاص داده نشده است.");
    }
    if (input.stageId) {
      const stage = await db.floorStages.get(input.stageId);
      if (!stage || stage.floorId !== input.floorId) {
        throw new ValidationError("مرحلهٔ انتخاب‌شده متعلق به این طبقه نیست.");
      }
    }

    const already = await db.floorWorkers.where({ floorId: input.floorId, workerId: input.workerId }).first();
    if (already) throw new ValidationError("این نیرو قبلاً به این طبقه اضافه شده است.");

    const created: FloorWorker = {
      id: randomUUID(),
      floorId: input.floorId,
      workerId: input.workerId,
      role: input.role?.trim() || null,
      stageId: input.stageId ?? null,
      createdAt: new Date().toISOString(),
    };
    await db.floorWorkers.add(created);
    await floorActivityService.log({
      floorId: input.floorId,
      stageId: created.stageId,
      type: "worker_assigned",
      messageKey: "floor.activity.workerAssigned",
      params: { name: `${worker.firstName} ${worker.lastName}`.trim() },
    });
    return created;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.floorWorkers.get(id);
    if (!existing) throw new NotFoundError(`ارتباط نیرویی با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این ارتباط متعلق به پروژه فعال نیست.");
    await db.floorWorkers.delete(id);
  },

  async removeAllForFloor(floorId: string): Promise<void> {
    await db.floorWorkers.where({ floorId }).delete();
  },
};
