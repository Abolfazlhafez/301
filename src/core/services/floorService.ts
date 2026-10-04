import { randomUUID } from "../utils/uuid";
import { db, type PhotoWithBlob } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type { CreateFloorInput, Floor, FloorHealthFactor, FloorWithStats, UpdateFloorInput } from "../../entities/Floor";
import { floorStageService } from "./floorStageService";
import { floorChecklistService } from "./floorChecklistService";
import { floorActivityService } from "./floorActivityService";
import { floorTaskService } from "./floorTaskService";
import { floorIssueService } from "./floorIssueService";
import { floorPlanService } from "./floorPlanService";
import { floorWorkerService } from "./floorWorkerService";
import { projectService } from "./projectService";

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function computeFloorProgress(floor: Floor): Promise<number> {
  if (floor.progressMode === "manual" && floor.manualProgress !== null) {
    return clampProgress(floor.manualProgress);
  }
  const stages = await db.floorStages.where({ floorId: floor.id }).toArray();
  if (stages.length === 0) return 0;
  const totalWeight = stages.reduce((acc, s) => acc + s.weight, 0);
  if (totalWeight <= 0) return 0;

  const stagesWithProgress = await floorStageService.listByFloor(floor.id);
  const weighted = stagesWithProgress.reduce((acc, s) => acc + s.progress * s.weight, 0);
  return clampProgress(weighted / totalWeight);
}

/**
 * امتیاز سلامت طبقه (۰ تا ۱۰۰) — یک سیگنال ساده و شفاف مدیریتی، نه معیار
 * علمی دقیق: از ۱۰۰ شروع می‌شود و به‌ازای هر نشانهٔ نگران‌کننده (مشکل حیاتی
 * باز، مرحلهٔ گیرکرده، عقب‌افتادگی از موعد، چک‌لیست ردشده) جریمه می‌گیرد.
 * تعمداً به‌عنوان مقداری derived (نه ذخیره‌شده) محاسبه می‌شود تا هرگز stale نشود.
 */
