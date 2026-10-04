/**
 * صندوق (Fund) — یک حساب/محل نگهداری پول مستقل، مثلاً «صندوق نقدی کارگاه»،
 * «حساب بانکی شرکت»، یا «صندوق پیمانکار فرعی». هر تراکنش دفتر حساب دقیقاً
 * به یک صندوق تعلق دارد، تا مانده و گزارش هر صندوق جدا از بقیه محاسبه شود.
 */
export interface CashboxFund {
  id: string;
  /** پروژه‌ای که این صندوق به آن تعلق دارد. */
  projectId: string;
  name: string;
  description: string | null;
  /** صندوق پیش‌فرض — همیشه دقیقاً یکی از صندوق‌ها این مقدار را true دارد و قابل حذف نیست. */
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCashboxFundInput {
  name: string;
  description?: string | null;
}

export interface UpdateCashboxFundInput {
  name?: string;
  description?: string | null;
}
