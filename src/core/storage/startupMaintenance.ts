import { db } from "../db";
import { cleanOrphanBlobs } from "./orphanBlobCleanup";

/**
 * کارهای نگه‌داری سبک که نباید ورود به برنامه را کند کنند:
 * بعد از چند ثانیه (وقتی UI بالا آمده و CPU آزاد است) و فقط یک‌بار در هر اجرا.
 * هیچ عکسی در این مرحله باز/decode نمی‌شود (فقط فهرست فایل‌ها و رکوردهای JSON).
 */
const STARTUP_DELAY_MS = 8000;
let scheduled = false;

export function scheduleStartupMaintenance(): void {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    void cleanOrphanBlobs(db).catch(() => {
      // نگه‌داری شکست بخورد، برنامه نباید متأثر شود.
    });
  }, STARTUP_DELAY_MS);
}