function computeHealthScore(params: {
  criticalOpenIssuesCount: number;
  openIssuesCount: number;
  blockedStagesCount: number;
  overdueTasksCount: number;
  failedChecklistCount: number;
}): number {
  let score = 100;
  score -= params.criticalOpenIssuesCount * 15;
  score -= Math.max(0, params.openIssuesCount - params.criticalOpenIssuesCount) * 5;
  score -= params.blockedStagesCount * 10;
  score -= params.overdueTasksCount * 5;
  score -= params.failedChecklistCount * 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * تفکیک عوامل جریمه‌کننده در healthScore — دقیقاً با همان وزن‌هایی که در
 * computeHealthScore استفاده شده، تا این دو تابع همیشه هم‌راستا بمانند و
 * جمع پنالتی‌ها با ۱۰۰ منهای healthScore (تا سقف صفر) یکی باشد.
 */
function computeHealthBreakdown(params: {
  criticalOpenIssuesCount: number;
  openIssuesCount: number;
  blockedStagesCount: number;
  overdueTasksCount: number;
  failedChecklistCount: number;
}): FloorHealthFactor[] {
  const nonCriticalOpenIssues = Math.max(0, params.openIssuesCount - params.criticalOpenIssuesCount);
  const factors: FloorHealthFactor[] = [
    {
      labelKey: "floor.health.factors.criticalIssues",
      count: params.criticalOpenIssuesCount,
      penalty: params.criticalOpenIssuesCount * 15,
    },
    {
      labelKey: "floor.health.factors.otherOpenIssues",
      count: nonCriticalOpenIssues,
      penalty: nonCriticalOpenIssues * 5,
    },
    {
      labelKey: "floor.health.factors.blockedStages",
      count: params.blockedStagesCount,
      penalty: params.blockedStagesCount * 10,
    },
    {
      labelKey: "floor.health.factors.overdueTasks",
      count: params.overdueTasksCount,
      penalty: params.overdueTasksCount * 5,
    },
    {
      labelKey: "floor.health.factors.failedChecklist",
      count: params.failedChecklistCount,
      penalty: params.failedChecklistCount * 8,
    },
  ];
  return factors.filter((f) => f.penalty > 0);
}

async function withStats(floor: Floor): Promise<FloorWithStats> {
  const today = new Date().toISOString().slice(0, 10);
  const [progress, stages, tasks, issues, checklist, linkedCashbook, lastActivity] = await Promise.all([
    computeFloorProgress(floor),
    db.floorStages.where({ floorId: floor.id }).toArray(),
    db.floorTasks.where({ floorId: floor.id }).toArray(),
    db.floorIssues.where({ floorId: floor.id }).toArray(),
    db.floorChecklistItems.where({ floorId: floor.id }).toArray(),
    db.cashbookEntries.where({ floorId: floor.id }).toArray(),
    floorActivityService.listByFloor(floor.id, 1),
  ]);

  const openTasksCount = tasks.filter((t) => t.status !== "done").length;
  const overdueTasksCount = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;
  const openIssues = issues.filter((i) => i.status === "open" || i.status === "in_progress");
  const criticalOpenIssuesCount = openIssues.filter((i) => i.severity === "critical").length;
  const blockedStagesCount = stages.filter((s) => s.status === "blocked").length;
  const failedChecklistCount = checklist.filter((c) => c.status === "failed").length;
  const completedStagesCount = stages.filter((s) => s.status === "completed").length;
  const linkedCashbookTotal = linkedCashbook.reduce(
    (acc, e) => acc + (e.type === "deposit" ? 0 : e.amount),
    0
  );

  return {
    ...floor,
    progress,
    openTasksCount,
    openIssuesCount: openIssues.length,
    criticalOpenIssuesCount,
    stagesCount: stages.length,
    completedStagesCount,
    linkedCashbookTotal,
    lastActivityAt: lastActivity[0]?.createdAt ?? null,
    healthScore: computeHealthScore({
      criticalOpenIssuesCount,
      openIssuesCount: openIssues.length,
      blockedStagesCount,
      overdueTasksCount,
      failedChecklistCount,
    }),
    healthBreakdown: computeHealthBreakdown({
      criticalOpenIssuesCount,
      openIssuesCount: openIssues.length,
      blockedStagesCount,
      overdueTasksCount,
      failedChecklistCount,
    }),
  };
}


async function getActiveProjectFloor(id: string): Promise<Floor> {
  const floor = await db.floors.get(id);
  if (!floor) throw new NotFoundError(`طبقه‌ای با شناسه ${id} یافت نشد.`);
  const activeProjectId = await projectService.getOrCreateActiveProjectId();
  if (floor.projectId !== activeProjectId) {
    throw new NotFoundError(`طبقه‌ای با شناسه ${id} در پروژه فعال یافت نشد.`);
  }
  return floor;
}

export const floorService = {
  async list(): Promise<FloorWithStats[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floors = await db.floors.where({ projectId: activeProjectId }).toArray();
    const sorted = floors.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    return Promise.all(sorted.map(withStats));
  },

  async getById(id: string): Promise<FloorWithStats | null> {
    const floor = await db.floors.get(id);
    if (!floor) return null;
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (floor.projectId !== activeProjectId) return null;
    return withStats(floor);
  },

  async getRaw(id: string): Promise<Floor | null> {
    return (await db.floors.get(id)) ?? null;
  },

  async create(input: CreateFloorInput): Promise<Floor> {
    if (!input.name?.trim()) throw new ValidationError("نام طبقه الزامی است.");
    if (input.area !== undefined && input.area !== null && input.area < 0) {
      throw new ValidationError("متراژ نمی‌تواند منفی باشد.");
    }
    const unitType = input.unitType ?? "single";
    if (unitType === "multi") {
      if (input.unitCount === undefined || input.unitCount === null || input.unitCount < 1) {
        throw new ValidationError("برای طبقهٔ چندواحدی، تعداد واحد باید حداقل ۱ باشد.");
      }
    }

    const now = new Date().toISOString();
    const created: Floor = {
      id: randomUUID(),
      projectId: await projectService.getOrCreateActiveProjectId(),
      name: input.name.trim(),
      number: input.number ?? null,
      usageType: input.usageType,
      area: input.area ?? null,
      height: input.height ?? null,
      description: input.description?.trim() || null,
      status: input.status ?? "not_started",
      progressMode: "calculated",
      manualProgress: null,
      unitType,
      unitCount: unitType === "multi" ? (input.unitCount ?? null) : null,
      createdAt: now,
      updatedAt: now,
    };
    await db.floors.add(created);

    // seed مراحل استاندارد و چک‌لیست پیش‌فرض — این‌ها بخش لاینفک تجربهٔ «دفترچهٔ طبقه» هستند.
    await floorStageService.seedStandardStages(created.id);
    await floorChecklistService.seedDefaults(created.id);
    await floorActivityService.log({
      floorId: created.id,
      type: "floor_created",
      messageKey: "floor.activity.floorCreated",
      params: { name: created.name },
    });

    return created;
  },

  async update(id: string, input: UpdateFloorInput): Promise<Floor> {
    const existing = await getActiveProjectFloor(id);
    if (input.area !== undefined && input.area !== null && input.area < 0) {
      throw new ValidationError("متراژ نمی‌تواند منفی باشد.");
    }
    if (input.manualProgress !== undefined && input.manualProgress !== null) {
      if (input.manualProgress < 0 || input.manualProgress > 100) {
        throw new ValidationError("درصد پیشرفت باید بین ۰ تا ۱۰۰ باشد.");
      }
    }
    const nextUnitType = input.unitType ?? existing.unitType;
    if (nextUnitType === "multi") {
      const nextUnitCount = input.unitCount !== undefined ? input.unitCount : existing.unitCount;
      if (nextUnitCount === null || nextUnitCount === undefined || nextUnitCount < 1) {
        throw new ValidationError("برای طبقهٔ چندواحدی، تعداد واحد باید حداقل ۱ باشد.");
      }
    }

    const statusChanged = input.status !== undefined && input.status !== existing.status;
    const updated: Floor = {
      ...existing,
      name: input.name?.trim() ?? existing.name,
      number: input.number !== undefined ? input.number : existing.number,
      usageType: input.usageType ?? existing.usageType,
      area: input.area !== undefined ? input.area : existing.area,
      height: input.height !== undefined ? input.height : existing.height,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      status: input.status ?? existing.status,
      progressMode: input.progressMode ?? existing.progressMode,
      manualProgress: input.manualProgress !== undefined ? input.manualProgress : existing.manualProgress,
      unitType: nextUnitType,
      unitCount: nextUnitType === "multi" ? (input.unitCount !== undefined ? input.unitCount : existing.unitCount) : null,
      updatedAt: new Date().toISOString(),
    };
    await db.floors.put(updated);
    if (statusChanged) {
      await floorActivityService.log({
        floorId: updated.id,
        type: "floor_status_changed",
        messageKey: "floor.activity.floorStatusChanged",
        params: { status: updated.status },
      });
    }
    return updated;
  },

  /**
   * حذف طبقه: چون طبقه «مالک» دادهٔ خودش (مراحل/کارها/نقشه/مشکل/چک‌لیست/فعالیت)
   * است، این‌ها Cascade حذف می‌شوند. اما دو نوع داده که مستقل از طبقه هم معنا
   * دارند (Worker و تراکنش دفتر حساب و عکس) هرگز حذف نمی‌شوند — فقط ارتباطشان
   * با طبقه قطع می‌شود، دقیقاً طبق اصل «اولویت با حفظ داده».
   */
  /**
   * کپی کامل دفترچهٔ طبقه در همان پروژه. داده‌های وابستهٔ خود دفترچه کپی می‌شوند،
   * اما تراکنش‌های مالی و گزارش‌های عمومی دوباره‌سازی نمی‌شوند تا دادهٔ مالی/تاریخی
   * ناخواسته دو بار ثبت نشود. ارتباط‌های مرحله/کار/مشکل/چک‌لیست و فایل‌های عکس نیز
   * با شناسه‌های جدید بازسازی می‌شوند.
   */
  async duplicate(id: string): Promise<Floor> {
    const source = await getActiveProjectFloor(id);
    const now = new Date().toISOString();
    const newFloorId = randomUUID();
    const newFloorName = `${source.name} (کپی)`;

    const [stages, tasks, plans, issues, workers, checklist, photos] = await Promise.all([
      db.floorStages.where({ floorId: id }).toArray(),
      db.floorTasks.where({ floorId: id }).toArray(),
      db.floorPlans.where({ floorId: id }).toArray(),
      db.floorIssues.where({ floorId: id }).toArray(),
      db.floorWorkers.where({ floorId: id }).toArray(),
      db.floorChecklistItems.where({ floorId: id }).toArray(),
      db.photos.where({ floorId: id }).toArray(),
    ]);

    const stageMap = new Map(stages.map((item) => [item.id, randomUUID()]));
    const taskMap = new Map(tasks.map((item) => [item.id, randomUUID()]));
    const issueMap = new Map(issues.map((item) => [item.id, randomUUID()]));
    const checklistMap = new Map(checklist.map((item) => [item.id, randomUUID()]));
    const planMap = new Map(plans.map((item) => [item.id, randomUUID()]));
    const photoMap = new Map(photos.map((item) => [item.id, randomUUID()]));

    const clonedFloor: Floor = {
      ...source,
      id: newFloorId,
      name: newFloorName,
      createdAt: now,
      updatedAt: now,
    };

    const clonedStages = stages.map((item) => ({
      ...item,
      id: stageMap.get(item.id)!,
      floorId: newFloorId,
      createdAt: now,
      updatedAt: now,
    }));

    const clonedTasks = tasks.map((item) => ({
      ...item,
      id: taskMap.get(item.id)!,
      floorId: newFloorId,
      stageId: item.stageId ? stageMap.get(item.stageId) ?? null : null,
      createdAt: now,
      updatedAt: now,
    }));

    const clonedPlans = plans.map((item) => ({
      ...item,
      id: planMap.get(item.id)!,
      floorId: newFloorId,
      stageId: item.stageId ? stageMap.get(item.stageId) ?? null : null,
      filePhotoId: item.filePhotoId ? photoMap.get(item.filePhotoId) ?? null : null,
      parentPlanId: item.parentPlanId ? planMap.get(item.parentPlanId) ?? null : null,
      createdAt: now,
      updatedAt: now,
    }));

    const clonedIssues = issues.map((item) => ({
      ...item,
      id: issueMap.get(item.id)!,
      floorId: newFloorId,
      stageId: item.stageId ? stageMap.get(item.stageId) ?? null : null,
      taskId: item.taskId ? taskMap.get(item.taskId) ?? null : null,
      createdAt: now,
      updatedAt: now,
    }));

    const clonedWorkers = workers.map((item) => ({
      ...item,
      id: randomUUID(),
      floorId: newFloorId,
      stageId: item.stageId ? stageMap.get(item.stageId) ?? null : null,
      createdAt: now,
    }));

    const clonedChecklist = checklist.map((item) => ({
      ...item,
      id: checklistMap.get(item.id)!,
      floorId: newFloorId,
      createdAt: now,
      updatedAt: now,
    }));

    const clonedPhotos: PhotoWithBlob[] = [];
    for (const item of photos) {
      // فایل واقعی هر عکس از دیسک خوانده و برای کپی جدید دوباره نوشته می‌شود.
      const blob = await db.readBlob("photos", item.id, "blob");
      if (!blob) continue; // فایل اصلی موجود نیست؛ کپی بی‌فایل ساخته نمی‌شود.
      const displayBlob = item.displayBlobUrl ? (await db.readBlob("photos", item.id, "displayBlob")) ?? undefined : undefined;
      const { blobUrl: _b, displayBlobUrl: _d, thumbBlobUrl: _t, ...meta } = item;
      clonedPhotos.push({
      ...meta,
      blob,
      displayBlob,
      id: photoMap.get(item.id)!,
      floorId: newFloorId,
      stageId: item.stageId ? stageMap.get(item.stageId) ?? null : null,
      taskId: item.taskId ? taskMap.get(item.taskId) ?? null : null,
      issueId: item.issueId ? issueMap.get(item.issueId) ?? null : null,
      checklistItemId: item.checklistItemId ? checklistMap.get(item.checklistItemId) ?? null : null,
      relatedId: item.relatedType === "floor" ? newFloorId : item.relatedId,
      filename: `${photoMap.get(item.id)!}.${item.originalName.split(".").pop() || "jpg"}`,
      createdAt: now,
      });
    }

    await db.transaction(
      "rw",
      [
        db.floors,
        db.floorStages,
        db.floorTasks,
        db.floorPlans,
        db.floorIssues,
        db.floorWorkers,
        db.floorChecklistItems,
        db.photos,
      ],
      async () => {
        await db.floors.add(clonedFloor);
        if (clonedStages.length) await db.floorStages.bulkAdd(clonedStages);
        if (clonedTasks.length) await db.floorTasks.bulkAdd(clonedTasks);
        if (clonedPlans.length) await db.floorPlans.bulkAdd(clonedPlans);
        if (clonedIssues.length) await db.floorIssues.bulkAdd(clonedIssues);
        if (clonedWorkers.length) await db.floorWorkers.bulkAdd(clonedWorkers);
        if (clonedChecklist.length) await db.floorChecklistItems.bulkAdd(clonedChecklist);
        if (clonedPhotos.length) await db.photos.bulkAdd(clonedPhotos);
      }
    );

    await floorActivityService.log({
      floorId: newFloorId,
      type: "floor_created",
      messageKey: "floor.activity.floorCreated",
      params: { name: clonedFloor.name },
    });
    return clonedFloor;
  },

  async remove(id: string): Promise<void> {
    await getActiveProjectFloor(id);

    await db.cashbookEntries.where({ floorId: id }).modify({ floorId: null, stageId: null });
    // هر عکسی که به خود طبقه/مرحله/کار آن متصل است باید هنگام حذف طبقه
    // فقط Unlink شود؛ Blob و سابقهٔ عکس هرگز نباید به‌خاطر حذف Floor از بین برود.
    await db.photos.where({ floorId: id }).modify({ floorId: null, stageId: null, taskId: null, issueId: null, checklistItemId: null });

    await floorTaskService.removeAllForFloor(id);
    await floorIssueService.removeAllForFloor(id);
    await floorPlanService.removeAllForFloor(id);
    await floorWorkerService.removeAllForFloor(id);
    await floorChecklistService.removeAllForFloor(id);
    await floorStageService.removeAllForFloor(id);
    await floorActivityService.removeAllForFloor(id);
    await db.floors.delete(id);
  },
};
