import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { workerService, workerHasDependencies } from "./workerService";
import { guardShiftService } from "./guardShiftService";
import { calculateGuardDutyPay } from "../payroll";
import { _getDailyWorkerReport } from "./reportService";
import { projectService } from "./projectService";
import type { CreateLedgerEntryInput, WorkerBalanceSummary, WorkerLedgerEntry } from "../../entities/Ledger";

export interface RemoveLedgerEntryResult {
  /**
   * پس از حذف این تراکنش، آیا نیرو دیگر هیچ سابقه‌ای (حضور، دفتر حساب،
   * تخصیص لوازم یا نگهبانی) ندارد؟ اگر true باشد، رابط کاربری می‌تواند
   * به‌صورت اختیاری از کاربر بپرسد که آیا خودِ نیرو هم حذف شود — این هرگز
   * به‌طور خودکار انجام نمی‌شود، صرفاً یک گزینهٔ اختیاری برای کاربر است.
   */
  workerHasNoRemainingHistory: boolean;
  workerId: string;
}

const VALID_TYPES = ["advance", "deduction", "credit"];
const BEGINNING_OF_TIME = "2000-01-01";

function addOneDayIso(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function findLatestSettlement(workerId: string): Promise<WorkerLedgerEntry | null> {
  const entries = await db.ledgerEntries.where({ workerId }).toArray();
  const settlements = entries
    .filter((e) => e.type === "settlement")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return settlements[0] ?? null;
}

export const ledgerService = {
  // توجه: list/getBalance عمداً بر اساس پروژهٔ فعال فیلتر نمی‌شوند، برخلاف
  // بقیهٔ سرویس‌های این نسخه. رکوردهای ledgerEntries از این نسخه به بعد
  // projectId دارند (برای این‌که معلوم باشد هر مساعده/کسر در کدام پروژه
  // ثبت شده)، ولی مانده حساب یک نیرو یک مفهوم مالی سراسری است — نیرو باید
  // بتواند در گزارش خودش کل بدهی/طلبش را، صرف‌نظر از این‌که کدام پروژه
  // الان فعال است، ببیند. فیلترکردن اینجا ریسک واقعی محاسبهٔ مالی نادرست
  // (نمایش مانده ناقص) داشت، پس عمداً دست‌نخورده مانده.
  async list(filter?: { workerId?: string; from?: string; to?: string; type?: string }): Promise<WorkerLedgerEntry[]> {
    let items = await db.ledgerEntries.toArray();
    if (filter?.workerId) items = items.filter((e) => e.workerId === filter.workerId);
    if (filter?.from) items = items.filter((e) => e.date >= filter.from!);
    if (filter?.to) items = items.filter((e) => e.date <= filter.to!);
    if (filter?.type) items = items.filter((e) => e.type === filter.type);
    return items.sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  async create(input: CreateLedgerEntryInput): Promise<WorkerLedgerEntry> {
    const worker = await workerService.findByIdOrNull(input.workerId);
    if (!worker) throw new NotFoundError(`نیرویی با شناسه ${input.workerId} یافت نشد.`);

    if (!VALID_TYPES.includes(input.type)) throw new ValidationError("نوع تراکنش نامعتبر است.");
    if (!input.amount || input.amount <= 0) throw new ValidationError("مبلغ باید بزرگتر از صفر باشد.");
    if (!input.date) throw new ValidationError("تاریخ الزامی است.");

    const now = new Date().toISOString();
    const created: WorkerLedgerEntry = {
      id: randomUUID(),
      projectId: await projectService.getOrCreateActiveProjectId(),
      workerId: input.workerId,
      type: input.type,
      amount: input.amount,
      date: input.date,
      description: input.description?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    await db.ledgerEntries.add(created);
    return created;
  },

  /**
   * حذف یک تراکنش دفتر حساب نیرو. حذف نیروی مرتبط هرگز خودکار نیست؛
   * فقط پس از حذف بررسی می‌شود که آیا نیرو دیگر سابقه‌ای دارد یا نه، تا
   * لایهٔ بالاتر (UI) بتواند به‌صورت اختیاری از کاربر بپرسد.
   */
  async remove(id: string): Promise<RemoveLedgerEntryResult> {
    const existing = await db.ledgerEntries.get(id);
    if (!existing) throw new NotFoundError(`تراکنش با شناسه ${id} یافت نشد.`);
    await db.ledgerEntries.delete(id);

    const stillHasHistory = await workerHasDependencies(existing.workerId);
    return { workerHasNoRemainingHistory: !stillHasHistory, workerId: existing.workerId };
  },

  /**
   * محاسبه مانده حساب یک نیرو از آخرین تسویه تا تاریخ مشخص.
   * balance مثبت = کارگاه به نیرو بدهکار است (نیرو طلب دارد)
   * balance منفی = نیرو به کارگاه بدهکار است.
   */
  async getBalance(workerId: string, asOfDate: string): Promise<WorkerBalanceSummary> {
    const worker = await workerService.getById(workerId);

    const lastSettlement = await findLatestSettlement(workerId);
    const cutoffCreatedAt = lastSettlement?.createdAt ?? null;
    const sinceDate = lastSettlement ? addOneDayIso(lastSettlement.date) : BEGINNING_OF_TIME;

    const allAttendances = await db.attendances
      .where("workerId")
      .equals(workerId)
      .and((att) => att.date <= asOfDate)
      .toArray();

    const relevantAttendances = allAttendances.filter((att) => {
      if (!cutoffCreatedAt) return true;
      return att.createdAt > cutoffCreatedAt || att.updatedAt > cutoffCreatedAt;
    });

    let totalEarned = 0;
    for (const att of relevantAttendances) {
      if (!att.checkIn) continue;
      const dailyReport = await _getDailyWorkerReport(workerId, att.date);
      totalEarned += dailyReport.payableSalary;
    }

    // دستمزد نگهبانی همیشه جداگانه محاسبه می‌شود؛ فقط در صورت فعال بودن
    // guardDutyMergeWithRegularPay این نیرو، به مانده حساب اضافه می‌شود.
    const allGuardShifts = await guardShiftService.list({ workerId, to: asOfDate });
    const relevantGuardShifts = allGuardShifts.filter((s) => {
      if (!cutoffCreatedAt) return true;
      return s.createdAt > cutoffCreatedAt || s.updatedAt > cutoffCreatedAt;
    });
    const guardCalculation = calculateGuardDutyPay({
      shifts: relevantGuardShifts.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
      rateType: worker.guardDutyRateType,
      rate: worker.guardDutyRate,
    });
    const totalGuardDutyEarned = guardCalculation.payableAmount;

    const allEntries = (await db.ledgerEntries.where({ workerId }).toArray())
      .filter((e) => e.date <= asOfDate && e.type !== "settlement");
    const entries = allEntries.filter((e) => {
      if (!cutoffCreatedAt) return true;
      return e.createdAt > cutoffCreatedAt;
    });

    const totalAdvances = entries.filter((e) => e.type === "advance").reduce((s, e) => s + e.amount, 0);
    const totalDeductions = entries.filter((e) => e.type === "deduction").reduce((s, e) => s + e.amount, 0);
    const totalCredits = entries.filter((e) => e.type === "credit").reduce((s, e) => s + e.amount, 0);

    const earnedForBalance = totalEarned + (worker.guardDutyMergeWithRegularPay ? totalGuardDutyEarned : 0);
    const balance = earnedForBalance + totalCredits - totalAdvances - totalDeductions;

    return {
      workerId: worker.id,
      workerFullName: `${worker.firstName} ${worker.lastName}`,
      sinceDate,
      lastSettlementDate: lastSettlement?.date ?? null,
      totalEarned,
      totalGuardDutyEarned,
      guardDutyMerged: worker.guardDutyMergeWithRegularPay,
      totalAdvances,
      totalDeductions,
      totalCredits,
      balance: Math.round(balance),
      entries,
    };
  },

  async settle(workerId: string, date: string, description?: string | null): Promise<WorkerLedgerEntry> {
    const summary = await this.getBalance(workerId, date);

    const autoDescription =
      summary.balance >= 0
        ? `تسویه حساب — پرداخت ${summary.balance.toLocaleString("fa-IR")} تومان طلب نیرو`
        : `تسویه حساب — کسر ${Math.abs(summary.balance).toLocaleString("fa-IR")} تومان بدهی نیرو`;

    const now = new Date().toISOString();
    const created: WorkerLedgerEntry = {
      id: randomUUID(),
      projectId: await projectService.getOrCreateActiveProjectId(),
      workerId,
      type: "settlement",
      amount: Math.abs(summary.balance),
      date,
      description: description?.trim() || autoDescription,
      createdAt: now,
      updatedAt: now,
    };
    await db.ledgerEntries.add(created);
    return created;
  },
};
