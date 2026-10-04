import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type {
  CreateFloorChecklistItemInput,
  FloorChecklistItem,
  UpdateFloorChecklistItemInput,
} from "../../entities/FloorChecklistItem";
import { DEFAULT_CHECKLIST_ITEM_KEYS } from "../seedFloorStages";
import { floorActivityService } from "./floorActivityService";
import { projectService } from "./projectService";
import { projectWorkerService } from "./projectWorkerService";

export const floorChecklistService = {
  async listByFloor(floorId: string): Promise<FloorChecklistItem[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== projectId) return [];
    const items = await db.floorChecklistItems.where({ floorId }).toArray();
    return items.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  },

  /** فقط برای seed کردن موارد پیش‌فرض چک‌لیست هنگام ساخت طبقهٔ جدید. */
  async seedDefaults(floorId: string): Promise<void> {
    const now = new Date().toISOString();
    const items: FloorChecklistItem[] = DEFAULT_CHECKLIST_ITEM_KEYS.map((key) => ({
      id: randomUUID(),
      floorId,
      key,
      title: "",
      status: "pending",
      workerId: null,
      note: null,
      checkedAt: null,
      isCustom: false,
      createdAt: now,
      updatedAt: now,
    }));
    await db.floorChecklistItems.bulkAdd(items);
  },

  async create(input: CreateFloorChecklistItemInput): Promise<FloorChecklistItem> {
    if (!input.title?.trim()) throw new ValidationError("عنوان مورد چک‌لیست الزامی است.");
    const floor = await db.floors.get(input.floorId);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError(`طبقه‌ای با شناسه ${input.floorId} یافت نشد.`);

    const now = new Date().toISOString();
    const created: FloorChecklistItem = {
      id: randomUUID(),
      floorId: input.floorId,
      key: null,
      title: input.title.trim(),
      status: "pending",
      workerId: null,
      note: null,
      checkedAt: null,
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.floorChecklistItems.add(created);
    return created;
  },

  async update(id: string, input: UpdateFloorChecklistItemInput): Promise<FloorChecklistItem> {
    const existing = await db.floorChecklistItems.get(id);
    if (!existing) throw new NotFoundError(`مورد چک‌لیستی با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این مورد چک‌لیست متعلق به پروژه فعال نیست.");
    if (input.workerId) {
      const worker = await db.workers.get(input.workerId);
      if (!worker) throw new NotFoundError(`نیرویی با شناسه ${input.workerId} یافت نشد.`);
      const activeProjectId = await projectService.getOrCreateActiveProjectId();
      const floor = await db.floors.get(existing.floorId);
      const [inProject, projectIds] = await Promise.all([
        projectWorkerService.isWorkerInProject(activeProjectId, input.workerId),
        projectWorkerService.listProjectIdsForWorker(input.workerId),
      ]);
      if (!floor || floor.projectId !== activeProjectId || (projectIds.length > 0 && !inProject)) {
        throw new ValidationError("این نیرو به پروژه فعال اختصاص داده نشده است.");
      }
    }

    const now = new Date().toISOString();
    const statusChanged = input.status !== undefined && input.status !== existing.status;
    const updated: FloorChecklistItem = {
      ...existing,
      title: input.title?.trim() ?? existing.title,
      status: input.status ?? existing.status,
      workerId: input.workerId !== undefined ? input.workerId : existing.workerId,
      note: input.note !== undefined ? input.note?.trim() || null : existing.note,
      checkedAt: statusChanged && input.status !== "pending" ? now : existing.checkedAt,
      updatedAt: now,
    };
    await db.floorChecklistItems.put(updated);
    if (statusChanged) {
      await floorActivityService.log({
        floorId: updated.floorId,
        stageId: null,
        type: "checklist_updated",
        messageKey: "floor.activity.checklistUpdated",
        params: { title: updated.isCustom ? updated.title : "" },
      });
    }
    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.floorChecklistItems.get(id);
    if (!existing) throw new NotFoundError(`مورد چک‌لیستی با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این مورد چک‌لیست متعلق به پروژه فعال نیست.");
    if (!existing.isCustom) throw new ValidationError("موارد پیش‌فرض چک‌لیست قابل حذف نیستند.");
    // عکس‌های چک‌لیست مستقل باقی می‌مانند؛ فقط Relation قطع می‌شود.
    await db.photos.where({ checklistItemId: id }).modify({ checklistItemId: null });
    await db.floorChecklistItems.delete(id);
  },

  async removeAllForFloor(floorId: string): Promise<void> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== activeProjectId) return;
    await db.floorChecklistItems.where({ floorId }).delete();
  },
};
