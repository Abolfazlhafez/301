import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { projectService } from "./projectService";
import { cashbookService } from "./cashbookService";
import type { CreateGroupWagePaymentInput, GroupWagePayment } from "../../entities/WorkerGroup";

export const groupWagePaymentService = {
  /** فهرست پرداخت‌های جمعی یک اکیپ مشخص، جدیدترین اول. */
  async listByGroup(groupId: string): Promise<GroupWagePayment[]> {
    const all = await db.groupWagePayments.where({ groupId }).toArray();
    return all.sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  /** جمع کل تمام پرداخت‌های جمعی ثبت‌شده برای یک اکیپ. */
  async totalForGroup(groupId: string): Promise<number> {
    const payments = await this.listByGroup(groupId);
    return payments.reduce((sum, p) => sum + p.totalAmount, 0);
  },

  /**
   * ثبت یک پرداخت جمعی جدید برای یک اکیپ. طبق نیاز صریح کاربر، این مبلغ
   * سرانهٔ هر عضو نیست — کل مبلغ قابل‌پرداخت به کل اکیپ است و تقسیم آن
   * بین اعضا اصلاً وارد این سیستم نمی‌شود. برای این‌که این پرداخت هم در
   * گردش مالی صندوق دیده شود، یک تراکنش «پرداخت حقوق» مرتبط در دفتر حساب
   * کلی (بدون workerId مشخص، چون به یک نفر تعلق ندارد) ساخته می‌شود.
   */
  async create(input: CreateGroupWagePaymentInput): Promise<GroupWagePayment> {
    if (!input.label.trim()) throw new ValidationError("عنوان کار الزامی است.");
    if (!input.totalAmount || input.totalAmount <= 0) throw new ValidationError("مبلغ کل باید عددی مثبت باشد.");
    if (!input.date) throw new ValidationError("تاریخ الزامی است.");

    const group = await db.workerGroups.get(input.groupId);
    if (!group) throw new NotFoundError(`اکیپی با شناسه ${input.groupId} یافت نشد.`);

    const projectId = await projectService.getOrCreateActiveProjectId();

    const cashbookEntry = await cashbookService.create({
      type: "salary",
      title: `پرداخت جمعی اکیپ ${group.name} — ${input.label.trim()}`,
      amount: input.totalAmount,
      date: input.date,
      description: "پرداخت گروهی؛ تقسیم بین اعضای اکیپ به عهدهٔ خودشان است.",
      fundId: input.fundId || undefined,
      workerId: null,
    });

    const now = new Date().toISOString();
    const created: GroupWagePayment = {
      id: randomUUID(),
      projectId,
      groupId: input.groupId,
      label: input.label.trim(),
      totalAmount: input.totalAmount,
      date: input.date,
      note: input.note?.trim() || null,
      cashbookEntryId: cashbookEntry.id,
      createdAt: now,
    };
    await db.groupWagePayments.add(created);
    return created;
  },

  /** حذف یک پرداخت جمعی — تراکنش دفتر حساب مرتبط (در صورت وجود) هم حذف می‌شود. */
  async remove(id: string): Promise<void> {
    const existing = await db.groupWagePayments.get(id);
    if (!existing) throw new NotFoundError(`پرداختی با شناسه ${id} یافت نشد.`);

    if (existing.cashbookEntryId) {
      await cashbookService.remove(existing.cashbookEntryId).catch(() => {
        // اگر تراکنش مرتبط قبلاً از دفتر حساب حذف شده بود، مشکلی نیست —
        // خود پرداخت جمعی هنوز باید حذف شود.
      });
    }
    await db.groupWagePayments.delete(id);
  },
};
