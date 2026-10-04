import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type {
  CreateFloorStageInput,
  FloorStage,
  FloorStageWithStats,
  UpdateFloorStageInput,
} from "../../entities/FloorStage";
import { STANDARD_STAGE_KEYS } from "../seedFloorStages";
import { floorActivityService } from "./floorActivityService";
import { projectService } from "./projectService";

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** پیشرفت یک مرحله: اگر override دستی باشد همان مقدار، وگرنه از میانگین درصد پیشرفت Taskهای همان مرحله. */
async function computeStageProgress(stage: FloorStage): Promise<number> {
  if (stage.progressMode === "manual" && stage.manualProgress !== null) {
    return clampProgress(stage.manualProgress);
  }
  const tasks = await db.floorTasks.where({ stageId: stage.id }).toArray();
  if (tasks.length === 0) return stage.status === "completed" ? 100 : 0;
  const sum = tasks.reduce((acc, t) => acc + (t.status === "done" ? 100 : t.progress), 0);
  return clampProgress(sum / tasks.length);
}

async function withStats(stage: FloorStage): Promise<FloorStageWithStats> {
  const [tasks, issues, progress] = await Promise.all([
    db.floorTasks.where({ stageId: stage.id }).toArray(),
    db.floorIssues.where({ stageId: stage.id }).toArray(),
    computeStageProgress(stage),
  ]);
  const openTasksCount = tasks.filter((t) => t.status !== "done").length;
  const openIssuesCount = issues.filter((i) => i.status === "open" || i.status === "in_progress").length;
  const remainingItemsCount = openTasksCount + openIssuesCount;
  return {
    ...stage,
    progress,
    tasksCount: tasks.length,
    openTasksCount,
    openIssuesCount,
    readyForNext: remainingItemsCount === 0 && stage.status !== "blocked",
    remainingItemsCount,
  };
}

