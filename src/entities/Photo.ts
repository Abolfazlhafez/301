// «floor» برای عکس‌های دفترچهٔ دیجیتال طبقه اضافه شده (relatedId = شناسهٔ Floor).
// چون این‌جا فقط با === مقایسه می‌شود (نه switch جامع)، افزودن این مقدار هیچ
// کد موجودی را نمی‌شکند.
export type PhotoRelatedType = "worker" | "worker-avatar" | "equipment" | "attendance" | "site" | "receipt" | "floor";
export type PhotoProgressPhase = "before" | "during" | "after";

export interface Photo {
  id: string;
  /** پروژه‌ای که این عکس در آن گرفته/بارگذاری شده. */
  projectId: string;
  relatedType: PhotoRelatedType;
  relatedId: string | null;
  floorId?: string | null;
  stageId?: string | null;
  taskId?: string | null;
  /** ارتباط اختیاری عکس با یک مورد مشکل/نقص در دفترچه طبقه. */
  issueId?: string | null;
  /** ارتباط اختیاری عکس با یک آیتم چک‌لیست تحویل. */
  checklistItemId?: string | null;
  phase?: PhotoProgressPhase | null;
  date: string;
  caption: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  // نوع واقعی فایل که از روی محتوای آن تشخیص داده شده (jpeg/png/webp/gif/heic/unknown).
  detectedKind?: "jpeg" | "png" | "webp" | "gif" | "heic" | "unknown";
  // اگر true باشد، فایل HEIC/HEIF بوده ولی تبدیل آن برای پیش‌نمایش ناموفق بوده است
  // (خود فایل اصلی سالم است، فقط پیش‌نمایش داخلی در دسترس نیست).
  displayConversionFailed?: boolean;
}
