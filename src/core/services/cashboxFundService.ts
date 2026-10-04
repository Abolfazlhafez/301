import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { projectService } from "./projectService";
import type { CashboxFund, CreateCashboxFundInput, UpdateCashboxFundInput } from "../../entities/CashboxFund";

export const cashboxFundService = {
  async list(): Promise<CashboxFund[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const all = await db.cashboxFunds.where({ projectId: activeProjectId }).toArray();
    return all.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name, "fa");
    });
  },

  /** صندوق پیش‌فرض *همین پروژهٔ فعال* — هر پروژه دقیقاً یک صندوق پیش‌فرض مستقل از خودش دارد. */
  async getDefault(): Promise<CashboxFund> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const all = await db.cashboxFunds.where({ projectId: activeProjectId }).toArray();
    const def = all.find((f) => f.isDefault);
    if (def) return def;
    if (all[0]) return all[0];
    throw new NotFoundError("هیچ صندوقی برای این پروژه تعریف نشده است.");
  },

  async create(input: CreateCashboxFundInput): Promise<CashboxFund> {
    if (!input.name?.trim()) throw new ValidationError("نام صندوق الزامی است.");

    const projectId = await projectService.getOrCreateActiveProjectId();

    // اگر این اولین صندوق این پروژه باشد، باید پیش‌فرض هم باشد. وگرنه هیچ
    // صندوقی isDefault=true ندارد و دو جای دیگر که به این متکی‌اند از کار
    // می‌افتند: هم قفل «صندوق پیش‌فرض حذف نمی‌شود» در remove() (که با
    // isDefault=false برای تنها صندوق موجود بی‌اثر می‌ماند و اجازه می‌دهد
    // کاربر تنها صندوقش را حذف کند)، و هم انتخاب خودکار صندوق در صفحهٔ
    // دفتر حساب — که با نبود صندوق دوباره به همان بن‌بست «برای همیشه در
    // حال بارگذاری» برمی‌گردد.
    const existingCount = await db.cashboxFunds.where({ projectId }).count();

    const now = new Date().toISOString();
    const fund: CashboxFund = {
      id: randomUUID(),
      projectId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      isDefault: existingCount === 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.cashboxFunds.add(fund);
    return fund;
  },

  async update(id: string, input: UpdateCashboxFundInput): Promise<CashboxFund> {
    const existing = await db.cashboxFunds.get(id);
    if (!existing) throw new NotFoundError(`صندوقی با شناسه ${id} یافت نشد.`);
    if (input.name !== undefined && !input.name.trim()) {
      throw new ValidationError("نام صندوق الزامی است.");
    }

    const updated: CashboxFund = {
      ...existing,
      name: input.name?.trim() ?? existing.name,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      updatedAt: new Date().toISOString(),
    };
    await db.cashboxFunds.put(updated);
    return updated;
  },

  /** این صندوق را صندوق پیش‌فرض جدید می‌کند — فقط در محدودهٔ همان پروژه‌ای که این صندوق به آن تعلق دارد. */
  async setDefault(id: string): Promise<void> {
    const target = await db.cashboxFunds.get(id);
    if (!target) throw new NotFoundError(`صندوقی با شناسه ${id} یافت نشد.`);
    const sameProjectFunds = await db.cashboxFunds.where({ projectId: target.projectId }).toArray();

    const now = new Date().toISOString();
    await db.transaction("rw", db.cashboxFunds, async () => {
      for (const f of sameProjectFunds) {
        const shouldBeDefault = f.id === id;
        if (f.isDefault !== shouldBeDefault) {
          await db.cashboxFunds.put({ ...f, isDefault: shouldBeDefault, updatedAt: now });
        }
      }
    });
  },

  async remove(id: string): Promise<void> {
    const existing = await db.cashboxFunds.get(id);
    if (!existing) throw new NotFoundError(`صندوقی با شناسه ${id} یافت نشد.`);
    if (existing.isDefault) {
      throw new ValidationError("صندوق پیش‌فرض قابل حذف نیست. ابتدا یک صندوق دیگر را پیش‌فرض کنید.");
    }

    const entriesCount = await db.cashbookEntries.where({ fundId: id }).count();
    if (entriesCount > 0) {
      throw new ValidationError(
        "این صندوق تراکنش ثبت‌شده دارد و قابل حذف نیست. ابتدا تراکنش‌های آن را حذف یا به صندوق دیگری منتقل کنید."
      );
    }

    await db.cashboxFunds.delete(id);
  },
};
