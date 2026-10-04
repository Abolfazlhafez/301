export interface Equipment {
  id: string;
  /** پروژه‌ای که این قلم لوازم به آن تعلق دارد. */
  projectId: string;
  /** کد شناسایی کوتاه و قابل‌خواندن (مثلاً «M-0001»)؛ برخلاف id (که یک UUID داخلی است)،
   * این کد برای نمایش روی کارت، چسباندن برچسب فیزیکی روی خودِ قلم، یا جستجوی سریع
   * توسط کاربر ساخته شده. هر قلم همیشه یک کد دارد؛ اگر کاربر موقع ساخت وارد نکند،
   * به‌صورت خودکار تولید می‌شود. */
  code: string;
  name: string;
  unit: string;
  totalQuantity: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentWithAvailability extends Equipment {
  assignedQuantity: number;
  availableQuantity: number;
}

export interface CreateEquipmentInput {
  /** اختیاری — اگر خالی باشد، سرویس یک کد خودکار (مثلاً M-0001) تولید می‌کند. */
  code?: string | null;
  name: string;
  unit: string;
  totalQuantity: number;
  description?: string | null;
}

export interface UpdateEquipmentInput {
  code?: string | null;
  name?: string;
  unit?: string;
  totalQuantity?: number;
  description?: string | null;
}

export interface EquipmentAssignment {
  id: string;
  equipmentId: string;
  workerId: string;
  quantity: number;
  assignedDate: string;
  returnedDate: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEquipmentAssignmentInput {
  equipmentId: string;
  workerId: string;
  quantity: number;
  assignedDate: string;
  note?: string | null;
}
