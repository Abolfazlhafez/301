import { randomUUID } from "../utils/uuid";
import { db, type PhotoRow, type PhotoWithBlob } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type { Photo, PhotoRelatedType } from "../../entities/Photo";
import { detectImageKind, convertHeicToJpeg, mimeTypeForKind } from "../../shared/utils/imageFormat";
import { encodeThumbnail } from "../../shared/utils/imageThumbnail";
import { projectService } from "./projectService";
import { floorActivityService } from "./floorActivityService";

const VALID_RELATED_TYPES: PhotoRelatedType[] = [
  "worker",
  "worker-avatar",
  "equipment",
  "attendance",
  "site",
  "receipt",
  "floor",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // ۲۰ مگابایت (سقف کمی افزایش یافت تا فایل‌های HEIC با کیفیت بالا هم جا شوند)

// کش آدرس فایل (بر اساس filename) برای نمایش هم‌زمان و سریع عکس‌ها در <img>.
// عکس‌ها دیگر داخل پایگاه‌داده نیستند؛ فایل واقعی روی دیسک است و آدرس آن
// (blobUrl) مستقیماً در <img src> استفاده می‌شود — بدون ورود بایت‌ها به حافظهٔ JS.
// همیشه از نسخهٔ «قابل‌نمایش» (displayBlobUrl در صورت وجود، وگرنه blobUrl اصلی).
const photoUrlCache = new Map<string, string>();
// کش آدرس «پیش‌نمایش کم‌حجم» (thumbBlobUrl). فقط آدرس نگه می‌داریم؛ هیچ بایتی در حافظهٔ JS نیست.
const photoThumbUrlCache = new Map<string, string>();

function cacheObjectUrl(row: PhotoRow): string {
  const url = row.displayBlobUrl ?? row.blobUrl;
  photoUrlCache.set(row.filename, url);
  if (row.thumbBlobUrl) photoThumbUrlCache.set(row.filename, row.thumbBlobUrl);
  return url;
}

/** @internal ثبت آدرس پیش‌نمایشی که تازه ساخته شده (photoThumbnailService). */
export function registerPhotoThumbUrl(filename: string, url: string): void {
  photoThumbUrlCache.set(filename, url);
}

/** @internal فقط برای تست. */
export function clearPhotoUrlCachesForTests(): void {
  photoUrlCache.clear();
  photoThumbUrlCache.clear();
}

/**
 * آدرس قابل نمایش یک عکس بر اساس نام فایل آن (از کش object URL).
 * اگر هنوز در کش نباشد (بارگذاری نشده)، رشته خالی برمی‌گرداند.
 */
export function resolvePhotoUrl(filename: string): string {
  return photoUrlCache.get(filename) ?? "";
}

/**
 * آدرس پیش‌نمایش کم‌حجم یک عکس؛ رشتهٔ خالی یعنی هنوز ساخته نشده
 * (در این حالت UI باید ensurePhotoThumbnail را صدا بزند و تا آن موقع جایگزین نشان دهد،
 * نه عکس اصلی).
 */
export function resolvePhotoThumbUrl(filename: string): string {
  return photoThumbUrlCache.get(filename) ?? "";
}

function toPublicPhoto(row: PhotoRow): Photo {
  cacheObjectUrl(row);
  const { blobUrl: _blobUrl, displayBlobUrl: _displayBlobUrl, thumbBlobUrl: _thumbBlobUrl, ...rest } = row;
  return rest;
}

export const photoService = {
  async list(filter?: {
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
    let items = await db.photos.where({ projectId: await projectService.getOrCreateActiveProjectId() }).toArray();
    if (filter?.relatedType) items = items.filter((p) => p.relatedType === filter.relatedType);
    if (filter?.relatedId) items = items.filter((p) => p.relatedId === filter.relatedId);
    if (filter?.floorId) items = items.filter((p) => p.floorId === filter.floorId);
    if (filter?.stageId) items = items.filter((p) => p.stageId === filter.stageId);
    if (filter?.taskId) items = items.filter((p) => p.taskId === filter.taskId);
    if (filter?.issueId) items = items.filter((p) => p.issueId === filter.issueId);
    if (filter?.checklistItemId) items = items.filter((p) => p.checklistItemId === filter.checklistItemId);
    if (filter?.phase) items = items.filter((p) => p.phase === filter.phase);
    if (filter?.date) items = items.filter((p) => p.date === filter.date);
    if (filter?.from) items = items.filter((p) => p.date >= filter.from!);
    if (filter?.to) items = items.filter((p) => p.date <= filter.to!);
    return items.sort((a, b) => (a.date < b.date ? 1 : -1)).map(toPublicPhoto);
  },

  async getById(id: string): Promise<Photo | null> {
    const row = await db.photos.get(id);
    if (!row) return null;
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    return row.projectId === activeProjectId ? toPublicPhoto(row) : null;
  },

  async getBlobRow(id: string): Promise<PhotoRow | null> {
    const row = await db.photos.get(id);
    if (!row) return null;
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    return row.projectId === activeProjectId ? row : null;
  },

  /**
   * آپلود یک عکس جدید. فرمت واقعی فایل با بررسی محتوای آن تشخیص داده می‌شود
   * (نه صرفاً mimeType مرورگر که برای HEIC/HEIF اغلب نادرست یا خالی است).
   *
   * اگر فایل HEIC/HEIF باشد:
   * - فایل اصلی دقیقاً همان‌طور که کاربر انتخاب کرده، ذخیره می‌شود (بدون تغییر).
   * - علاوه بر آن، تلاش می‌شود یک نسخهٔ JPEG با کیفیت بالا برای نمایش داخلی
   *   ساخته و ذخیره شود.
   * - اگر این تبدیل به هر دلیلی (فایل خراب، عدم پشتیبانی و ...) شکست بخورد،
   *   آپلود همچنان با موفقیت انجام می‌شود؛ فقط پیش‌نمایش در دسترس نخواهد بود
   *   و این وضعیت روی رکورد عکس علامت‌گذاری می‌شود. برنامه هرگز کرش نمی‌کند.
   */
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
    if (!VALID_RELATED_TYPES.includes(input.relatedType)) {
      throw new ValidationError("نوع ارتباط عکس نامعتبر است.");
    }
    if (input.relatedType !== "site" && !input.relatedId) {
      throw new ValidationError("برای این نوع عکس، شناسه مرتبط الزامی است.");
    }
    if (!input.date) throw new ValidationError("تاریخ عکس الزامی است.");
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const effectiveFloorId = input.floorId ?? (input.relatedType === "floor" ? input.relatedId ?? null : null);
    if (input.relatedType === "floor" && !effectiveFloorId) {
      throw new ValidationError("برای عکس طبقه، شناسه طبقه الزامی است.");
    }
    if (input.relatedType === "floor" && input.floorId && input.relatedId && input.floorId !== input.relatedId) {
      throw new ValidationError("شناسه طبقه و ارتباط اصلی عکس باید یکسان باشند.");
    }
    if (effectiveFloorId) {
      const floor = await db.floors.get(effectiveFloorId);
      if (!floor) throw new NotFoundError("طبقه انتخاب‌شده پیدا نشد.");
      if (floor.projectId !== activeProjectId) throw new ValidationError("طبقه انتخاب‌شده متعلق به پروژه فعال نیست.");
      if (input.stageId) { const stage = await db.floorStages.get(input.stageId); if (!stage || stage.floorId !== effectiveFloorId) throw new ValidationError("مرحله انتخاب‌شده متعلق به این طبقه نیست."); }
      if (input.taskId) { const task = await db.floorTasks.get(input.taskId); if (!task || task.floorId !== effectiveFloorId) throw new ValidationError("کار انتخاب‌شده متعلق به این طبقه نیست."); }
      if (input.issueId) { const issue = await db.floorIssues.get(input.issueId); if (!issue || issue.floorId !== effectiveFloorId) throw new ValidationError("مشکل انتخاب‌شده متعلق به این طبقه نیست."); }
      if (input.checklistItemId) { const item = await db.floorChecklistItems.get(input.checklistItemId); if (!item || item.floorId !== effectiveFloorId) throw new ValidationError("مورد چک‌لیست انتخاب‌شده متعلق به این طبقه نیست."); }
      if (input.stageId && input.taskId) { const task = await db.floorTasks.get(input.taskId); if (task?.stageId && task.stageId !== input.stageId) throw new ValidationError("کار انتخاب‌شده به این مرحله تعلق ندارد."); }
      if (input.issueId && input.taskId) { const issue = await db.floorIssues.get(input.issueId); if (issue?.taskId && issue.taskId !== input.taskId) throw new ValidationError("مشکل انتخاب‌شده به این کار تعلق ندارد."); }
    }
    if (input.file.size > MAX_FILE_SIZE) {
      throw new ValidationError("حجم فایل نباید بیشتر از ۲۰ مگابایت باشد.");
    }

    const kind = await detectImageKind(input.file);
    if (kind === "unknown") {
      throw new ValidationError(
        "فرمت فایل قابل‌شناسایی نیست. فقط تصاویر JPG، PNG، WEBP، GIF، HEIC و HEIF پذیرفته می‌شوند."
      );
    }

    const id = randomUUID();
    const ext = input.file.name.split(".").pop() || (kind === "heic" ? "heic" : kind);
    const effectiveMimeType = input.file.type || mimeTypeForKind(kind);

    const created: PhotoWithBlob = {
      id,
      projectId: activeProjectId,
      relatedType: input.relatedType,
      relatedId: input.relatedType === "site" ? null : input.relatedId ?? null,
      floorId: effectiveFloorId,
      stageId: input.stageId ?? null,
      taskId: input.taskId ?? null,
      issueId: input.issueId ?? null,
      checklistItemId: input.checklistItemId ?? null,
      phase: input.phase ?? null,
      date: input.date,
      caption: input.caption?.trim() || null,
      filename: `${id}.${ext}`,
      originalName: input.file.name,
      mimeType: effectiveMimeType,
      fileSize: input.file.size,
      createdAt: new Date().toISOString(),
      blob: input.file,
      detectedKind: kind,
    };

    if (kind === "heic") {
      // تبدیل هرگز نباید مسیر آپلود را متوقف کند؛ در بدترین حالت فقط پیش‌نمایش نداریم.
      const conversion = await convertHeicToJpeg(input.file);
      if (conversion.ok) {
        created.displayBlob = conversion.blob;
        created.displayConversionFailed = false;
      } else {
        created.displayConversionFailed = true;
      }
    }

    // پیش‌نمایش همان لحظه ساخته می‌شود (فایل هنوز در دسترس است). شکستش بی‌خطر است:
    // اگر null شد، هنگام اولین نمایش در پس‌زمینه ساخته می‌شود (photoThumbnailService).
    const thumbSource = created.displayBlob ?? (kind === "heic" ? null : input.file);
    if (thumbSource) {
      const thumb = await encodeThumbnail(thumbSource).catch(() => null);
      if (thumb) created.thumbBlob = thumb;
    }

    await db.photos.add(created);
    const stored = (await db.photos.get(id))!;
    if (created.floorId) {
      await floorActivityService.log({
        floorId: created.floorId,
        stageId: created.stageId,
        type: "photo_added",
        messageKey: "floor.activity.photoAdded",
        params: { caption: created.caption || created.originalName },
      });
    }
    return toPublicPhoto(stored);
  },

  /**
   * تلاش مجدد برای ساخت پیش‌نمایش یک عکس HEIC که تبدیل آن قبلاً ناموفق بوده است.
   * فایل اصلی دست‌نخورده در پایگاه‌داده موجود است؛ فقط دوباره تلاش تبدیل انجام می‌شود.
   */
  async retryDisplayConversion(id: string): Promise<Photo> {
    const row = await db.photos.get(id);
    if (!row) throw new NotFoundError(`عکسی با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (row.projectId !== activeProjectId) throw new NotFoundError("این عکس متعلق به پروژه فعال نیست.");

    const original = await db.readBlob("photos", id, "blob");
    if (!original) throw new NotFoundError("فایل اصلی این عکس روی دستگاه پیدا نشد.");
    const conversion = await convertHeicToJpeg(original);
    if (conversion.ok) {
      photoUrlCache.delete(row.filename); // کش قدیمی (در صورت وجود) نامعتبر می‌شود
      await db.photos.put({ ...row, displayBlob: conversion.blob, displayConversionFailed: false });
      return toPublicPhoto((await db.photos.get(id))!);
    }
    return toPublicPhoto(row);
  },

  /** ویرایش متن توضیح (caption) یک عکس موجود، بدون تغییر خود فایل. */
  async updateCaption(id: string, caption: string | null): Promise<Photo> {
    const row = await db.photos.get(id);
    if (!row) throw new NotFoundError(`عکسی با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (row.projectId !== activeProjectId) throw new NotFoundError("این عکس متعلق به پروژه فعال نیست.");
    row.caption = caption?.trim() || null;
    await db.photos.put(row);
    return toPublicPhoto(row);
  },

  async remove(id: string): Promise<void> {
    const existing = await db.photos.get(id);
    if (!existing) throw new NotFoundError(`عکسی با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (existing.projectId !== activeProjectId) throw new NotFoundError("این عکس متعلق به پروژه فعال نیست.");
    photoUrlCache.delete(existing.filename);
    await db.photos.delete(id);
  },
};
