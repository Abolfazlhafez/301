import { db } from "../db";
import { backupService } from "../services/backupService";
import {
  LegacyMigrationError,
  completeMigrationRecovery,
  enterMigrationRecoveryMode,
  exitMigrationRecoveryMode,
} from "./migrateFromIndexedDb";

/** جدول‌های کاربری که قبل از بازیابی باید خالی باشند (محافظ ضد بازنویسی دادهٔ موجود). */
const USER_DATA_TABLES = ["workers", "attendances", "cashbookEntries", "photos", "floors", "voiceNotes"] as const;

/** فقط شکست مهاجرت، دیتابیس نیتیو را «خالیِ شناخته‌شده» می‌گذارد؛ برای بقیهٔ خطاها بازیابی پیشنهاد نمی‌شود. */
export function isRecoverableByBackup(error: unknown): boolean {
  return error instanceof LegacyMigrationError;
}

/**
 * بازیابی از یک بکاپ خودکار بعد از شکست مهاجرت.
 * ۱) دیتابیس بدون تلاش دوبارهٔ مهاجرت باز می‌شود؛
 * ۲) اگر دادهٔ کاربری در آن باشد، هیچ‌چیز بازنویسی نمی‌شود؛
 * ۳) بکاپ در یک تراکنش بازیابی می‌شود (شکست = بدون تغییر)؛
 * ۴) فقط بعد از موفقیت، flag مهاجرت ثبت می‌شود.
 */
export async function restoreAfterMigrationFailure(fileName: string): Promise<void> {
  enterMigrationRecoveryMode();
  try {
    await db.open();
    for (const name of USER_DATA_TABLES) {
      const count = await db.table(name).count();
      if (count > 0) {
        throw new Error("دیتابیس خالی نیست؛ برای جلوگیری از از دست رفتن اطلاعات، بازیابی انجام نشد.");
      }
    }
    await backupService.restoreFromAutoBackup(fileName);
    await completeMigrationRecovery();
  } catch (e) {
    exitMigrationRecoveryMode();
    throw e;
  }
}
