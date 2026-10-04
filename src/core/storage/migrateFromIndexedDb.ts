import { Preferences } from "@capacitor/preferences";
import Dexie from "dexie";
import { LEGACY_DB_NAME, legacyDb } from "../legacyDb";
import type { NativeDatabase } from "./nativeStore";
import type { StorageOp } from "./types";

const FLAG_KEY = "storage.nativeMigration.v1";

export class LegacyMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacyMigrationError";
  }
}

/**
 * حالت بازیابی: وقتی مهاجرت شکست خورده و کاربر می‌خواهد از بکاپ خودکار برگردد،
 * دیتابیس نیتیو باید بدون تلاش دوبارهٔ مهاجرت باز شود. فقط در حافظه نگه داشته
 * می‌شود؛ با راه‌اندازی دوباره همیشه false است، پس هر شکستی خودبه‌خود به
 * «تلاش دوبارهٔ مهاجرت» برمی‌گردد.
 */
let recoveryMode = false;

export function enterMigrationRecoveryMode(): void {
  recoveryMode = true;
}

export function exitMigrationRecoveryMode(): void {
  recoveryMode = false;
}

/**
 * ثبت پایان بازیابی: بعد از بازیابی موفق، flag مهاجرت ثبت می‌شود تا در اجرای بعدی
 * مهاجرت دوباره دادهٔ بازیابی‌شده را پاک نکند. IndexedDB قدیمی عمداً حذف نمی‌شود
 * (فقط فضا اشغال می‌کند؛ دادهٔ کاربر هیچ‌وقت بی‌اعتبارسنجی پاک نمی‌شود).
 */
export async function completeMigrationRecovery(): Promise<void> {
  await Preferences.set({ key: FLAG_KEY, value: "done" });
  recoveryMode = false;
}

export interface MigrationReport {
  status: "skipped-already-done" | "skipped-no-legacy" | "skipped-recovery" | "migrated";
  counts: Record<string, number>;
}

// جدول‌هایی که Blob دارند: فیلدهای Blob → فایل روی دیسک
const BLOB_TABLES: Record<string, string[]> = { photos: ["blob", "displayBlob"], voiceNotes: ["blob"] };

/**
 * انتقال یک‌باره و ایمن داده‌ها از IndexedDB قدیمی (Dexie) به ذخیره‌سازی نیتیو.
 *
 * ایمنی:
 *  1) داده‌های قدیمی تا پایانِ «کپی + اعتبارسنجی» هیچ‌وقت پاک نمی‌شوند.
 *  2) هر جدول بعد از کپی شمارش و (برای Blobها) وجود/اندازهٔ فایل‌ها بررسی می‌شود.
 *  3) اگر هر مرحله خطا بدهد، دادهٔ نیتیوِ ناقص پاک می‌شود، flag ثبت نمی‌شود و
 *     دفعهٔ بعد از اول تلاش می‌شود؛ دادهٔ قدیمی دست‌نخورده می‌ماند.
 *  4) فقط بعد از موفقیت کامل، flag ثبت و IndexedDB قدیمی حذف می‌شود.
 */
