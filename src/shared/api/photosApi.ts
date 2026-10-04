import { db } from "../../core/db";
import { photoService, resolvePhotoUrl, resolvePhotoThumbUrl } from "../../core/services/photoService";
import { ensurePhotoThumbnail, forgetThumbnailFailure } from "../../core/services/photoThumbnailService";
import { Photo, PhotoRelatedType } from "../../entities/Photo";

/**
 * آدرس قابل نمایش یک عکس بر اساس نام فایل آن.
 * برخلاف نسخه قبلی (که به سرور اشاره می‌کرد)، اکنون یک object URL محلی
 * برگردانده می‌شود که از Blob ذخیره‌شده در IndexedDB ساخته شده است
 * (در صورت نیاز، از نسخهٔ تبدیل‌شدهٔ قابل‌نمایش HEIC/HEIF).
 */
export function getPhotoUrl(filename: string): string {
  return resolvePhotoUrl(filename);
}

/**
 * آدرس پیش‌نمایش کم‌حجم (برای لیست/گرید). رشتهٔ خالی یعنی هنوز ساخته نشده؛
 * در این حالت از ensurePhotoThumbnail استفاده شود، نه از عکس اصلی.
 */
export function getPhotoThumbUrl(filename: string): string {
  return resolvePhotoThumbUrl(filename);
}

export { ensurePhotoThumbnail };

export const photosApi = {
  async list(params?: {
    relatedType?: PhotoRelatedType;
    relatedId?: string;
    floorId?: string;
    stageId?: string;
    taskId?: string;
    issueId?: string;
    checklistItemId?: string;
    phase?: "before" | "during" | "after" | null;
    from?: string;
    to?: string;
    date?: string;
  }): Promise<Photo[]> {
    return photoService.list(params);
  },

  async getById(id: string): Promise<Photo | null> {
    return photoService.getById(id);
  },

  /**
   * دادهٔ خام (Blob) یک عکس برای مصارفی مثل اشتراک‌گذاری تکی — برخلاف
   * getPhotoUrl که یک object URL کش‌شده برای نمایش در <img> برمی‌گرداند.
   */
  async getBlob(id: string): Promise<Blob | null> {
    const row = await photoService.getBlobRow(id);
    if (!row) return null;
    return (await db.readBlob("photos", id, row.displayBlobUrl ? "displayBlob" : "blob")) ?? null;
  },

  async upload(input: {
    file: File;
    relatedType: PhotoRelatedType;
    relatedId?: string | null;
    date: string;
    caption?: string | null;
    floorId?: string | null;
    stageId?: string | null;
    taskId?: string | null;
    issueId?: string | null;
    checklistItemId?: string | null;
    phase?: "before" | "during" | "after" | null;
  }): Promise<Photo> {
    return photoService.upload(input);
  },

  async retryDisplayConversion(id: string): Promise<Photo> {
    forgetThumbnailFailure(id); // بعد از تبدیل موفق، پیش‌نمایش هم باید دوباره قابل‌ساخت باشد
    return photoService.retryDisplayConversion(id);
  },

  async updateCaption(id: string, caption: string | null): Promise<Photo> {
    return photoService.updateCaption(id, caption);
  },

  async remove(id: string): Promise<void> {
    return photoService.remove(id);
  },
};
