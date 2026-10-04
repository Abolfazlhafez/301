import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type { CreateFloorPlanInput, FloorPlan, UpdateFloorPlanInput } from "../../entities/FloorPlan";
import { photoService } from "./photoService";
import { floorActivityService } from "./floorActivityService";
import { projectService } from "./projectService";

async function validateStage(floorId: string, stageId: string | null | undefined): Promise<void> {
  if (!stageId) return;
  const stage = await db.floorStages.get(stageId);
  if (!stage || stage.floorId !== floorId) {
    throw new ValidationError("مرحلهٔ انتخاب‌شده متعلق به این طبقه نیست.");
  }
}

async function getRevisionChainRootId(plan: FloorPlan): Promise<string> {
  let current = plan;
  const seen = new Set<string>();
  while (current.parentPlanId) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    const parent = await db.floorPlans.get(current.parentPlanId);
    if (!parent || parent.floorId !== plan.floorId) break;
    current = parent;
  }
  return current.id;
}

async function deactivateRevisionChain(rootId: string, floorId: string): Promise<void> {
  const plans = await db.floorPlans.where({ floorId }).toArray();
  const updates: Promise<unknown>[] = [];
  for (const plan of plans) {
    const planRootId = await getRevisionChainRootId(plan);
    if (planRootId === rootId && plan.isActiveRevision) {
      updates.push(db.floorPlans.update(plan.id, { isActiveRevision: false, updatedAt: new Date().toISOString() }));
    }
  }
  await Promise.all(updates);
}

