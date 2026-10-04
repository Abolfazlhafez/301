import type { Photo } from "../entities/Photo";
import type { VoiceNote } from "../entities/VoiceNote";
import type { AppSettings } from "../entities/AppSettings";

/**
 * نوع‌های ذخیره‌سازی. عکس و صوت دیگر داخل پایگاه‌داده نگه‌داری نمی‌شوند:
 *  - «نوشتن» (add/put) همچنان یک Blob می‌گیرد (PhotoWithBlob / VoiceNoteWithBlob)
 *  - لایهٔ ذخیره‌سازی آن را در یک فایل روی دیسک می‌نویسد و فقط مسیرش را نگه می‌دارد
 *  - «خواندن» (get/toArray/...) دیگر Blob برنمی‌گرداند؛ به‌جایش آدرس فایل
 *    (blobUrl / displayBlobUrl) را می‌دهد که مستقیماً در <img>/<audio> قابل‌استفاده است
 *    و هیچ داده‌ای را وارد حافظهٔ JS نمی‌کند. برای Blob واقعی از
 *    db.readBlob(table, id, field) استفاده شود (اشتراک‌گذاری، بکاپ، تبدیل HEIC).
 */
export interface VoiceNoteWithBlob extends VoiceNote {
  blob: Blob;
}
export type VoiceNoteRow = VoiceNote & { blobUrl: string };

export interface PhotoWithBlob extends Photo {
  // فایل اصلی دست‌نخورده کاربر (هرگز تغییر داده نمی‌شود).
  blob: Blob;
  // نسخه قابل نمایش (فقط وقتی فرمت اصلی مثل HEIC مستقیم قابل نمایش نیست).
  displayBlob?: Blob;
  // نوع فایل واقعی که با بررسی بایت‌های فایل تشخیص داده شده.
  detectedKind?: "jpeg" | "png" | "webp" | "gif" | "heic" | "unknown";
  // اگر true باشد یعنی تبدیل HEIC ناموفق بوده (فایل اصلی همچنان سالم است).
  displayConversionFailed?: boolean;
  // پیش‌نمایش کم‌حجم (مشتق از نسخهٔ قابل‌نمایش). در لیست‌ها فقط همین نمایش داده می‌شود
  // تا عکس اصلی (که decode آن ده‌ها مگابایت RAM می‌خواهد) فقط با کلیک باز شود.
  thumbBlob?: Blob;
}
export type PhotoRow = Omit<PhotoWithBlob, "blob" | "displayBlob" | "thumbBlob"> & {
  blobUrl: string;
  displayBlobUrl?: string;
  thumbBlobUrl?: string;
};

// رکورد تکی تنظیمات؛ چون AppSettings کلید طبیعی ندارد، یک id ثابت به آن اضافه می‌کنیم.
export interface SettingsRow extends AppSettings {
  id: string;
}

/**
 * راز دستگاهی — کلید رمزنگاری AES تصادفی که یک‌بار (در اولین اجرای برنامه)
 * تولید می‌شود و برای رمزنگاری بکاپ‌های خودکار استفاده می‌شود.
 * این جدول عمداً از Backup/Restore مستثناست (دلیل امنیتی در backupService.ts).
 */
export interface DeviceSecretRow {
  id: string;
  /** کلید AES-256 خام، به‌صورت Base64. */
  deviceKeyBase64: string;
  createdAt: string;
}

export const DEVICE_SECRET_ROW_ID = "device-encryption-key";
