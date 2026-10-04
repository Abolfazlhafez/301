import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { workerService } from "./workerService";
import { projectService } from "./projectService";
import type { OptionalLeave, UpsertOptionalLeaveInput } from "../../entities/OptionalLeave";

export interface ListOptionalLeavesFilter {
  workerId?: string;
  date?: string;
  from?: string;
  to?: string;
}

function matchesFilter(l: OptionalLeave, filter?: ListOptionalLeavesFilter): boolean {
  if (!filter) return true;
  if (filter.workerId && l.workerId !== filter.workerId) return false;
  if (filter.date && l.date !== filter.date) return false;
  if (filter.from && l.date < filter.from) return false;
  if (filter.to && l.date > filter.to) return false;
  return true;
}

export const optionalLeaveService = {
  async list(filter?: ListOptionalLeavesFilter): Promise<OptionalLeave[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const items = await db.optionalLeaves.where({ projectId: activeProjectId }).toArray();
    return items.filter((l) => matchesFilter(l, filter)).sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  async findByWorkerAndDate(workerId: string, date: string): Promise<OptionalLeave | null> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const item = await db.optionalLeaves.where({ projectId: activeProjectId, workerId, date }).first();
    return item ?? null;
  },

  /**
   * ثبت/به‌روزرسانی غیبت مجاز برای یک نیرو در یک تاریخ مشخص (حداکثر یک رکورد
   * به ازای هر نیرو-تاریخ، مثل الگوی Attendance). قبل از ثبت، بررسی می‌شود
   * که برای همین نیرو-تاریخ، رکورد حضور واقعی (Attendance) موجود نباشد —
   * چون نمی‌شود هم‌زمان هم حاضر بود و هم در مرخصی؛ این یک تناقض منطقی است
   * که باید همین‌جا جلوی آن گرفته شود، نه این‌که بعداً در گزارش‌ها گیج‌کننده
   * ظاهر شود.
   */
  async upsert(input: UpsertOptionalLeaveInput): Promise<OptionalLeave> {
    if (!input.workerId) throw new ValidationError("شناسه نیرو الزامی است.");
    if (!input.date) throw new ValidationError("تاریخ الزامی است.");

    const worker = await workerService.findByIdOrNull(input.workerId);
    if (!worker) throw new NotFoundError(`نیرویی با شناسه ${input.workerId} یافت نشد.`);

    const existingAttendance = await db.attendances.where({ workerId: input.workerId, date: input.date }).first();
    if (existingAttendance && (existingAttendance.checkIn || existingAttendance.checkOut)) {
      throw new ValidationError(
        "برای این نیرو در این تاریخ حضور واقعی ثبت شده است. ابتدا آن را حذف کنید تا بتوانید غیبت مجاز ثبت کنید."
      );
    }

    const existing = await this.findByWorkerAndDate(input.workerId, input.date);
    const now = new Date().toISOString();

    if (existing) {
      const updated: OptionalLeave = {
        ...existing,
        type: input.type,
        isPaid: input.isPaid,
        note: input.note !== undefined ? input.note?.trim() || null : existing.note,
        updatedAt: now,
      };
      await db.optionalLeaves.put(updated);
      return updated;
    }

    const created: OptionalLeave = {
      id: randomUUID(),
      projectId: await projectService.getOrCreateActiveProjectId(),
      workerId: input.workerId,
      date: input.date,
      type: input.type,
      isPaid: input.isPaid,
      note: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    await db.optionalLeaves.add(created);
    return created;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.optionalLeaves.get(id);
    if (!existing) throw new NotFoundError(`غیبت مجاز با شناسه ${id} یافت نشد.`);
    await db.optionalLeaves.delete(id);
  },
};