export const floorStageService = {
  async listByFloor(floorId: string): Promise<FloorStageWithStats[]> {
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== projectId) return [];
    const stages = await db.floorStages.where({ floorId }).sortBy("order");
    return Promise.all(stages.map(withStats));
  },

  async getById(id: string): Promise<FloorStageWithStats | null> {
    const stage = await db.floorStages.get(id);
    if (!stage) return null;
    const projectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(stage.floorId);
    if (!floor || floor.projectId !== projectId) return null;
    return withStats(stage);
  },

  /** برای استفادهٔ داخلی سرویس‌های دیگر (بدون آمار اضافه، سریع‌تر). */
  async getRaw(id: string): Promise<FloorStage | null> {
    return (await db.floorStages.get(id)) ?? null;
  },

  /** فقط برای seed کردن ۸ مرحلهٔ پیش‌فرض هنگام ساخت طبقهٔ جدید — از core/services/floorService فراخوانی می‌شود. */
  async seedStandardStages(floorId: string): Promise<void> {
    const now = new Date().toISOString();
    const { STANDARD_STAGE_SEEDS } = await import("../seedFloorStages");
    const stages: FloorStage[] = STANDARD_STAGE_SEEDS.map((seed) => ({
      id: randomUUID(),
      floorId,
      key: seed.key,
      title: "",
      order: seed.order,
      weight: seed.weight,
      status: "not_started",
      progressMode: "calculated",
      manualProgress: null,
      startDate: null,
      endDate: null,
      description: null,
      isCustom: false,
      createdAt: now,
      updatedAt: now,
    }));
    await db.floorStages.bulkAdd(stages);
  },

  async create(input: CreateFloorStageInput): Promise<FloorStage> {
    if (!input.title?.trim()) throw new ValidationError("عنوان مرحله الزامی است.");
    const floor = await db.floors.get(input.floorId);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError(`طبقه‌ای با شناسه ${input.floorId} یافت نشد.`);
    if (input.weight !== undefined && input.weight < 0) {
      throw new ValidationError("وزن مرحله نمی‌تواند منفی باشد.");
    }

    const existing = await db.floorStages.where({ floorId: input.floorId }).toArray();
    const maxOrder = existing.reduce((max, s) => Math.max(max, s.order), -1);

    const now = new Date().toISOString();
    const created: FloorStage = {
      id: randomUUID(),
      floorId: input.floorId,
      key: randomUUID(),
      title: input.title.trim(),
      order: maxOrder + 1,
      weight: input.weight ?? 10,
      status: "not_started",
      progressMode: "calculated",
      manualProgress: null,
      startDate: null,
      endDate: null,
      description: input.description?.trim() || null,
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.floorStages.add(created);
    await floorActivityService.log({
      floorId: created.floorId,
      stageId: created.id,
      type: "stage_created",
      messageKey: "floor.activity.stageCreated",
      params: { title: created.title },
    });
    return created;
  },

  async update(id: string, input: UpdateFloorStageInput): Promise<FloorStage> {
    const existing = await db.floorStages.get(id);
    if (!existing) throw new NotFoundError(`مرحله‌ای با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این مرحله متعلق به پروژه فعال نیست.");

    if (input.weight !== undefined && input.weight < 0) {
      throw new ValidationError("وزن مرحله نمی‌تواند منفی باشد.");
    }
    if (input.manualProgress !== undefined && input.manualProgress !== null) {
      if (input.manualProgress < 0 || input.manualProgress > 100) {
        throw new ValidationError("درصد پیشرفت باید بین ۰ تا ۱۰۰ باشد.");
      }
    }

    const updated: FloorStage = {
      ...existing,
      title: input.title?.trim() ?? existing.title,
      order: input.order ?? existing.order,
      weight: input.weight ?? existing.weight,
      status: input.status ?? existing.status,
      progressMode: input.progressMode ?? existing.progressMode,
      manualProgress: input.manualProgress !== undefined ? input.manualProgress : existing.manualProgress,
      startDate: input.startDate !== undefined ? input.startDate : existing.startDate,
      endDate: input.endDate !== undefined ? input.endDate : existing.endDate,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      updatedAt: new Date().toISOString(),
    };
    await db.floorStages.put(updated);
    if (input.status !== undefined && input.status !== existing.status) {
      const event =
        input.status === "in_progress"
          ? { type: "stage_started" as const, messageKey: "floor.activity.stageStarted" }
          : input.status === "blocked"
            ? { type: "stage_blocked" as const, messageKey: "floor.activity.stageBlocked" }
            : input.status === "completed"
              ? { type: "stage_completed" as const, messageKey: "floor.activity.stageCompleted" }
              : null;
      if (event) {
        await floorActivityService.log({
          floorId: updated.floorId,
          stageId: updated.id,
          type: event.type,
          messageKey: event.messageKey,
          params: { title: updated.title },
        });
      }
    }
    return updated;
  },

  async swapOrder(id: string, direction: "up" | "down"): Promise<void> {
    const stage = await db.floorStages.get(id);
    if (!stage) throw new NotFoundError(`مرحله‌ای با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(stage.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این مرحله متعلق به پروژه فعال نیست.");
    const stages = await db.floorStages.where({ floorId: stage.floorId }).sortBy("order");
    const index = stages.findIndex((item) => item.id === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= stages.length) return;
    const target = stages[targetIndex];
    const now = new Date().toISOString();
    await db.transaction("rw", db.floorStages, async () => {
      await db.floorStages.update(stage.id, { order: target.order, updatedAt: now });
      await db.floorStages.update(target.id, { order: stage.order, updatedAt: now });
    });
  },

  async remove(id: string): Promise<void> {
    const existing = await db.floorStages.get(id);
    if (!existing) throw new NotFoundError(`مرحله‌ای با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(existing.floorId);
    if (!floor || floor.projectId !== activeProjectId) throw new NotFoundError("این مرحله متعلق به پروژه فعال نیست.");
    if (!existing.isCustom || STANDARD_STAGE_KEYS.includes(existing.key)) {
      throw new ValidationError("مراحل پیش‌فرض دفترچه طبقه قابل حذف نیستند.");
    }
    // فقط ارتباط Taskها/Issueهای همین مرحله با مرحله قطع می‌شود (خودشان حذف نمی‌شوند)،
    // چون این‌ها به‌طور مستقل به Floor هم متعلق‌اند.
    await db.floorTasks.where({ stageId: id }).modify({ stageId: null });
    await db.floorIssues.where({ stageId: id }).modify({ stageId: null });
    await db.floorPlans.where({ stageId: id }).modify({ stageId: null });
    await db.floorStages.delete(id);
    await floorActivityService.log({
      floorId: existing.floorId,
      stageId: null,
      type: "stage_deleted",
      messageKey: "floor.activity.stageDeleted",
      params: { title: existing.title },
    });
  },

  /** حذف Cascade همهٔ مراحل یک طبقه — فقط از floorService.remove فراخوانی می‌شود. */
  async removeAllForFloor(floorId: string): Promise<void> {
    await db.floorStages.where({ floorId }).delete();
  },
};
