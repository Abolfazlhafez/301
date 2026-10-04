/**
 * تست بازیابی بعد از شکست مهاجرت (مورد ۱ فهرست کارها):
 *  - فقط LegacyMigrationError «قابل بازیابی با بکاپ» است؛
 *  - حالت بازیابی، مهاجرت را رد می‌کند (دادهٔ قدیمی را دوباره نمی‌خواند/پاک نمی‌کند)؛
 *  - seed کلید دستگاه، در نبود کلید فایلی، کلید تازه می‌سازد (رفتار قبلی حفظ شده).
 */
import "fake-indexeddb/auto";
import {
  LegacyMigrationError,
  enterMigrationRecoveryMode,
  exitMigrationRecoveryMode,
  migrateLegacyIndexedDbIfNeeded,
} from "../storage/migrateFromIndexedDb";
import { isRecoverableByBackup } from "../storage/migrationRecovery";
import { db, ensureDatabaseSeeded, DEVICE_SECRET_ROW_ID } from "../db";

let passed = 0;
let failed = 0;
function check(ok: boolean, name: string) {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
  }
}

async function main() {
  check(isRecoverableByBackup(new LegacyMigrationError("x")), "LegacyMigrationError قابل بازیابی است");
  check(!isRecoverableByBackup(new Error("x")), "خطای عمومی قابل بازیابی نیست");
  check(!isRecoverableByBackup("x"), "مقدار غیرخطا قابل بازیابی نیست");

  enterMigrationRecoveryMode();
  const report = await migrateLegacyIndexedDbIfNeeded(db, ["workers"]);
  check(report.status === "skipped-recovery", "در حالت بازیابی مهاجرت رد می‌شود");
  exitMigrationRecoveryMode();

  await db.open();
  await ensureDatabaseSeeded();
  const secret = await db.deviceSecrets.get(DEVICE_SECRET_ROW_ID);
  check(!!secret && secret.deviceKeyBase64.length > 10, "بدون فایل کلید، کلید تازه ساخته می‌شود (Node)");

  console.log(`\nنتیجه: ${passed} موفق، ${failed} ناموفق`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
