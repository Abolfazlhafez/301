export type FloorPlanCategory =
  | "architecture"
  | "structure"
  | "electrical"
  | "mechanical"
  | "utilities"
  | "as_built"
  | "detail"
  | "other";

export const FLOOR_PLAN_CATEGORIES: FloorPlanCategory[] = [
  "architecture",
  "structure",
  "electrical",
  "mechanical",
  "utilities",
  "as_built",
  "detail",
  "other",
];

export type FloorPlanStatus = "draft" | "review" | "approved" | "obsolete";

export const FLOOR_PLAN_STATUSES: FloorPlanStatus[] = ["draft", "review", "approved", "obsolete"];

/**
 * نسخهٔ اول: فقط تصویر (نه PDF خام) پشتیبانی می‌شود — چون سیستم عکس موجود
 * پروژه (photoService) فقط فرمت‌های تصویری را می‌پذیرد. filePhotoId به یک
 * رکورد جدول photos (با relatedType='floor') اشاره می‌کند. ساختار عمداً طوری
 * است که در آینده افزودن Document Attachment مستقل (برای PDF) بدون تغییر
 * در FloorPlan خودش ممکن باشد — فقط کافی است filePhotoId به filePhotoId |
 * fileAttachmentId گسترش یابد.
 */
export interface FloorPlan {
  id: string;
  floorId: string;
  stageId: string | null;
  title: string;
  category: FloorPlanCategory;
  code: string | null;
  revision: string | null;
  status: FloorPlanStatus;
  filePhotoId: string | null;
  designer: string | null;
  date: string | null;
  description: string | null;
  /** برای زنجیرهٔ نسخه‌ها — نسخهٔ جدید به نسخهٔ قبلی اشاره می‌کند؛ نسخهٔ قبلی هرگز حذف نمی‌شود. */
  parentPlanId: string | null;
  /** آیا این آخرین/فعال‌ترین نسخه در زنجیرهٔ خودش است. */
  isActiveRevision: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFloorPlanInput {
  floorId: string;
  stageId?: string | null;
  title: string;
  category: FloorPlanCategory;
  code?: string | null;
  revision?: string | null;
  status?: FloorPlanStatus;
  file?: File | null;
  designer?: string | null;
  date?: string | null;
  description?: string | null;
  /** اگر داده شود، یعنی این نسخهٔ جدیدی از یک نقشهٔ موجود است. */
  parentPlanId?: string | null;
}

export interface UpdateFloorPlanInput {
  stageId?: string | null;
  title?: string;
  category?: FloorPlanCategory;
  code?: string | null;
  revision?: string | null;
  status?: FloorPlanStatus;
  designer?: string | null;
  date?: string | null;
  description?: string | null;
}
