import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { validateWageFormula, WageFormulaDefinition } from "../wageFormula";
import type { CreateWageMethodInput, UpdateWageMethodInput, WageMethod } from "../../entities/JobType";

export const wageMethodService = {
  async list(): Promise<WageMethod[]> {
    const items = await db.wageMethods.toArray();
    return items.sort((a, b) => a.formula.name.localeCompare(b.formula.name, "fa"));
  },

  async findByIdOrNull(id: string): Promise<WageMethod | null> {
    const item = await db.wageMethods.get(id);
    return item ?? null;
  },

  async create(input: CreateWageMethodInput): Promise<WageMethod> {
    const errors = validateWageFormula(input.formula);
    if (errors.length > 0) throw new ValidationError(errors.join(" "));

    const now = new Date().toISOString();
    const formulaWithId: WageFormulaDefinition = { ...input.formula, id: randomUUID() };
    const created: WageMethod = {
      id: formulaWithId.id,
      formula: formulaWithId,
      isBuiltIn: false,
      originalSnapshot: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.wageMethods.add(created);
    return created;
  },

  /** ویرایش یک روش محاسبه — چه پیش‌فرض چه سفارشی؛ برای پیش‌فرض‌ها originalSnapshot دست‌نخورده می‌ماند. */
  async update(id: string, input: UpdateWageMethodInput): Promise<WageMethod> {
    const existing = await db.wageMethods.get(id);
    if (!existing) throw new NotFoundError(`روش محاسبه‌ای با شناسه ${id} یافت نشد.`);

    const errors = validateWageFormula(input.formula);
    if (errors.length > 0) throw new ValidationError(errors.join(" "));

    const updated: WageMethod = {
      ...existing,
      formula: { ...input.formula, id },
      updatedAt: new Date().toISOString(),
    };
    await db.wageMethods.put(updated);
    return updated;
  },

  async restoreToDefault(id: string): Promise<WageMethod> {
    const existing = await db.wageMethods.get(id);
    if (!existing) throw new NotFoundError(`روش محاسبه‌ای با شناسه ${id} یافت نشد.`);
    if (!existing.isBuiltIn || !existing.originalSnapshot) {
      throw new ValidationError("این روش محاسبه پیش‌فرض نیست و نسخهٔ اصلی برای بازگردانی ندارد.");
    }

    const restored: WageMethod = {
      ...existing,
      formula: existing.originalSnapshot,
      updatedAt: new Date().toISOString(),
    };
    await db.wageMethods.put(restored);
    return restored;
  },

  /**
   * حذف یک روش محاسبه. اگر نیرویی هم‌اکنون از این روش استفاده کند
   * (WageAssignment.wageMethodId)، آن آیتم‌های دستمزد به‌جای باقی‌ماندن
   * به‌صورت «یتیم» (که در UI فقط با متن «نامشخص» دیده می‌شدند و امکان
   * محاسبهٔ جدید هم دیگر نداشتند)، به‌طور خودکار غیرفعال می‌شوند —
   * تاریخچهٔ محاسبات گذشتهٔ آن‌ها (formulaSnapshot در هر رکورد) دست‌نخورده
   * و کاملاً قابل‌مشاهده می‌ماند، فقط دیگر امکان ثبت محاسبهٔ جدید با یک
   * روش حذف‌شده وجود ندارد؛ کاربر می‌تواند بعداً روش دیگری برای آن‌ها
   * انتخاب کند.
   */
  async remove(id: string): Promise<void> {
    const existing = await db.wageMethods.get(id);
    if (!existing) throw new NotFoundError(`روش محاسبه‌ای با شناسه ${id} یافت نشد.`);

    const affectedAssignments = await db.wageAssignments.where("wageMethodId").equals(id).toArray();
    if (affectedAssignments.length > 0) {
      const now = new Date().toISOString();
      await db.wageAssignments.bulkPut(
        affectedAssignments.map((a) => ({ ...a, isActive: false, updatedAt: now }))
      );
    }

    await db.wageMethods.delete(id);
  },

  async duplicate(id: string): Promise<WageMethod> {
    const existing = await db.wageMethods.get(id);
    if (!existing) throw new NotFoundError(`روش محاسبه‌ای با شناسه ${id} یافت نشد.`);

    const now = new Date().toISOString();
    const newFormulaId = randomUUID();
    const copy: WageMethod = {
      id: newFormulaId,
      formula: { ...existing.formula, id: newFormulaId, name: `${existing.formula.name} (کپی)` },
      isBuiltIn: false,
      originalSnapshot: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.wageMethods.add(copy);
    return copy;
  },

  /** تعداد آیتم‌های دستمزدی که هم‌اکنون از این روش استفاده می‌کنند — برای هشدار قبل از حذف. */
  async countUsages(id: string): Promise<number> {
    return db.wageAssignments.where("wageMethodId").equals(id).count();
  },
};