export async function migrateLegacyIndexedDbIfNeeded(
  native: NativeDatabase,
  tableNames: string[]
): Promise<MigrationReport> {
  if (recoveryMode) return { status: "skipped-recovery", counts: {} };
  const flag = await Preferences.get({ key: FLAG_KEY }).catch(() => ({ value: null }));
  if (flag.value === "done") return { status: "skipped-already-done", counts: {} };

  const hasIndexedDb = typeof indexedDB !== "undefined";
  const legacyExists = hasIndexedDb ? await Dexie.exists(LEGACY_DB_NAME).catch(() => false) : false;
  if (!legacyExists) {
    await Preferences.set({ key: FLAG_KEY, value: "done" }).catch(() => {});
    return { status: "skipped-no-legacy", counts: {} };
  }

  const counts: Record<string, number> = {};
  try {
    // شروع تمیز: هر چیزی که از تلاش ناقص قبلی مانده پاک شود (منبع حقیقت = دادهٔ قدیمی)
    await native.rawApply(tableNames.map((t) => ({ t: "clear", table: t }) as StorageOp));
    await native.blobs.removeAll().catch(() => {});

    await legacyDb.open(); // Dexie ارتقاهای schema قدیمی را خودش اجرا می‌کند

    for (const name of tableNames) {
      const legacyTable = legacyDb.table(name);
      const blobFields = BLOB_TABLES[name];
      const keys = (await legacyTable.toCollection().primaryKeys()) as string[];
      const ops: StorageOp[] = [];
      for (const key of keys) {
        const row = (await legacyTable.get(key)) as Record<string, unknown> | undefined;
        if (!row) continue;
        const stored: Record<string, unknown> = { ...row };
        if (blobFields) {
          const files: Record<string, { path: string; size: number; type: string }> = {};
          for (const f of blobFields) {
            const v = stored[f];
            delete stored[f];
            if (v instanceof Blob) {
              const ext = v.type.split("/")[1]?.split(";")[0] || "bin";
              const path = `${name}/${String(row.id)}__${f}__m1.${ext === "jpeg" ? "jpg" : ext}`;
              await native.blobs.write(path, v);
              files[f] = { path, size: v.size, type: v.type };
            }
          }
          if (Object.keys(files).length) stored.__files = files;
        }
        ops.push({ t: "put", table: name, key: String(row.id), json: JSON.stringify(stored) });
        // برای جلوگیری از انباشت حافظه، batchهای کوچک نوشته می‌شوند
        if (ops.length >= 100) await native.rawApply(ops.splice(0, ops.length));
      }
      if (ops.length) await native.rawApply(ops);
      counts[name] = keys.length;
    }

    // اعتبارسنجی: شمارش هر جدول + وجود و اندازهٔ همهٔ فایل‌ها.
    // ⚠️ این‌جا داخل open() هستیم؛ نباید از API جدول (که منتظر open می‌ماند) استفاده کرد،
    // وگرنه بن‌بست می‌شود. مستقیم از کش داخلی می‌خوانیم.
    await native.loadAllFromBackend();
    for (const name of tableNames) {
      const rows = [...native.rowsOf(name).values()];
      const legacyCount = await legacyDb.table(name).count();
      if (rows.length !== legacyCount) {
        throw new LegacyMigrationError(
          `مهاجرت جدول ${name} ناقص است: قدیمی=${legacyCount} ، جدید=${rows.length}. دادهٔ قدیمی دست‌نخورده ماند.`
        );
      }
      if (BLOB_TABLES[name]) {
        for (const row of rows) {
          for (const ref of Object.values(row.__files ?? {})) {
            const st = await native.blobs.stat(ref.path);
            if (!st || st.size !== ref.size) {
              throw new LegacyMigrationError(`فایل ${ref.path} پس از انتقال سالم نیست؛ دادهٔ قدیمی دست‌نخورده ماند.`);
            }
          }
        }
      }
    }
  } catch (e) {
    await native.rawApply(tableNames.map((t) => ({ t: "clear", table: t }) as StorageOp)).catch(() => {});
    await native.blobs.removeAll().catch(() => {});
    legacyDb.close();
    if (e instanceof LegacyMigrationError) throw e;
    throw new LegacyMigrationError(`انتقال داده‌ها به ذخیره‌سازی جدید انجام نشد (داده‌های قبلی سالم است): ${String((e as Error)?.message ?? e)}`);
  }

  await Preferences.set({ key: FLAG_KEY, value: "done" }).catch(() => {});
  legacyDb.close();
  await Dexie.delete(LEGACY_DB_NAME).catch(() => {}); // آزادسازی فضای WebView
  return { status: "migrated", counts };
}
