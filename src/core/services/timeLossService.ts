import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { calculateMinutesBetween, isValidTimeFormat } from "../payroll";
import type { CreateTimeLossInput, TimeLoss, UpdateTimeLossInput } from "../../entities/TimeLoss";

export const timeLossService = {
  async list(filter?: { workerId?: string; attendanceId?: string }): Promise<TimeLoss[]> {
    let items = await db.timeLosses.toArray();
    if (filter?.workerId) items = items.filter((t) => t.workerId === filter.workerId);
    if (filter?.attendanceId) items = items.filter((t) => t.attendanceId === filter.attendanceId);
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async findByAttendanceId(attendanceId: string): Promise<TimeLoss[]> {
    return db.timeLosses.where({ attendanceId }).toArray();
  },

  async create(input: CreateTimeLossInput): Promise<TimeLoss> {
    if (!input.reason?.trim()) throw new ValidationError("علت اتلاف وقت الزامی است.");
    if (!isValidTimeFormat(input.startTime) || !isValidTimeFormat(input.endTime)) {
      throw new ValidationError("فرمت ساعت باید HH:mm باشد.");
    }

    const attendance = await db.attendances.get(input.attendanceId);
    if (!attendance) throw new NotFoundError(`رکورد حضور با شناسه ${input.attendanceId} یافت نشد.`);

    const duration = calculateMinutesBetween(input.startTime, input.endTime);
    if (duration <= 0) throw new ValidationError("ساعت پایان باید بعد از ساعت شروع باشد.");

    const now = new Date().toISOString();
    const created: TimeLoss = {
      id: randomUUID(),
      workerId: input.workerId,
      attendanceId: input.attendanceId,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: duration,
      reason: input.reason.trim(),
      note: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    await db.timeLosses.add(created);
    return created;
  },

  async update(id: string, input: UpdateTimeLossInput): Promise<TimeLoss> {
    const existing = await db.timeLosses.get(id);
    if (!existing) throw new NotFoundError(`اتلاف وقت با شناسه ${id} یافت نشد.`);

    const startTime = input.startTime ?? existing.startTime;
    const endTime = input.endTime ?? existing.endTime;

    if (input.startTime || input.endTime) {
      const duration = calculateMinutesBetween(startTime, endTime);
      if (duration <= 0) throw new ValidationError("ساعت پایان باید بعد از ساعت شروع باشد.");
    }

    const updated: TimeLoss = {
      ...existing,
      startTime,
      endTime,
      durationMinutes: calculateMinutesBetween(startTime, endTime),
      reason: input.reason?.trim() ?? existing.reason,
      note: input.note !== undefined ? input.note?.trim() || null : existing.note,
      updatedAt: new Date().toISOString(),
    };
    await db.timeLosses.put(updated);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.timeLosses.get(id);
    if (!existing) throw new NotFoundError(`اتلاف وقت با شناسه ${id} یافت نشد.`);
    await db.timeLosses.delete(id);
  },
};
