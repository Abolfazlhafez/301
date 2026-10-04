import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { photoService } from "./photoService";
import { cashboxFundService } from "./cashboxFundService";
import type {
  CashbookEntry,
  CashbookSummary,
  CreateCashbookEntryInput,
  UpdateCashbookEntryInput,
} from "../../entities/Cashbook";

export interface ListCashbookFilter {
  type?: CashbookEntry["type"];
  workerId?: string;
  fundId?: string;
  from?: string;
  to?: string;
  /** فیلتر بر اساس ارتباط با یک طبقهٔ دفترچهٔ دیجیتال. */
  floorId?: string;
}

function matchesFilter(entry: CashbookEntry, filter?: ListCashbookFilter): boolean {
  if (!filter) return true;
  if (filter.type && entry.type !== filter.type) return false;
  if (filter.workerId && entry.workerId !== filter.workerId) return false;
  if (filter.fundId && entry.fundId !== filter.fundId) return false;
  if (filter.from && entry.date < filter.from) return false;
  if (filter.to && entry.date > filter.to) return false;
  if (filter.floorId && entry.floorId !== filter.floorId) return false;
  return true;
}

export const cashbookService = {
  async list(filter?: ListCashbookFilter): Promise<CashbookEntry[]> {
    const all = await db.cashbookEntries.toArray();
    return all.filter((e) => matchesFilter(e, filter)).sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  async getSummary(filter?: ListCashbookFilter): Promise<CashbookSummary> {
    const entries = await this.list(filter);
    const totalExpense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    const totalSalary = entries.filter((e) => e.type === "salary").reduce((s, e) => s + e.amount, 0);
    const totalDeposit = entries.filter((e) => e.type === "deposit").reduce((s, e) => s + e.amount, 0);
    return {
      totalExpense,
      totalSalary,
      totalDeposit,
      net: totalDeposit - totalExpense - totalSalary,
    };
  },

  async create(input: CreateCashbookEntryInput): Promise<CashbookEntry> {
    if (!input.title?.trim()) throw new ValidationError("عنوان تراکنش الزامی است.");
    if (!input.amount || input.amount <= 0) throw new ValidationError("مبلغ باید عددی مثبت باشد.");
    if (!input.date) throw new ValidationError("تاریخ الزامی است.");

    // اگر صندوق مشخص نشده باشد (مثلاً تراکنش‌های خودکاری که از حساب نیرو
    // ثبت می‌شوند)، به صندوق پیش‌فرض نسبت داده می‌شود.
    const fundId = input.fundId || (await cashboxFundService.getDefault()).id;

    const now = new Date().toISOString();
    const entry: CashbookEntry = {
      id: randomUUID(),
      type: input.type,
      title: input.title.trim(),
      amount: input.amount,
      date: input.date,
      description: input.description?.trim() || null,
      fundId,
      workerId: input.workerId || null,
      receiptPhotoId: null,
      floorId: input.floorId || null,
      stageId: input.stageId || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.cashbookEntries.add(entry);

    if (input.receiptFile) {
      const photo = await photoService.upload({
        file: input.receiptFile,
        relatedType: "receipt",
        relatedId: entry.id,
        date: input.date,
        caption: input.title.trim(),
      });
      entry.receiptPhotoId = photo.id;
      entry.updatedAt = new Date().toISOString();
      await db.cashbookEntries.put(entry);
    }

    return entry;
  },

  async update(id: string, input: UpdateCashbookEntryInput): Promise<CashbookEntry> {
    const existing = await db.cashbookEntries.get(id);
    if (!existing) throw new NotFoundError(`تراکنشی با شناسه ${id} یافت نشد.`);

    if (input.amount !== undefined && input.amount <= 0) {
      throw new ValidationError("مبلغ باید عددی مثبت باشد.");
    }

    const updated: CashbookEntry = {
      ...existing,
      type: input.type ?? existing.type,
      title: input.title?.trim() ?? existing.title,
      amount: input.amount ?? existing.amount,
      date: input.date ?? existing.date,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      fundId: input.fundId ?? existing.fundId,
      workerId: input.workerId !== undefined ? input.workerId || null : existing.workerId,
      updatedAt: new Date().toISOString(),
    };
    // فیلدهای متنی را اول ذخیره کن تا خرابی احتمالی در آپلود عکس، ویرایش
    // بقیهٔ فیلدها را از دست نبرد.
    await db.cashbookEntries.put(updated);

    // input.receiptFile === undefined یعنی «بدون تغییر در عکس» — رایج‌ترین
    // حالت (کاربر فقط مبلغ یا توضیح را عوض کرده)، پس اصلاً به عکس دست نمی‌زنیم.
    if (input.receiptFile === undefined) {
      return updated;
    }

    const previousPhotoId = updated.receiptPhotoId;

    if (input.receiptFile === null) {
      // کاربر صراحتاً عکس رسید موجود را حذف کرده، بدون جایگزین.
      if (previousPhotoId) {
        await photoService.remove(previousPhotoId).catch(() => {
          // اگر عکس قبلاً حذف شده بود (مثلاً از یک Restore ناقص)، مشکلی نیست.
        });
      }
      updated.receiptPhotoId = null;
      updated.updatedAt = new Date().toISOString();
      await db.cashbookEntries.put(updated);
      return updated;
    }

    // یک فایل جدید جایگزین عکس فعلی می‌شود (چه رسید قبلاً عکس داشته چه نداشته).
    const photo = await photoService.upload({
      file: input.receiptFile,
      relatedType: "receipt",
      relatedId: updated.id,
      date: updated.date,
      caption: updated.title,
    });
    updated.receiptPhotoId = photo.id;
    updated.updatedAt = new Date().toISOString();
    await db.cashbookEntries.put(updated);

    // عکس قبلی را فقط بعد از موفقیت کامل آپلود عکس جدید پاک کن — اگر آپلود
    // بالا throw کند، این خط اصلاً اجرا نمی‌شود و عکس قدیمی سالم می‌ماند.
    if (previousPhotoId && previousPhotoId !== photo.id) {
      await photoService.remove(previousPhotoId).catch(() => {});
    }

    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.cashbookEntries.get(id);
    if (!existing) throw new NotFoundError(`تراکنشی با شناسه ${id} یافت نشد.`);

    if (existing.receiptPhotoId) {
      await photoService.remove(existing.receiptPhotoId).catch(() => {
        // اگر عکس رسید قبلاً حذف شده بود، مشکلی نیست
      });
    }
    await db.cashbookEntries.delete(id);
  },
};
