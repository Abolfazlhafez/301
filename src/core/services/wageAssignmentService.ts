import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type { CreateWageAssignmentInput, UpdateWageAssignmentInput, WageAssignment } from "../../entities/WageAssignment";

export const wageAssignmentService = {
  async listByWorker(workerId: string, includeInactive = false): Promise<WageAssignment[]> {
    const items = await db.wageAssignments.where("workerId").equals(workerId).toArray();
    const filtered = includeInactive ? items : items.filter((a) => a.isActive);
    return filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async findByIdOrNull(id: string): Promise<WageAssignment | null> {
    const item = await db.wageAssignments.get(id);
    return item ?? null;
  },

  /**
   * ثبت یک «آیتم دستمزد» جدید برای یک نیرو. طبق نیاز صریح، یک نیرو می‌تواند
   * چند آیتم هم‌زمان داشته باشد (مثلاً هم دیوارچینی مترمربعی، هم کار متفرقه
   * روزمزد) — پس برخلاف Attendance/OptionalLeave، این‌جا محدودیت «حداکثر
   * یکی به ازای هر نیرو» وجود ندارد.
   */
  async create(input: CreateWageAssignmentInput): Promise<WageAssignment> {
    if (!input.workerId) throw new ValidationError("شناسهٔ نیرو الزامی است.");
    if (!input.wageMethodId) throw new ValidationError("انتخاب روش محاسبه الزامی است.");
    if (!input.label.trim()) throw new ValidationError("عنوان آیتم دستمزد الزامی است.");

    const method = await db.wageMethods.get(input.wageMethodId);
    if (!method) throw new NotFoundError("روش محاسبهٔ انتخاب‌شده یافت نشد.");

    const now = new Date().toISOString();
    const created: WageAssignment = {
      id: randomUUID(),
      workerId: input.workerId,
      wageMethodId: input.wageMethodId,
      label: input.label.trim(),
      defaultVariableValues: input.defaultVariableValues ?? {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.wageAssignments.add(created);
    return created;
  },

  async update(id: string, input: UpdateWageAssignmentInput): Promise<WageAssignment> {
    const existing = await db.wageAssignments.get(id);
    if (!existing) throw new NotFoundError(`آیتم دستمزدی با شناسه ${id} یافت نشد.`);

    if (input.wageMethodId) {
      const method = await db.wageMethods.get(input.wageMethodId);
      if (!method) throw new NotFoundError("روش محاسبهٔ انتخاب‌شده یافت نشد.");
    }

    const updated: WageAssignment = {
      ...existing,
      wageMethodId: input.wageMethodId ?? existing.wageMethodId,
      label: input.label !== undefined ? input.label.trim() : existing.label,
      defaultVariableValues: input.defaultVariableValues ?? existing.defaultVariableValues,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: new Date().toISOString(),
    };
    if (!updated.label) throw new ValidationError("عنوان آیتم دستمزد الزامی است.");

    await db.wageAssignments.put(updated);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.wageAssignments.get(id);
    if (!existing) throw new NotFoundError(`آیتم دستمزدی با شناسه ${id} یافت نشد.`);
    await db.wageAssignments.delete(id);
  },
};
