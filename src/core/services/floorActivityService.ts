import { randomUUID, monotonicIsoTimestamp } from "../utils/uuid";
import { db } from "../db";
import type { CreateFloorActivityEventInput, FloorActivityEvent } from "../../entities/FloorActivityEvent";
import { projectService } from "./projectService";
import { ValidationError } from "../errors";

export const floorActivityService = {
  /** ثبت یک رخداد جدید در فید فعالیت طبقه — append-only، هرگز ویرایش/حذف نمی‌شود. */
  async log(input: CreateFloorActivityEventInput): Promise<FloorActivityEvent> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(input.floorId);
    if (!floor || floor.projectId !== activeProjectId) {
      throw new ValidationError("طبقهٔ رخداد متعلق به پروژه فعال نیست.");
    }
    if (input.stageId) {
      const stage = await db.floorStages.get(input.stageId);
      if (!stage || stage.floorId !== input.floorId) {
        throw new ValidationError("مرحلهٔ رخداد متعلق به این طبقه نیست.");
      }
    }

    const event: FloorActivityEvent = {
      id: randomUUID(),
      floorId: input.floorId,
      stageId: input.stageId ?? null,
      type: input.type,
      messageKey: input.messageKey,
      params: input.params ?? null,
      createdAt: monotonicIsoTimestamp(),
    };
    await db.floorActivityEvents.add(event);
    return event;
  },

  async listByFloor(floorId: string, limit = 50): Promise<FloorActivityEvent[]> {
    const floor = await db.floors.get(floorId);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (!floor || floor.projectId !== activeProjectId) return [];
    const events = await db.floorActivityEvents.where({ floorId }).toArray();
    return events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
  },

  async removeAllForFloor(floorId: string): Promise<void> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const floor = await db.floors.get(floorId);
    if (!floor || floor.projectId !== activeProjectId) return;
    await db.floorActivityEvents.where({ floorId }).delete();
  },
};
