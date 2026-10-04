import type { NativeDatabase } from "./nativeStore";

/**
 * پاک‌سازی فایل‌های یتیم در blobs/ (فایلی که هیچ رکوردی به آن اشاره نمی‌کند).
 * منشأ یتیم‌ها: کرش/کشته‌شدن برنامه بین «نوشتن فایل» و «ثبت رکورد».
 *
 * اولویت اول «هرگز دادهٔ واقعی کاربر پاک نشود» است، پس محافظ‌های سخت‌گیرانه دارد:
 *  - فایلی که زمان تغییرش نامعلوم (0) است هرگز پاک نمی‌شود.
 *  - فایل «تازه» (کمتر از minAgeMs) پاک نمی‌شود (ممکن است نوشتنش در جریان باشد).
 *  - اگر هیچ رکوردی به هیچ فایلی اشاره نمی‌کند ولی فایل هست، یعنی احتمالاً خواندن دیتابیس
 *    ناموفق بوده؛ هیچ‌چیز پاک نمی‌شود.
 *  - اگر بیش از نصف فایل‌ها (و بیش از ۲۰ فایل) یتیم تشخیص داده شود، مشکوک است و پاک‌سازی لغو می‌شود.
 */

export interface OrphanCleanupResult {
  scanned: number;
  orphans: string[];
  removed: number;
  skippedReason?: "no-files" | "no-references" | "too-many-orphans";
}

export const ORPHAN_MIN_AGE_MS = 10 * 60 * 1000;
const SUSPICIOUS_MIN_COUNT = 20;

export async function cleanOrphanBlobs(
  db: NativeDatabase,
  opts: { minAgeMs?: number; now?: number; dryRun?: boolean } = {}
): Promise<OrphanCleanupResult> {
  const minAge = opts.minAgeMs ?? ORPHAN_MIN_AGE_MS;
  const now = opts.now ?? Date.now();

  await db.open();
  const files = await db.blobs.list();
  if (files.length === 0) return { scanned: 0, orphans: [], removed: 0, skippedReason: "no-files" };

  const referenced = db.referencedBlobPaths();
  if (referenced.size === 0) return { scanned: files.length, orphans: [], removed: 0, skippedReason: "no-references" };

  const orphans = files
    .filter((f) => !referenced.has(f.path) && f.mtime > 0 && now - f.mtime >= minAge)
    .map((f) => f.path);

  if (orphans.length > SUSPICIOUS_MIN_COUNT && orphans.length > files.length / 2) {
    return { scanned: files.length, orphans, removed: 0, skippedReason: "too-many-orphans" };
  }
  if (opts.dryRun) return { scanned: files.length, orphans, removed: 0 };

  let removed = 0;
  for (const path of orphans) {
    // بین فهرست‌گرفتن و حذف ممکن است رکوردی به این فایل اشاره کرده باشد؛ دوباره بررسی می‌کنیم.
    if (db.referencedBlobPaths().has(path)) continue;
    try {
      await db.blobs.remove(path);
      removed++;
    } catch {
      // فایل همین حالا حذف شده یا قابل‌حذف نیست؛ مهم نیست.
    }
  }
  return { scanned: files.length, orphans, removed };
}
