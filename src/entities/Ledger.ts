export type LedgerEntryType = "advance" | "deduction" | "credit" | "settlement";

export interface WorkerLedgerEntry {
  id: string;
  /** پروژه‌ای که این تراکنش دفتر کارگر برای آن ثبت شده. */
  projectId: string;
  workerId: string;
  type: LedgerEntryType;
  amount: number;
  date: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLedgerEntryInput {
  workerId: string;
  type: Exclude<LedgerEntryType, "settlement">;
  amount: number;
  date: string;
  description?: string | null;
}

export const LEDGER_ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  advance: "مساعده / پیش‌پرداخت",
  deduction: "کسر دستی",
  credit: "طلب اضافه",
  settlement: "تسویه حساب",
};

export interface WorkerBalanceSummary {
  workerId: string;
  workerFullName: string;
  sinceDate: string;
  lastSettlementDate: string | null;
  totalEarned: number;
  /**
   * جمع دستمزد نگهبانی در همین بازه. اگر تنظیم «ادغام با حقوق عادی» برای این
   * نیرو فعال باشد، این مبلغ در totalEarned/balance هم لحاظ شده است؛
   * در غیر این صورت صرفاً برای نمایش اطلاعاتی است و در balance محاسبه نمی‌شود.
   */
  totalGuardDutyEarned: number;
  guardDutyMerged: boolean;
  totalAdvances: number;
  totalDeductions: number;
  totalCredits: number;
  balance: number;
  entries: WorkerLedgerEntry[];
}