export const floorPlanService = {
  async listByFloor(floorId: string): Promise<FloorPlan[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== projectId) return [];
    const items = await db.floorPlans.where({ floorId }).toArray();
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async listAll(): Promise<FloorPlan[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floors = await db.floors.where({ projectId }).toArray();
    const floorIds = new Set(floors.map((floor) => floor.id));
    const plans = await db.floorPlans.toArray();
    return plans.filter((plan) => floorIds.has(plan.floorId));
  },

  async getById(id: string): Promise<FloorPlan | null> {
    const plan = await db.floorPlans.get(id);
    if (!plan) return null;
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(plan.floorId);
    return floor?.projectId === projectId ? plan : null;
  },

  /** همهٔ نسخه‌های یک نقشه (زنجیرهٔ revisionها) — جدیدترین اول. */
  async listRevisionChain(planId: string): Promise<FloorPlan[]> {
    const chain: FloorPlan[] = [];
    const start = await db.floorPlans.get(planId);
    if (!start) return [];
    const projectId = await projectService.getOrCreateActiveProjectId();
    const startFloor = await db.floors.get(start.floorId);
    if (!startFloor || startFloor.projectId !== projectId) return [];
    let current: FloorPlan | undefined = await db.floorPlans.get(planId);
    while (current) {
      chain.push(current);
      const parentId: string | null = current.parentPlanId;
      current = parentId ? await db.floorPlans.get(parentId) : undefined;
    }
    return chain;
  },

  async create(input: CreateFloorPlanInput): Promise<FloorPlan> {
    if (!input.title?.trim()) throw new ValidationError("عنوان نقشه الزامی است.");
    const floor = await db.floors.get(input.floorId);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError(`طبقه‌ای با شناسه ${input.floorId} یافت نشد.`);
    await validateStage(input.floorId, input.stageId);

    let parent: FloorPlan | undefined;
    if (input.parentPlanId) {
      parent = await db.floorPlans.get(input.parentPlanId);
      if (!parent || parent.floorId !== input.floorId) {
        throw new ValidationError("نقشهٔ مبدا برای نسخهٔ جدید معتبر نیست.");
      }
    }

    let filePhotoId: string | null = null;
    if (input.file) {
      const photo = await photoService.upload({
        file: input.file,
        relatedType: "floor",
        relatedId: input.floorId,
        stageId: input.stageId ?? null,
        date: input.date || new Date().toISOString().slice(0, 10),
        caption: input.title.trim(),
      });
      filePhotoId = photo.id;
    }

    const now = new Date().toISOString();
    const created: FloorPlan = {
      id: randomUUID(),
      floorId: input.floorId,
      stageId: input.stageId ?? null,
      title: input.title.trim(),
      category: input.category,
      code: input.code?.trim() || null,
      revision: input.revision?.trim() || null,
      status: input.status ?? "draft",
      filePhotoId,
      designer: input.designer?.trim() || null,
      date: input.date || null,
      description: input.description?.trim() || null,
      parentPlanId: input.parentPlanId ?? null,
      isActiveRevision: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.floorPlans.add(created);

    // دقیقاً یک نسخه در هر زنجیره فعال باشد؛ حتی اگر کاربر از یک Revision قدیمی
    // نسخهٔ جدید بسازد. ابتدا همهٔ اعضای همان زنجیره را غیرفعال می‌کنیم.
    if (parent) {
      const rootId = await getRevisionChainRootId(parent);
      await deactivateRevisionChain(rootId, input.floorId);
      await db.floorPlans.update(created.id, { isActiveRevision: true, updatedAt: now });
    }

    await floorActivityService.log({
      floorId: input.floorId,
      stageId: created.stageId,
      type: "plan_uploaded",
      messageKey: "floor.activity.planUploaded",
      params: { title: created.title },
    });
    return created;
  },

  async update(id: string, input: UpdateFloorPlanInput): Promise<FloorPlan> {
    const existing = await db.floorPlans.get(id);
    if (!existing) throw new NotFoundError(`نقشه‌ای با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این نقشه متعلق به پروژه فعال نیست.");
    if (input.stageId !== undefined) await validateStage(existing.floorId, input.stageId);

    const updated: FloorPlan = {
      ...existing,
      stageId: input.stageId !== undefined ? input.stageId : existing.stageId,
      title: input.title?.trim() ?? existing.title,
      category: input.category ?? existing.category,
      code: input.code !== undefined ? input.code?.trim() || null : existing.code,
      revision: input.revision !== undefined ? input.revision?.trim() || null : existing.revision,
      status: input.status ?? existing.status,
      designer: input.designer !== undefined ? input.designer?.trim() || null : existing.designer,
      date: input.date !== undefined ? input.date : existing.date,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      updatedAt: new Date().toISOString(),
    };
    await db.floorPlans.put(updated);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.floorPlans.get(id);
    if (!existing) throw new NotFoundError(`نقشه‌ای با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این نقشه متعلق به پروژه فعال نیست.");
    // عکس فایل نقشه حذف نمی‌شود (کاربر ممکن است بعداً بخواهد دوباره به آن رجوع کند)، فقط رکورد نقشه حذف می‌شود.
    const wasActive = existing.isActiveRevision;
    const parentId = existing.parentPlanId;
    await db.floorPlans.delete(id);

    // اگر نسخهٔ فعال حذف شد، نزدیک‌ترین نسخهٔ قبلی را دوباره فعال کن تا زنجیره
    // هرگز بدون active revision باقی نماند.
    if (wasActive) {
      let fallbackId = parentId;
      if (!fallbackId) {
        const remaining = await db.floorPlans.where({ floorId: existing.floorId }).toArray();
        const rootId = await getRevisionChainRootId(existing);
        const chain = [];
        for (const plan of remaining) {
          if ((await getRevisionChainRootId(plan)) === rootId) chain.push(plan);
        }
        chain.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
        fallbackId = chain[0]?.id ?? null;
      }
      if (fallbackId) {
        const fallback = await db.floorPlans.get(fallbackId);
        if (fallback && fallback.floorId === existing.floorId) {
          await db.floorPlans.update(fallback.id, { isActiveRevision: true, updatedAt: new Date().toISOString() });
        }
      }
    }
  },

  async removeAllForFloor(floorId: string): Promise<void> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== activeProjectId) return;
    await db.floorPlans.where({ floorId }).delete();
  },
};
