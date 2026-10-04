export type CashbookEntryType = "expense" | "salary" | "deposit";

export interface CashbookEntry {
  id: string;
  type: CashbookEntryType;
  title: string;
  amount: number;
  date: string;
  description: string | null;
  /** صندوقی که این تراکنش به آن تعلق دارد. */
  fundId: string;
  /** در صورتی که تراکنش مربوط به یک نیرو باشد (مثلاً پرداخت حقوق) */
  workerId: string | null;
  /** آدرس نمایش عکس رسید (اختیاری) — از طریق نام فایل عکس ذخیره‌شده resolve می‌شود */
  receiptPhotoId: string | null;
  /**
   * ارتباط اختیاری با «دفترچه دیجیتال طبقه» — این فیلد یک تراکنش مالی *جدید*
   * نمی‌سازد؛ فقط یک تراکنش موجود/جدید دفتر حساب عمومی را به یک طبقه مرتبط
   * می‌کند تا در KPI هزینهٔ آن طبقه لحاظ شود، بدون هیچ رکورد مالی موازی.
   */
  floorId?: string | null;
  stageId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCashbookEntryInput {
  type: CashbookEntryType;
  title: string;
  amount: number;
  date: string;
  description?: string | null;
  /** اگر داده نشود، صندوق پیش‌فرض استفاده می‌شود. */
  fundId?: string | null;
  workerId?: string | null;
  receiptFile?: File | null;
  floorId?: string | null;
  stageId?: string | null;
}

export interface UpdateCashbookEntryInput {
  type?: CashbookEntryType;
  title?: string;
  amount?: number;
  date?: string;
  description?: string | null;
  fundId?: string;
  workerId?: string | null;
  /**
   * undefined = بدون تغییر در عکس رسید فعلی
   * File     = این فایل به‌عنوان عکس رسید جدید آپلود و جایگزین عکس قبلی می‌شود
   * null     = عکس رسید فعلی حذف می‌شود (بدون جایگزین)
   */
  receiptFile?: File | null;
  floorId?: string | null;
  stageId?: string | null;
}

export const CASHBOOK_ENTRY_TYPE_LABELS: Record<CashbookEntryType, string> = {
  expense: "خرج / هزینه",
  salary: "پرداخت حقوق",
  deposit: "واریزی / درآمد",
};

export const CASHBOOK_ENTRY_TYPE_COLORS: Record<CashbookEntryType, "error" | "warning" | "success"> = {
  expense: "error",
  salary: "warning",
  deposit: "success",
};

export interface CashbookSummary {
  totalExpense: number;
  totalSalary: number;
  totalDeposit: number;
  /** واریزی منهای (خرج + حقوق) */
  net: number;
}
