import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError, HasDependenciesError } from "../errors";
import { projectService } from "./projectService";
import type { CreateWorkerGroupInput, UpdateWorkerGroupInput, WorkerGroup } from "../../entities/WorkerGroup";

/** حذف تکراری‌ها و ورودی‌های خالی از فهرست اعضا، بدون به‌هم‌ریختن ترتیب انتخاب کاربر. */
function sanitizeMemberIds(ids: string[] | undefined): string[] {
  if (!ids) return [];
  return Array.from(new Set(ids.filter(Boolean)));
}

export const workerGroupService = {
  /** فهرست اکیپ‌های *پروژهٔ فعال* — دقیقاً مثل نیروها، هر پروژه اکیپ‌های مستقل خودش را دارد. */
  async list(): Promise<WorkerGroup[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const all = await db.workerGroups.where({ projectId: activeProjectId }).toArray();
    return all.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name, "fa");
    });
  },

  async findByIdOrNull(id: string): Promise<WorkerGroup | null> {
    const item = await db.workerGroups.get(id);
    return item ?? null;
  },

  async create(input: CreateWorkerGroupInput): Promise<WorkerGroup> {
    if (!input.name.trim()) throw new ValidationError("نام اکیپ الزامی است.");

    const projectId = await projectService.getOrCreateActiveProjectId();
    const now = new Date().toISOString();
    const created: WorkerGroup = {
      id: randomUUID(),
      projectId,
      name: input.name.trim(),
      memberWorkerIds: sanitizeMemberIds(input.memberWorkerIds),
      description: input.description?.trim() || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.workerGroups.add(created);
    return created;
  },

  async update(id: string, input: UpdateWorkerGroupInput): Promise<WorkerGroup> {
    const existing = await db.workerGroups.get(id);
    if (!existing) throw new NotFoundError(`اکیپی با شناسه ${id} یافت نشد.`);

    const updated: WorkerGroup = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      memberWorkerIds:
        input.memberWorkerIds !== undefined ? sanitizeMemberIds(input.memberWorkerIds) : existing.memberWorkerIds,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: new Date().toISOString(),
    };
    if (!updated.name) throw new ValidationError("نام اکیپ الزامی است.");

    await db.workerGroups.put(updated);
    return updated;
  },

  /**
   * حذف کامل یک اکیپ. اگر این اکیپ سابقهٔ پرداخت جمعی داشته باشد، حذف رد
   * می‌شود (همان الگوی محافظتی نیروها/تیپ‌های نیرو در برابر از دست رفتن
   * تاریخچهٔ مالی) — کاربر باید به‌جای حذف، اکیپ را غیرفعال کند.
   */
  async remove(id: string): Promise<void> {
    const existing = await db.workerGroups.get(id);
    if (!existing) throw new NotFoundError(`اکیپی با شناسه ${id} یافت نشد.`);

    const paymentsCount = await db.groupWagePayments.where({ groupId: id }).count();
    if (paymentsCount > 0) {
      throw new HasDependenciesError(
        "این اکیپ سابقهٔ پرداخت جمعی دارد و قابل حذف نیست. به‌جای حذف، می‌توانید آن را غیرفعال کنید."
      );
    }

    await db.workerGroups.delete(id);
  },

  async toggleActive(id: string): Promise<WorkerGroup> {
    const existing = await db.workerGroups.get(id);
    if (!existing) throw new NotFoundError(`اکیپی با شناسه ${id} یافت نشد.`);
    const updated: WorkerGroup = { ...existing, isActive: !existing.isActive, updatedAt: new Date().toISOString() };
    await db.workerGroups.put(updated);
    return updated;
  },
};
