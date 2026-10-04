/**
 * رابط‌های لایهٔ ذخیره‌سازی.
 *
 * معماری:
 *   سرویس‌ها → NativeDatabase (کش در حافظه + API شبیه Dexie)
 *                 ├─ RowBackend  : SQLite نیتیو (اندروید) — فقط رکوردهای JSON
 *                 └─ BlobBackend : فایل روی دیسک (Capacitor Filesystem) — عکس/صوت
 *
 * هیچ‌چیز در IndexedDB/WebView ذخیره نمی‌شود (به‌جز مسیر مهاجرت از نسخهٔ قدیمی).
 */

export type StorageOp =
  | { t: "put"; table: string; key: string; json: string }
  | { t: "del"; table: string; key: string }
  | { t: "clear"; table: string };

export interface StoredRowJson {
  key: string;
  json: string;
}

export interface RowBackend {
  /** اتصال/ساخت جدول‌ها. چندبار صدا زدن بی‌خطر است. */
  open(tables: string[]): Promise<void>;
  loadAll(table: string): Promise<StoredRowJson[]>;
  /** همهٔ عملیات یک batch باید اتمیک اعمال شوند (همه یا هیچ). */
  apply(ops: StorageOp[]): Promise<void>;
  /** حذف کامل همهٔ داده‌ها (برای تست‌ها / ریست). */
  destroy(tables: string[]): Promise<void>;
  close(): Promise<void>;
}

export interface BlobBackend {
  open(): Promise<void>;
  write(path: string, blob: Blob): Promise<void>;
  /** آدرسی که مستقیماً در <img src> / <audio src> قابل‌استفاده است. همگام (sync). */
  url(path: string): string;
  read(path: string): Promise<Blob>;
  remove(path: string): Promise<void>;
  /** وجود فایل و اندازهٔ آن؛ null اگر نباشد. */
  stat(path: string): Promise<{ size: number } | null>;
  removeAll(): Promise<void>;
  /** فهرست همهٔ فایل‌های ذخیره‌شده (مسیر نسبی نسبت به ریشهٔ blobs) — برای پاک‌سازی فایل‌های یتیم. */
  list(): Promise<BlobListEntry[]>;
}

export interface BlobListEntry {
  /** مسیر نسبی، دقیقاً مثل مقداری که در write()/رکورد استفاده شده (مثلاً photos/abc__blob__x.jpg). */
  path: string;
  size: number;
  /** زمان آخرین تغییر (میلی‌ثانیه از epoch)؛ اگر در دسترس نباشد 0. */
  mtime: number;
}

/** مرجع یک فایل Blob که بیرون از رکورد ذخیره شده است. */
export interface BlobFileRef {
  path: string;
  size: number;
  type: string;
}

export interface BlobFieldDef {
  /** نام فیلد Blob در نوشتن (مثلاً "blob" یا "displayBlob"). */
  field: string;
  /** نام فیلد آدرس در خواندن (مثلاً "blobUrl"). */
  urlField: string;
}

export interface TableDef {
  name: string;
  blobFields?: BlobFieldDef[];
  /**
   * بارگذاری تنبل: ردیف‌های این جدول هنگام شروع اپ در RAM نمی‌آیند؛ اولین دسترسی (هر متد NativeTable)
   * آن را یک‌بار از backend می‌خواند. فقط برای جدول‌های بدون فیلد Blob مجاز است
   * (referencedBlobPaths/readBlob مستقیم روی حافظه کار می‌کنند).
   */
  lazy?: boolean;
}
