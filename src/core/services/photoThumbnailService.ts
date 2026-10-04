import { db } from "../db";
import { registerPhotoThumbUrl, resolvePhotoThumbUrl } from "./photoService";
import { encodeThumbnail } from "../../shared/utils/imageThumbnail";

/**
 * ساخت تنبل (on-demand) پیش‌نمایش برای عکس‌هایی که هنوز پیش‌نمایش ندارند
 * (عکس‌های قدیمی، یا بعد از بازیابی بکاپ).
 *
 * قواعد حفظ حافظه:
 *  - هیچ‌چیز هنگام ورود به برنامه ساخته نمی‌شود؛ فقط وقتی یک عکس واقعاً روی صفحه آمد.
 *  - هر لحظه فقط «یک» عکس decode می‌شود (صف سریالی) و بین دو کار نفس‌گیری کوتاه هست.
 *  - اگر کاربر قبل از رسیدن نوبت از صفحه رد شد (isStillNeeded=false)، آن عکس اصلاً باز نمی‌شود.
 */

type Needed = () => boolean;

interface Job {
  id: string;
  filename: string;
  needed: Needed[];
  waiters: Array<(url: string | null) => void>;
}

const queue: Job[] = [];
const jobsById = new Map<string, Job>();
const failedIds = new Set<string>();
let running = false;

const IDLE_GAP_MS = 25;

/** فقط برای تست: پاک‌کردن وضعیت صف و شکست‌ها. */
export function resetThumbnailQueueForTests(): void {
  queue.length = 0;
  jobsById.clear();
  failedIds.clear();
  running = false;
}

/** بعد از اینکه منبع عکس عوض شد (مثلاً تبدیل HEIC موفق شد)، شکست قبلی فراموش می‌شود. */
export function forgetThumbnailFailure(id: string): void {
  failedIds.delete(id);
}

export function pendingThumbnailJobs(): number {
  return queue.length + (running ? 1 : 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runJob(job: Job): Promise<string | null> {
  const row = await db.photos.get(job.id);
  if (!row) return null;
  if (row.thumbBlobUrl) {
    registerPhotoThumbUrl(row.filename, row.thumbBlobUrl);
    return row.thumbBlobUrl;
  }
  // HEIC بدون نسخهٔ قابل‌نمایش را مرورگر نمی‌تواند decode کند.
  const field = row.displayBlobUrl ? "displayBlob" : row.detectedKind === "heic" ? null : "blob";
  if (!field) return null;
  const source = await db.readBlob("photos", job.id, field);
  if (!source) return null;
  const thumb = await encodeThumbnail(source);
  if (!thumb) return null;
  const attached = await db.photos.attachBlob(job.id, "thumbBlob", thumb);
  if (!attached) return null;
  const updated = await db.photos.get(job.id);
  const url = updated?.thumbBlobUrl ?? null;
  if (url) registerPhotoThumbUrl(job.filename, url);
  return url;
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      // آخرین درخواست‌شده اول (عکس‌هایی که الان روی صفحه‌اند مهم‌تر از آن‌هایی‌اند که اسکرول شده‌اند).
      const job = queue.pop()!;
      jobsById.delete(job.id);
      let url: string | null = null;
      if (job.needed.some((fn) => fn())) {
        try {
          url = await runJob(job);
        } catch {
          url = null;
        }
        if (!url) failedIds.add(job.id);
        await sleep(IDLE_GAP_MS);
      }
      for (const w of job.waiters) w(url);
    }
  } finally {
    running = false;
  }
}

/**
 * پیش‌نمایش یک عکس را تضمین می‌کند و آدرسش را می‌دهد (null اگر ساخته نشد).
 * @param isStillNeeded قبل از شروع کار صدا زده می‌شود؛ اگر false باشد کار انجام نمی‌شود.
 */
export function ensurePhotoThumbnail(
  photo: { id?: string; filename: string },
  isStillNeeded: Needed = () => true
): Promise<string | null> {
  const cached = resolvePhotoThumbUrl(photo.filename);
  if (cached) return Promise.resolve(cached);
  const photoId = photo.id;
  if (!photoId) {
    // بعضی صفحه‌ها فقط نام فایل را دارند (مثلاً رسید صندوق)؛ شناسه از روی نام فایل پیدا می‌شود.
    return db.photos
      .where({ filename: photo.filename })
      .first()
      .then((row) => (row ? ensurePhotoThumbnail({ id: row.id, filename: row.filename }, isStillNeeded) : null))
      .catch(() => null);
  }
  if (failedIds.has(photoId)) return Promise.resolve(null);

  return new Promise<string | null>((resolve) => {
    let job = jobsById.get(photoId);
    if (job) {
      job.needed.push(isStillNeeded);
      job.waiters.push(resolve);
      // دوباره درخواست شده → دوباره «تازه‌ترین» می‌شود
      const i = queue.indexOf(job);
      if (i >= 0) {
        queue.splice(i, 1);
        queue.push(job);
      }
    } else {
      job = { id: photoId, filename: photo.filename, needed: [isStillNeeded], waiters: [resolve] };
      jobsById.set(photoId, job);
      queue.push(job);
    }
    void pump();
  });
}
