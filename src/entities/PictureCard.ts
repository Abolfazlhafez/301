export type PictureCardTemplateId = "work-report";

export type PictureCardLayoutId = "grid" | "feature" | "stack";

export const MAX_PICTURE_CARD_PHOTOS = 4;

export interface PictureCardPhotoRef {
  photoId: string;
  /** برچسب کوتاه اختصاصی این عکس در کارت (اختیاری، جدا از عنوان کلی کارت). */
  caption?: string | null;
  /** درصد افقی کانون کادر عکس (۰ تا ۱۰۰)؛ پیش‌فرض ۵۰ یعنی وسط. */
  focalX?: number | null;
  /** درصد عمودی کانون کادر عکس (۰ تا ۱۰۰)؛ پیش‌فرض ۵۰ یعنی وسط. */
  focalY?: number | null;
  /** ضریب بزرگ‌نمایی عکس داخل خانهٔ خودش (۱ یعنی بدون زوم، حداکثر ۲.۵). */
  zoom?: number | null;
}

export interface PictureCard {
  id: string;
  /** تاریخ (ISO میلادی) روزی که این کارت به آن تعلق دارد. */
  date: string;
  templateId: PictureCardTemplateId;
  layoutId: PictureCardLayoutId;
  /** عنوان اصلی کارت؛ فقط یک‌بار در بالای کارت نمایش داده می‌شود. */
  title: string | null;
  /** زیرعنوان اختیاری (مثلاً نام پروژه/کارگاه)؛ فقط یک‌بار نمایش داده می‌شود. */
  subtitle: string | null;
  /** محل پروژه/کارگاه (اختیاری)؛ فقط در قالب‌هایی که فیلد محل دارند (مثل «گزارش کار») نمایش داده می‌شود. */
  location: string | null;
  /** توضیحات متنی کار انجام‌شده (اختیاری، جدا از برچسب هر عکس). */
  description: string | null;
  photos: PictureCardPhotoRef[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPictureCardInput {
  date: string;
  templateId: PictureCardTemplateId;
  layoutId: PictureCardLayoutId;
  title?: string | null;
  subtitle?: string | null;
  location?: string | null;
  description?: string | null;
  photos: PictureCardPhotoRef[];
}
