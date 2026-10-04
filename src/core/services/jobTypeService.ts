import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type { CreateJobTypeInput, JobType, UpdateJobTypeInput } from "../../entities/JobType";

export const jobTypeService = {
  async list(): Promise<JobType[]> {
    const items = await db.jobTypes.toArray();
    return items.sort((a, b) => a.name.localeCompare(b.name, "fa"));
  },

  async findByIdOrNull(id: string): Promise<JobType | null> {
    const item = await db.jobTypes.get(id);
    return item ?? null;
  },

  /** ساخت یک تیپ نیروی کاملاً سفارشی — همیشه isBuiltIn=false، پس هرگز snapshot پیش‌فرض ندارد (چیزی برای بازگردانی وجود ندارد). */
  async create(input: CreateJobTypeInput): Promise<JobType> {
    if (!input.name.trim()) throw new ValidationError("نام شغل الزامی است.");

    const now = new Date().toISOString();
    const created: JobType = {
      id: randomUUID(),
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category,
      iconKey: input.iconKey,
      suggestedWageMethodIds: input.suggestedWageMethodIds ?? [],
      wageNote: input.wageNote?.trim() ?? "",
      isBuiltIn: false,
      originalSnapshot: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.jobTypes.add(created);
    return created;
  },

  /**
   * ویرایش یک تیپ نیرو — چه پیش‌فرض چه سفارشی. برای تیپ‌های پیش‌فرض
   * (isBuiltIn=true)، originalSnapshot دست‌نخورده باقی می‌ماند تا
   * «بازگردانی به پیش‌فرض» همیشه ممکن باشد، حتی بعد از چند بار ویرایش.
   */
  async update(id: string, input: UpdateJobTypeInput): Promise<JobType> {
    const existing = await db.jobTypes.get(id);
    if (!existing) throw new NotFoundError(`شغلی با شناسه ${id} یافت نشد.`);

    const updated: JobType = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      category: input.category ?? existing.category,
      iconKey: input.iconKey ?? existing.iconKey,
      suggestedWageMethodIds: input.suggestedWageMethodIds ?? existing.suggestedWageMethodIds,
      wageNote: input.wageNote !== undefined ? input.wageNote.trim() : existing.wageNote,
      updatedAt: new Date().toISOString(),
    };
    if (!updated.name) throw new ValidationError("نام شغل الزامی است.");

    await db.jobTypes.put(updated);
    return updated;
  },

  /**
   * بازگردانی یک تیپ پیش‌فرض به حالت اولیهٔ آن (پیش از هرگونه ویرایش کاربر).
   * برای تیپ‌های سفارشی (بدون originalSnapshot) خطا می‌دهد، چون چیزی برای
   * بازگردانی وجود ندارد.
   */
  async restoreToDefault(id: string): Promise<JobType> {
    const existing = await db.jobTypes.get(id);
    if (!existing) throw new NotFoundError(`شغلی با شناسه ${id} یافت نشد.`);
    if (!existing.isBuiltIn || !existing.originalSnapshot) {
      throw new ValidationError("این تیپ نیرو پیش‌فرض نیست و نسخهٔ اصلی برای بازگردانی ندارد.");
    }

    const restored: JobType = {
      ...existing,
      ...existing.originalSnapshot,
      updatedAt: new Date().toISOString(),
    };
    await db.jobTypes.put(restored);
    return restored;
  },

  /**
   * حذف یک تیپ نیرو. تیپ‌های پیش‌فرض هم قابل حذف‌اند (طبق درخواست کاربر که
   * می‌خواهد کنترل کامل روی فهرست داشته باشد)، اما نیروهای واقعی که از این
   * تیپ استفاده می‌کنند دست‌نخورده می‌مانند — فقط دیگر این شغل به‌عنوان
   * گزینهٔ انتخاب در دسترس نخواهد بود.
   */
  async remove(id: string): Promise<void> {
    const existing = await db.jobTypes.get(id);
    if (!existing) throw new NotFoundError(`شغلی با شناسه ${id} یافت نشد.`);
    await db.jobTypes.delete(id);
  },

  /** کپی یک تیپ نیرو با نام جدید — همیشه به‌عنوان تیپ سفارشی (isBuiltIn=false) ساخته می‌شود. */
  async duplicate(id: string): Promise<JobType> {
    const existing = await db.jobTypes.get(id);
    if (!existing) throw new NotFoundError(`شغلی با شناسه ${id} یافت نشد.`);

    const now = new Date().toISOString();
    const copy: JobType = {
      id: randomUUID(),
      name: `${existing.name} (کپی)`,
      description: existing.description,
      category: existing.category,
      iconKey: existing.iconKey,
      suggestedWageMethodIds: [...existing.suggestedWageMethodIds],
      wageNote: existing.wageNote,
      isBuiltIn: false,
      originalSnapshot: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.jobTypes.add(copy);
    return copy;
  },
};
