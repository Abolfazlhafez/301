import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
type AnyTable = import("../storage/nativeStore").NativeTable<object, object>;
import { db, ensureDatabaseSeeded, DEVICE_SECRET_ROW_ID, type DeviceSecretRow } from "../db";
import { settingsService } from "./settingsService";
import { readDeviceKeyFile, writeDeviceKeyFile } from "../storage/deviceKeyFile";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import {
  decryptWithDeviceKey,
  decryptWithPassword,
  isEncryptedPayloadShape,
  generateDeviceKeyBase64,
  createChunkCipher,
  type ChunkCipher,
  type EncryptedPayload,
} from "./backupCrypto";
import {
  StreamBackupReader,
  StreamBackupWriter,
  blobSource,
  textSource,
  fetchSource,
  isStreamBackup,
  BackupPasswordRequiredError,
  type BackupSource,
} from "./backupStream";

/**
 * پشتیبان‌گیری و بازیابی کامل دیتابیس محلی.
 * چون برنامه کاملاً آفلاین و روی یک دستگاه اجرا می‌شود، این تنها راه انتقال
 * اطلاعات بین دستگاه‌ها یا نگهداری نسخه پشتیبان است.
 *
 * دو مسیر بکاپ وجود دارد:
 * ۱. بکاپ دستی: کاربر با یک دکمه، فایل JSON را دانلود/اشتراک می‌گذارد (خروج از اپ).
 * ۲. بکاپ خودکار دوره‌ای: بدون دخالت کاربر، در حافظهٔ داخلی خود اپ (Directory.Data)
 *    نسخه‌بندی‌شده ذخیره می‌شود تا در صورت کرش یا بسته‌شدن غیرمنتظرهٔ اپ، اطلاعات
 *    از دست نرود. این پوشه بین اجراهای اپ باقی می‌ماند (per-app storage اندروید)
 *    و به اینترنت هیچ وابستگی ندارد.
 */

const BACKUP_VERSION = 1;
const AUTO_BACKUP_DIR = "auto-backups";
const AUTO_BACKUP_FILE_PREFIX = "auto-backup-";

// --- نسخهٔ فایلی کلید دستگاهی (علت وجودی این بخش را در getOrCreateDeviceKey بخوانید) ---

// --- بکاپ اضافی در پوشه اندروید (قابل مشاهده با فایل‌منیجر، جدا از حافظهٔ
// داخلی خصوصی اپ) — علاوه بر بکاپ داخلی، نه به‌جای آن. نگهداری بر اساس
// تعداد روز (نه تعداد نسخه): هر نسخه دقیقاً ۱۵ روز نگه داشته می‌شود.
const EXTERNAL_BACKUP_DIR = "KaregahYar/backups";
export const EXTERNAL_BACKUP_RETENTION_DAYS = 15;

// --- فهرست جدول‌های قابل پشتیبان‌گیری ---
//
// چرا این لیست هنوز صراحتاً نوشته شده (نه فقط db.tables خام): چون بعضی
// جدول‌ها (مثل deviceSecrets) باید عمداً از بکاپ مستثنا بمانند. اما برخلاف
// نسخهٔ قبلی که این لیست را در سه جای مجزا (نوع، خواندن، نوشتن) تکرار
// می‌کرد، حالا:
//   ۱. این‌جا فقط یک منبع واحد است.
//   ۲. تابع assertBackupTableListIsComplete در پایین فایل، این لیست را در
//      هر اجرای Backup با فهرست واقعی db.tables (که مستقیماً از خودِ
//      schema در Dexie می‌آید) مقایسه می‌کند و اگر جدولی در schema باشد
//      که این‌جا فراموش شده، بلافاصله خطا پرتاب می‌کند — یعنی اگر فردا
//      Entity/جدول جدیدی اضافه شود ولی کسی فراموش کند این‌جا هم اضافه‌اش
//      کند، اولین بار که کسی روی برنامه Backup بگیرد متوجه می‌شود، نه
//      این‌که بی‌صدا و برای همیشه از بکاپ‌ها جا بیفتد.
const DEVICE_ONLY_TABLE_NAMES = ["deviceSecrets"] as const;

export const BACKUP_TABLE_NAMES = [
  "workers",
  "attendances",
  "breakTimes",
  "timeLosses",
  "equipment",
  "equipmentAssignments",
  "ledgerEntries",
  "cashbookEntries",
  "cashboxFunds",
  "optionalLeaves",
  "jobTypes",
  "wageMethods",
  "wageAssignments",
  "wageCalculations",
  "settings",
  "photos",
  "pictureCards",
  "futureActivities",
  "guardShifts",
  "dailyReportNotes",
  "workLogNotes",
  "floors",
  "floorStages",
  "floorTasks",
  "floorPlans",
  "floorIssues",
  "floorWorkers",
  "floorChecklistItems",
  "floorActivityEvents",
  "projects",
  "projectWorkers",
  "workerGroups",
  "groupWagePayments",
  "voiceNotes",
] as const;

type BackupTableName = (typeof BACKUP_TABLE_NAMES)[number];

/**
 * بررسی می‌کند که فهرست ثابت BACKUP_TABLE_NAMES دقیقاً با فهرست واقعی
 * جدول‌های موجود در schema دیتابیس (منهای جدول‌های عمداً مستثنا مثل
 * deviceSecrets) یکی باشد. اگر جدولی در schema باشد که این‌جا نیامده،
 * خطای مشخص پرتاب می‌شود — این دقیقاً همان «مکانیسم اعتبارسنجی» است که
 * پرامپت اصلی درخواست کرده: Backup نباید بتواند بی‌صدا داده‌ای را جا بیندازد.
 *
 * export شده (نه فقط داخلی) تا در تست‌های تجربی مستقیماً و بدون نیاز به
 * فراخوانی کامل exportAll() قابل بررسی باشد.
 */
export function assertBackupTableListIsComplete(): void {
  const actualTableNames = db.tables.map((t) => t.name);
  const expectedSet = new Set<string>([...BACKUP_TABLE_NAMES, ...DEVICE_ONLY_TABLE_NAMES]);
  const missingFromList = actualTableNames.filter((name) => !expectedSet.has(name));
  if (missingFromList.length > 0) {
    throw new Error(
      `خطای داخلی سیستم پشتیبان‌گیری: جدول(های) [${missingFromList.join(
        ", "
      )}] در دیتابیس تعریف شده‌اند ولی در فهرست BACKUP_TABLE_NAMES نیستند. ` +
        `این یعنی داده‌های این جدول(ها) در Backup گنجانده نمی‌شوند — قبل از ادامه، آن‌ها را به BACKUP_TABLE_NAMES` +
        ` (یا در صورت عمدی‌بودن، به DEVICE_ONLY_TABLE_NAMES) در backupService.ts اضافه کنید.`
    );
  }
}

interface BackupFile {
  app: "karegah-yar";
  version: number;
  exportedAt: string;
  // photos و voiceNotes فرمت خاص خودشان را دارند (شامل blobBase64)؛ بقیهٔ
  // جدول‌ها آرایهٔ خام رکوردها هستند. به همین دلیل این دو جدول به‌صورت
  // جداگانه از بقیهٔ جدول‌های عمومی نگه داشته می‌شوند.
  tables: Partial<Record<Exclude<BackupTableName, "photos" | "voiceNotes">, unknown[]>> & {
    photos: { meta: unknown; blobBase64: string; displayBlobBase64?: string }[];
    voiceNotes: { meta: unknown; blobBase64: string }[];
  };
}

export interface AutoBackupInfo {
  /** نام فایل، شامل برچسب زمانی */
  fileName: string;
  /** زمان ساخت این بکاپ (ISO string، استخراج‌شده از نام فایل) */
  createdAt: string;
  /** حجم فایل بر حسب بایت (در صورت در دسترس بودن) */
  sizeBytes?: number;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * خواندن (و در صورت نبود، ساخت) کلید رمزنگاری دستگاهی.
 *
 * چرا دو منبع (IndexedDB و یک فایل جدا در Directory.Data) نگه‌داری می‌شود:
 * روی اندروید/WebView، دادهٔ IndexedDB و فایل‌های بومی Capacitor از نظر
 * فنی هر دو داخل حافظهٔ اختصاصی اپ هستند، ولی همیشه با هم پاک نمی‌شوند —
 * برای نمونه پاک‌کردن دادهٔ WebView (یا بازنشانی آن توسط خودِ سیستم تحت
 * فشار حافظه) می‌تواند IndexedDB را خالی کند در حالی که فایل‌های بکاپ
 * خودکار (که در همان Directory.Data ولی به‌صورت فایل معمولی ذخیره
 * می‌شوند) دست‌نخورده باقی می‌مانند. قبل از این تغییر، در چنین حالتی
 * getOrCreateDeviceKey چون ردیفی در deviceSecrets پیدا نمی‌کرد، یک کلید
 * کاملاً تازه می‌ساخت — و همان بکاپ‌های دست‌نخوردهٔ روی دیسک برای همیشه
 * غیرقابل‌رمزگشایی می‌شدند («فایل خراب یا دستکاری‌شده» با این‌که واقعاً
 * خراب نبودند). حالا قبل از ساختن کلید تازه، نسخهٔ فایلی هم بررسی و در
 * صورت وجود بازیابی می‌شود؛ و هر بار که این تابع صدا زده می‌شود، هر دو
 * منبع با هم همگام نگه داشته می‌شوند.
 */
async function getOrCreateDeviceKey(): Promise<string> {
  await ensureDatabaseSeeded(); // خودش کلید را در اولین اجرا می‌سازد اگر نبود.
  const dbRow = await db.deviceSecrets.get(DEVICE_SECRET_ROW_ID);
  const fileRow = await readDeviceKeyFile();

  if (dbRow) {
    // اگر نسخهٔ فایلی هنوز نیست یا با نسخهٔ IndexedDB فرق دارد، IndexedDB
    // به‌عنوان منبع اصلی در نظر گرفته می‌شود (چون همیشه بوده) و فایل با آن
    // هماهنگ می‌شود.
    if (!fileRow || fileRow.deviceKeyBase64 !== dbRow.deviceKeyBase64) {
      await writeDeviceKeyFile({ deviceKeyBase64: dbRow.deviceKeyBase64, createdAt: dbRow.createdAt });
    }
    return dbRow.deviceKeyBase64;
  }

  if (fileRow) {
    // دقیقاً همان سناریویی که این تغییر برایش نوشته شده: IndexedDB خالی
    // شده ولی نسخهٔ فایلی باقی مانده — به‌جای ساختن کلید تازه، همین کلید
    // قدیمی در IndexedDB هم بازنویسی می‌شود تا بکاپ‌های قبلی همچنان
    // قابل‌رمزگشایی بمانند.
    const restored: DeviceSecretRow = { id: DEVICE_SECRET_ROW_ID, ...fileRow };
    await db.deviceSecrets.put(restored);
    return fileRow.deviceKeyBase64;
  }

  // هیچ‌کدام موجود نیست — واقعاً اولین اجرا. کلید تازه ساخته و در هر دو
  // منبع ذخیره می‌شود.
  const fresh: DeviceSecretRow = {
    id: DEVICE_SECRET_ROW_ID,
    deviceKeyBase64: generateDeviceKeyBase64(),
    createdAt: new Date().toISOString(),
  };
  await db.deviceSecrets.put(fresh);
  await writeDeviceKeyFile({ deviceKeyBase64: fresh.deviceKeyBase64, createdAt: fresh.createdAt });
  return fresh.deviceKeyBase64;
}

/**
 * پوشش نهایی یک بستهٔ رمزنگاری‌شده که روی دیسک/در حافظه ذخیره می‌شود —
 * یک لایهٔ نازک JSON دور EncryptedPayload، فقط برای این‌که در آینده (مثلاً
 * وقتی الگوریتم رمزنگاری عوض شود) بشود نسخه را تشخیص داد.
 */
interface EncryptedBackupFile {
  encrypted: true;
  formatVersion: 1;
  payload: EncryptedPayload;
}

function isEncryptedBackupFile(value: unknown): value is EncryptedBackupFile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.encrypted === true && v.formatVersion === 1 && isEncryptedPayloadShape(v.payload);
}

/**
 * رمزگشایی محتوای یک فایل بکاپ و بازگرداندن متن JSON خام آن.
 *
 * سازگاری با فایل‌های قدیمی: اگر محتوا اصلاً بستهٔ رمزنگاری‌شده نباشد (یعنی
 * قبل از افزوده‌شدن رمزنگاری ساخته شده)، همان متن به‌عنوان JSON خام
 * برگردانده می‌شود — تا بکاپ‌های قدیمی کاربران هم همچنان قابل Restore بمانند.
 */
async function decryptBackupJson(fileText: string, password: string | null): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("فایل پشتیبان یک JSON معتبر نیست.");
  }

  if (!isEncryptedBackupFile(parsed)) {
    // فایل بکاپ قدیمی (رمزنگاری‌نشده) — برای حفظ سازگاری عقب‌رو همان‌طور
    // که هست پذیرفته می‌شود.
    return fileText;
  }

  if (parsed.payload.keySource === "password") {
    if (!password) {
      throw new BackupPasswordRequiredError();
    }
    return decryptWithPassword(parsed.payload, password);
  }

  // keySource === "device"
  const deviceKey = await getOrCreateDeviceKey();
  return decryptWithDeviceKey(parsed.payload, deviceKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// ساخت بکاپ (فرمت تکه‌تکهٔ نسخهٔ ۲ — جزئیات در backupStream.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** سقف تقریبی اندازهٔ هر دستهٔ ردیف‌های جدول‌های عمومی در یک تکه (کاراکتر JSON). */
const EXPORT_ROWS_BATCH_CHARS = 512 * 1024;
/** سقف بافر نوشتن روی فایل پیش از هر فراخوانی bridge بومی. */
const FILE_SINK_BUFFER_CHARS = 512 * 1024;
/** پسوند فایل نیمه‌کارهٔ بکاپ خودکار (هرگز در فهرست بکاپ‌ها نمی‌آید). */
const PART_SUFFIX = ".part";

async function createBackupCipher(password: string | null): Promise<ChunkCipher> {
  return password
    ? createChunkCipher({ keySource: "password" }, password)
    : createChunkCipher({ keySource: "device" }, await getOrCreateDeviceKey());
}

/**
 * کل دیتابیس را به‌صورت تکه‌تکه رمز می‌کند و هر خط را به emit می‌دهد. در هر لحظه فقط یک عکس/صوت
 * در حافظه است. اگر هر مرحله‌ای شکست بخورد (مثلاً فایل عکس روی دیسک نباشد) خطا پرتاب می‌شود —
 * فراخواننده باید خروجی ناقص را دور بریزد؛ بکاپ ناقص هرگز «موفق» اعلام نمی‌شود.
 */
async function writeBackupStream(
  password: string | null,
  emit: (line: string) => Promise<void>,
  exportedAt: string = new Date().toISOString()
): Promise<string> {
  // اعتبارسنجی جنریک: اگر جدول جدیدی به schema اضافه شده و در BACKUP_TABLE_NAMES نیامده، همین‌جا
  // با پیام واضح متوقف می‌شویم — نه این‌که Backup «موفق» ولی ناقص بسازیم.
  assertBackupTableListIsComplete();

  const genericTableNames = BACKUP_TABLE_NAMES.filter((name) => name !== "photos" && name !== "voiceNotes");
  // خواندن همهٔ ردیف‌ها قبل از شروع نوشتن (مثل قبل، تقریباً هم‌زمان)؛ فقط blobها بعداً یکی‌یکی خوانده می‌شوند.
  const genericTablesData = await Promise.all(genericTableNames.map((name) => (db[name] as unknown as AnyTable).toArray()));
  const photos = await db.photos.toArray();
  const voiceNotes = await db.voiceNotes.toArray();

  const cipher = await createBackupCipher(password);
  const writer = await StreamBackupWriter.create({ cipher, exportedAt, dataVersion: BACKUP_VERSION, emit });

  for (let i = 0; i < genericTableNames.length; i += 1) {
    let batch: string[] = [];
    let batchChars = 0;
    for (const row of genericTablesData[i]) {
      const json = JSON.stringify(row);
      batch.push(json);
      batchChars += json.length;
      if (batchChars >= EXPORT_ROWS_BATCH_CHARS) {
        await writer.writeRows(genericTableNames[i], batch);
        batch = [];
        batchChars = 0;
      }
    }
    await writer.writeRows(genericTableNames[i], batch);
  }

  for (const p of photos) {
    // پیش‌نمایش (thumb) مشتق است و در بکاپ نمی‌رود؛ بعد از بازیابی، هنگام نمایش دوباره ساخته می‌شود.
    const { blobUrl: _blobUrl, displayBlobUrl, thumbBlobUrl: _thumbBlobUrl, ...meta } = p;
    const blob = await db.readBlob("photos", p.id, "blob");
    if (!blob) throw new Error(`فایل عکس ${p.id} روی دستگاه پیدا نشد؛ بکاپ ناقص ساخته نمی‌شود.`);
    const displayBlob = displayBlobUrl ? await db.readBlob("photos", p.id, "displayBlob") : null;
    await writer.writePhoto({
      meta,
      blobBase64: await blobToBase64(blob),
      displayBlobBase64: displayBlob ? await blobToBase64(displayBlob) : undefined,
    });
  }

  for (const v of voiceNotes) {
    const { blobUrl: _blobUrl, ...meta } = v;
    const blob = await db.readBlob("voiceNotes", v.id, "blob");
    if (!blob) throw new Error(`فایل صوتی ${v.id} روی دستگاه پیدا نشد؛ بکاپ ناقص ساخته نمی‌شود.`);
    await writer.writeVoice({ meta, blobBase64: await blobToBase64(blob) });
  }

  await writer.finish();
  return exportedAt;
}

/**
 * نوشتن تدریجی روی فایل بومی: اولین بافر با writeFile (بازنویسی)، بقیه با appendFile.
 * خطوط پیش از ارسال به bridge در بافر ~۵۱۲ کیلوکاراکتری جمع می‌شوند تا تعداد فراخوانی‌ها کم بماند.
 */
function createFileSink(path: string, directory: Directory) {
  let buffer = "";
  let uri: string | null = null;
  const flush = async () => {
    if (!buffer) return;
    const data = buffer;
    buffer = "";
    if (uri === null) {
      const res = await Filesystem.writeFile({ path, directory, data, encoding: "utf8" as never });
      uri = res.uri;
    } else {
      await Filesystem.appendFile({ path, directory, data, encoding: "utf8" as never });
    }
  };
  return {
    emit: async (line: string) => {
      buffer += line;
      if (buffer.length >= FILE_SINK_BUFFER_CHARS) await flush();
    },
    close: async () => {
      await flush();
      return uri;
    },
  };
}

/** ساخت Blob خروجی بدون نگه‌داشتن همهٔ خطوط به‌صورت رشته در heap جاوااسکریپت. */
function createBlobSink() {
  let acc = new Blob([], { type: "application/json" });
  let parts: string[] = [];
  let chars = 0;
  const flush = () => {
    if (parts.length === 0) return;
    acc = new Blob([acc, ...parts], { type: "application/json" });
    parts = [];
    chars = 0;
  };
  return {
    emit: async (line: string) => {
      parts.push(line);
      chars += line.length;
      if (chars >= 4 * 1024 * 1024) flush();
    },
    finish: () => {
      flush();
      return acc;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// بازیابی
// ─────────────────────────────────────────────────────────────────────────────

/** نام جدول‌های عمومی قابل نوشتن از «rows» (photos/voiceNotes فقط از تکه‌های اختصاصی خودشان). */
const GENERIC_RESTORE_TABLE_NAMES = new Set<string>(
  BACKUP_TABLE_NAMES.filter((name) => name !== "photos" && name !== "voiceNotes")
);

function rowIdOrThrow(row: unknown, where: string): string {
  const id = row && typeof row === "object" ? (row as { id?: unknown }).id : undefined;
  if (id === undefined || id === null || id === "") throw new Error(`فایل پشتیبان معتبر نیست: رکوردی بدون شناسه در ${where}.`);
  return String(id);
}

/**
 * بازیابی از هر منبع. فرمت تکه‌تکه (v2) در دو پیمایش:
 *  ۱) اعتبارسنجی کامل بدون دست‌زدن به دیتابیس (رمزگشایی همهٔ تکه‌ها، ترتیب، تکهٔ پایانی، شمارش‌ها، شناسه‌های تکراری)
 *  ۲) فقط اگر مرحلهٔ ۱ کاملاً سالم بود: پاک‌سازی و نوشتن داخل یک تراکنش (هر عکس یک‌به‌یک؛ شکست = بازگشت کامل)
 * فایل‌های قدیمی (نسخهٔ ۱ رمزنگاری‌شده یا JSON ساده) همان مسیر قبلی را می‌روند.
 */
async function restoreFromSource(source: BackupSource, password: string | null): Promise<void> {
  if (!(await isStreamBackup(source))) {
    const decryptedJson = await decryptBackupJson(await source.text(), password);
    await restoreFromPayload(JSON.parse(decryptedJson) as BackupFile);
    return;
  }

  const reader = await StreamBackupReader.open(source, { password, getDeviceKey: getOrCreateDeviceKey });

  // ── پیمایش ۱: اعتبارسنجی ──
  const seenIds = new Map<string, Set<string>>();
  const claimId = (table: string, id: string) => {
    let set = seenIds.get(table);
    if (!set) seenIds.set(table, (set = new Set()));
    if (set.has(id)) throw new Error(`فایل پشتیبان معتبر نیست: شناسهٔ تکراری در ${table}.`);
    set.add(id);
  };
  for await (const rec of reader.chunks()) {
    if (rec.t === "rows") {
      if (!GENERIC_RESTORE_TABLE_NAMES.has(rec.table)) continue;
      for (const row of rec.rows) claimId(rec.table, rowIdOrThrow(row, rec.table));
    } else if (rec.t === "photo") {
      claimId("photos", rowIdOrThrow(rec.meta, "photos"));
    } else if (rec.t === "voice") {
      claimId("voiceNotes", rowIdOrThrow(rec.meta, "voiceNotes"));
    }
  }
  if (!reader.end) throw new Error("فایل پشتیبان ناقص است.");
  seenIds.clear();

  // ── پیمایش ۲: نوشتن ──
  await db.transaction("rw", BACKUP_TABLE_NAMES.map((name) => db[name] as unknown as AnyTable), async () => {
    await Promise.all(BACKUP_TABLE_NAMES.map((name) => (db[name] as unknown as AnyTable).clear()));
    for await (const rec of reader.chunks()) {
      if (rec.t === "rows") {
        if (!GENERIC_RESTORE_TABLE_NAMES.has(rec.table)) continue; // جدول ناشناخته (از نسخهٔ جدیدتر) — مثل فرمت قدیمی نادیده گرفته می‌شود
        await (db[rec.table as BackupTableName] as unknown as AnyTable).bulkAdd(rec.rows as never[]);
      } else if (rec.t === "photo") {
        const meta = rec.meta as Record<string, unknown>;
        const row = {
          ...meta,
          blob: base64ToBlob(rec.blobBase64, (meta.mimeType as string) || "image/jpeg"),
          displayBlob: rec.displayBlobBase64 ? base64ToBlob(rec.displayBlobBase64, "image/jpeg") : undefined,
        };
        await db.photos.bulkAdd([row] as never[]);
      } else if (rec.t === "voice") {
        const meta = rec.meta as Record<string, unknown>;
        const row = { ...meta, blob: base64ToBlob(rec.blobBase64, (meta.mimeType as string) || "audio/webm") };
        await db.voiceNotes.bulkAdd([row] as never[]);
      }
    }
  });
  if (!reader.end) throw new Error("فایل پشتیبان ناقص است.");

  await ensureDatabaseSeeded();
}

/** جایگزینی کامل محتوای دیتابیس با یک BackupFile معتبر. */
async function restoreFromPayload(backup: BackupFile): Promise<void> {
  if (backup.app !== "karegah-yar" || !backup.tables) {
    throw new Error("فایل پشتیبان معتبر نیست.");
  }

  // تبدیل base64→Blob عمداً داخل تراکنش و یکی‌یکی انجام می‌شود (نه یک آرایهٔ کامل از
  // همهٔ Blobها قبل از تراکنش) تا قله‌ٔ RAM در بازیابی فایل‌های قدیمی (v1) پایین‌تر بماند.
  // فایل‌های بسیار قدیمی ممکن است کلید photos را نداشته باشند → ?? [] (مثل voiceNotes).
  const photoEntries = backup.tables.photos ?? [];
  const voiceEntries = backup.tables.voiceNotes ?? [];

  await db.transaction("rw", BACKUP_TABLE_NAMES.map((name) => db[name] as unknown as AnyTable), async () => {
    // پاک‌سازی همهٔ جدول‌ها به‌صورت پویا از روی BACKUP_TABLE_NAMES — افزودن
    // جدول جدید در آینده نیازی به تغییر این خط ندارد.
    await Promise.all(BACKUP_TABLE_NAMES.map((name) => (db[name] as unknown as AnyTable).clear()));

    // نوشتن مجدد هر جدول از روی backup.tables، با ?? [] برای سازگاری با
    // فایل‌های بکاپ قدیمی‌تر که ممکن است این جدول را (چون هنوز اضافه نشده
    // بود) نداشته باشند — هیچ جدولی نباید باعث شکست کل Restore شود.
    await Promise.all(
      BACKUP_TABLE_NAMES.filter((name) => name !== "photos" && name !== "voiceNotes").map((name) =>
        (db[name] as unknown as AnyTable).bulkAdd((backup.tables[name] ?? []) as never[])
      )
    );
    for (const p of photoEntries) {
      const meta = p.meta as Record<string, unknown>;
      const row = {
        ...meta,
        blob: base64ToBlob(p.blobBase64, (meta.mimeType as string) || "image/jpeg"),
        displayBlob: p.displayBlobBase64 ? base64ToBlob(p.displayBlobBase64, "image/jpeg") : undefined,
      };
      await db.photos.bulkAdd([row] as never[]);
    }
    for (const v of voiceEntries) {
      const meta = v.meta as Record<string, unknown>;
      const row = { ...meta, blob: base64ToBlob(v.blobBase64, (meta.mimeType as string) || "audio/webm") };
      await db.voiceNotes.bulkAdd([row] as never[]);
    }
  });

  await ensureDatabaseSeeded();
}

/** اطمینان از وجود پوشهٔ بکاپ‌های خودکار در حافظهٔ داخلی اپ. */
async function ensureAutoBackupDir(): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: AUTO_BACKUP_DIR,
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    // اگر از قبل وجود داشته باشد، mkdir خطا می‌دهد؛ قابل‌چشم‌پوشی است.
  }
}

function fileNameFor(timestamp: string): string {
  // ":" در نام فایل روی برخی سیستم‌عامل‌ها مجاز نیست؛ جایگزین می‌شود.
  const safe = timestamp.replace(/:/g, "-");
  return `${AUTO_BACKUP_FILE_PREFIX}${safe}.json`;
}

/** اطمینان از وجود پوشهٔ بکاپ در حافظهٔ خارجی/عمومی اپ (قابل دیدن با فایل‌منیجر). */
async function ensureExternalAutoBackupDir(): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: EXTERNAL_BACKUP_DIR,
      directory: Directory.External,
      recursive: true,
    });
  } catch {
    // اگر از قبل وجود داشته باشد، mkdir خطا می‌دهد؛ قابل‌چشم‌پوشی است.
  }
}

/**
 * کپی یک نسخه از بکاپ در پوشهٔ عمومی اندروید (Directory.External)، علاوه بر
 * نسخهٔ داخلی خصوصی اپ. این مسیر با فایل‌منیجر روی گوشی قابل دسترسی است.
 * خطا در این مرحله نباید مانع بکاپ اصلی (داخلی) شود، پس کاملاً بی‌صدا مدیریت می‌شود.
 */
async function copyBackupToExternalFolder(fileName: string): Promise<void> {
  try {
    await ensureExternalAutoBackupDir();
    // کپی بومی فایل (بدون خواندن محتوا در حافظهٔ جاوااسکریپت)
    await Filesystem.copy({
      from: `${AUTO_BACKUP_DIR}/${fileName}`,
      directory: Directory.Data,
      to: `${EXTERNAL_BACKUP_DIR}/${fileName}`,
      toDirectory: Directory.External,
    });
  } catch {
    // عدم دسترسی به حافظه خارجی نباید کل فرآیند بکاپ‌گیری را متوقف کند.
  }
}

/** حذف نسخه‌های بکاپ خارجی که بیش از ۱۵ روز از ساخته‌شدنشان گذشته است. */
async function pruneExternalBackupsOlderThanRetention(): Promise<void> {
  try {
    const result = await Filesystem.readdir({
      path: EXTERNAL_BACKUP_DIR,
      directory: Directory.External,
    });

    const cutoff = Date.now() - EXTERNAL_BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const f of result.files) {
      const name = typeof f === "string" ? f : f.name;
      const createdAt = timestampFromFileName(name);
      if (!createdAt) continue;
      const createdMs = new Date(createdAt).getTime();
      if (isNaN(createdMs) || createdMs >= cutoff) continue;

      try {
        await Filesystem.deleteFile({
          path: `${EXTERNAL_BACKUP_DIR}/${name}`,
          directory: Directory.External,
        });
      } catch {
        // در صورت خطا در حذف یک فایل، از بقیهٔ پاک‌سازی صرف‌نظر نمی‌کنیم.
      }
    }
  } catch {
    // پوشه هنوز ساخته نشده یا در دسترس نیست؛ چیزی برای حذف وجود ندارد.
  }
}

function timestampFromFileName(fileName: string): string | null {
  if (!fileName.startsWith(AUTO_BACKUP_FILE_PREFIX) || !fileName.endsWith(".json")) return null;
  const safe = fileName.slice(AUTO_BACKUP_FILE_PREFIX.length, -".json".length);
  // بازگرداندن ":" در بخش زمان (ساعت-دقیقه-ثانیه) برای پارس‌شدن به‌عنوان تاریخ معتبر.
  const restored = safe.replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3");
  const date = new Date(restored);
  return isNaN(date.getTime()) ? null : restored;
}

let autoBackupInFlight: Promise<void> | null = null;

/** حذف فایل‌های نیمه‌کارهٔ مانده از یک بکاپ خودکار قطع‌شده (کرش/بسته‌شدن اپ وسط نوشتن). */
async function removeLeftoverPartFiles(): Promise<void> {
  try {
    const result = await Filesystem.readdir({ path: AUTO_BACKUP_DIR, directory: Directory.Data });
    for (const f of result.files) {
      const name = typeof f === "string" ? f : f.name;
      if (!name.endsWith(PART_SUFFIX)) continue;
      await Filesystem.deleteFile({ path: `${AUTO_BACKUP_DIR}/${name}`, directory: Directory.Data }).catch(() => {});
    }
  } catch {
    // پوشه هنوز ساخته نشده؛ چیزی برای حذف نیست.
  }
}

export const backupService = {
  /**
   * ساخت فایل بکاپ رمزنگاری‌شده شامل تمام داده‌های برنامه (شامل خود عکس‌ها و صوت‌ها) به‌صورت
   * Blob، در فرمت تکه‌تکهٔ نسخهٔ ۲ (هر رکورد جداگانه رمز می‌شود؛ جزئیات در backupStream.ts).
   * برای دانلود/اشتراک‌گذاری دستی (مرورگر) و بکاپ ابری استفاده می‌شود.
   *
   * اگر password داده شود، فایل با کلید مشتق‌شده از همان رمز عبور
   * رمزنگاری می‌شود (مناسب برای انتقال بین دستگاه‌ها یا اشتراک‌گذاری با
   * دیگران). اگر داده نشود، با کلید دستگاهی رمزنگاری می‌شود (کاربر چیزی
   * وارد نمی‌کند، ولی فایل همچنان قابل مشاهدهٔ ساده نیست).
   *
   * توجه: نسخه‌های قدیمی‌تر برنامه (قبل از ۱.۴.۰) فایل نسخهٔ ۲ را نمی‌شناسند؛ ولی این نسخه
   * فایل‌های قدیمی را همچنان کامل Restore می‌کند.
   */
  async exportAll(password?: string): Promise<Blob> {
    const sink = createBlobSink();
    await writeBackupStream(password || null, sink.emit);
    return sink.finish();
  },

  /**
   * همان بکاپ نسخهٔ ۲ (با کلید دستگاهی) را خط‌به‌خط به emit می‌دهد، بدون ساخت Blob/رشتهٔ کامل.
   * هر خط کامل و با \n پایانی است. برای بکاپ ابری تکه‌ای استفاده می‌شود.
   * اگر وسط کار خطا بیاید پرتاب می‌شود؛ فراخواننده باید خروجی ناقص را دور بریزد.
   */
  async exportToLines(emit: (line: string) => Promise<void>): Promise<void> {
    await writeBackupStream(null, emit);
  },

  /**
   * بازیابی از یک BackupSource دلخواه (مثلاً منبع تکه‌ای ابری) با کلید دستگاهی.
   * همان مسیر دو مرحله‌ای importAll: اعتبارسنجی کامل، سپس پاک‌سازی و نوشتن.
   */
  async importFromSource(source: BackupSource): Promise<void> {
    await restoreFromSource(source, null);
  },

  /**
   * پشتیبان‌گیری «یک‌لمسی»: هم فایل را می‌سازد و هم بلافاصله آن را دانلود یا
   * (روی اندروید) از طریق منوی اشتراک‌گذاری بومی در اختیار کاربر می‌گذارد —
   * دقیقاً همان منطقی که پیش‌تر فقط داخل صفحهٔ تنظیمات به‌صورت محلی نوشته شده
   * بود؛ حالا در یک‌جا (اینجا) نگه‌داری می‌شود تا هم از تنظیمات و هم از هر
   * نقطهٔ دیگری از اپ (مثلاً یک دکمهٔ سریع در داشبورد) قابل استفاده باشد.
   */
  async exportAndShare(password?: string): Promise<void> {
    const stamp = getTodayIso();
    const filename = `karegah-yar-backup-${stamp}.json`;

    if (Capacitor.isNativePlatform()) {
      // روی گوشی مستقیم و تدریجی روی فایل می‌نویسیم (بدون ساخت Blob/base64 کل بکاپ در حافظه).
      const sink = createFileSink(filename, Directory.Cache);
      let uri: string | null;
      try {
        await writeBackupStream(password || null, sink.emit);
        uri = await sink.close();
      } catch (err) {
        await Filesystem.deleteFile({ path: filename, directory: Directory.Cache }).catch(() => {});
        throw err;
      }
      if (!uri) throw new Error("ساخت فایل پشتیبان ناموفق بود.");
      await Share.share({
        title: filename,
        files: [uri],
      });
    } else {
      const blob = await this.exportAll(password);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  },

  /**
   * بازیابی از فایل پشتیبان انتخاب‌شده توسط کاربر. این عملیات کل دیتابیس فعلی را
   * پاک و جایگزین می‌کند.
   *
   * اگر فایل با رمز عبور محافظت شده باشد و password داده نشده باشد، یک خطای
   * مشخص («این فایل پشتیبان با رمز عبور محافظت شده است...») پرتاب می‌شود —
   * UI باید این خطا را بگیرد و از کاربر رمز عبور بخواهد.
   */
  async importAll(file: File, password?: string): Promise<void> {
    await restoreFromSource(blobSource(file), password || null);
  },

  // ------------------------------------------------------------------
  // بکاپ خودکار دوره‌ای (داخل حافظهٔ اپ، بدون دخالت کاربر)
  // ------------------------------------------------------------------

  /**
   * در صورت لزوم (بر اساس تنظیمات کاربر و زمان آخرین بکاپ)، یک بکاپ خودکار جدید
   * می‌سازد و نسخه‌های اضافی قدیمی را حذف می‌کند. فقط روی پلتفرم بومی (اندروید)
   * فعال است؛ چون در مرورگر معمولی جای مطمئنی برای نوشتن فایل وجود ندارد.
   *
   * این متد امن است تا در هر بار باز شدن اپ صدا زده شود؛ اگر هنوز زمانش نرسیده
   * باشد یا غیرفعال باشد، کاری انجام نمی‌دهد.
   */
  async runAutoBackupIfDue(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;

    const settings = await settingsService.get();
    if (!settings.autoBackupEnabled) return false;

    const intervalMs = settings.autoBackupIntervalHours * 60 * 60 * 1000;
    const last = settings.lastAutoBackupAt ? new Date(settings.lastAutoBackupAt).getTime() : 0;
    const due = Date.now() - last >= intervalMs;
    if (!due) return false;

    await this.createAutoBackup();
    return true;
  },

  /**
   * بلافاصله یک بکاپ خودکار جدید می‌سازد (صرف‌نظر از زمان‌بندی) و نسخه‌های
   * اضافی قدیمی را طبق تنظیمات کاربر حذف می‌کند.
   *
   * هر خطایی در این مسیر (چه از فراخوانی خودکار دوره‌ای، چه از دکمهٔ دستی
   * «ساخت بکاپ داخلی همین حالا») قبل از پرتاب مجدد، در settings ثبت می‌شود
   * (markAutoBackupError) — قبلاً مسیر خودکار این خطاها را کاملاً بی‌صدا
   * می‌بلعید (رجوع کن به useAutoBackup) و کاربر هیچ نشانه‌ای نمی‌دید.
   */
  async createAutoBackup(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // در محیط غیر بومی (مرورگر توسعه)، فایل‌سیستم پایدار در دسترس نیست.
      return;
    }
    // هم‌زمانی (اجرای دوره‌ای + دکمهٔ دستی) یک بکاپ سنگین دوم یا حذف فایل نیمه‌کارهٔ دیگری ایجاد نمی‌کند.
    if (autoBackupInFlight) return autoBackupInFlight;
    autoBackupInFlight = this.runCreateAutoBackup().finally(() => {
      autoBackupInFlight = null;
    });
    return autoBackupInFlight;
  },

  async runCreateAutoBackup(): Promise<void> {
    let partPath: string | null = null;
    try {
      await ensureAutoBackupDir();
      await removeLeftoverPartFiles();

      const exportedAt = new Date().toISOString();
      const fileName = fileNameFor(exportedAt);
      const finalPath = `${AUTO_BACKUP_DIR}/${fileName}`;
      partPath = `${finalPath}${PART_SUFFIX}`;

      // بکاپ خودکار همیشه با کلید دستگاهی رمزنگاری می‌شود — بدون دخالت کاربر،
      // چون این فرآیند کاملاً بی‌صدا و در پس‌زمینه اجرا می‌شود.
      // ابتدا در فایل «.part» نوشته می‌شود و فقط بعد از پایان کامل (شامل تکهٔ end) به نام نهایی
      // تغییر نام می‌دهد؛ پس یک بکاپ نیمه‌کاره هرگز در فهرست/بازیابی ظاهر نمی‌شود.
      const sink = createFileSink(partPath, Directory.Data);
      await writeBackupStream(null, sink.emit, exportedAt);
      await sink.close();
      await Filesystem.rename({ from: partPath, to: finalPath, directory: Directory.Data, toDirectory: Directory.Data });
      partPath = null;

      // کپی اضافی در پوشه عمومی اندروید (بی‌صدا؛ در صورت خطا مانع بکاپ اصلی نمی‌شود)
      // و حذف نسخه‌های خارجی قدیمی‌تر از ۱۵ روز.
      await copyBackupToExternalFolder(fileName);
      await pruneExternalBackupsOlderThanRetention();

      await settingsService.markAutoBackupDone(exportedAt);
      await this.pruneOldAutoBackups();
    } catch (err) {
      if (partPath) await Filesystem.deleteFile({ path: partPath, directory: Directory.Data }).catch(() => {});
      const message = err instanceof Error ? err.message : "خطای ناشناختهٔ بکاپ خودکار.";
      await settingsService.markAutoBackupError(message).catch(() => {
        // اگر حتی ثبت خودِ خطا هم شکست بخورد، دیگر کاری نمی‌شود کرد؛ خطای
        // اصلی هم‌چنان در ادامه پرتاب می‌شود.
      });
      throw err;
    }
  },

  /** فهرست بکاپ‌های خودکار موجود، از جدیدترین به قدیمی‌ترین. */
  async listAutoBackups(): Promise<AutoBackupInfo[]> {
    if (!Capacitor.isNativePlatform()) return [];

    try {
      const result = await Filesystem.readdir({
        path: AUTO_BACKUP_DIR,
        directory: Directory.Data,
      });

      const infos: AutoBackupInfo[] = result.files
        .map((f): AutoBackupInfo | null => {
          const name = typeof f === "string" ? f : f.name;
          const createdAt = timestampFromFileName(name);
          if (!createdAt) return null;
          const sizeBytes = typeof f === "string" ? undefined : f.size;
          return { fileName: name, createdAt, sizeBytes };
        })
        .filter((x): x is AutoBackupInfo => x !== null)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      return infos;
    } catch {
      // پوشه هنوز ساخته نشده (هنوز هیچ بکاپ خودکاری گرفته نشده است).
      return [];
    }
  },

  /** حذف بکاپ‌های خودکار اضافی، فراتر از سقف تعیین‌شده در تنظیمات کاربر. */
  async pruneOldAutoBackups(): Promise<void> {
    const settings = await settingsService.get();
    const backups = await this.listAutoBackups();
    const excess = backups.slice(settings.autoBackupMaxVersions);

    for (const b of excess) {
      try {
        await Filesystem.deleteFile({
          path: `${AUTO_BACKUP_DIR}/${b.fileName}`,
          directory: Directory.Data,
        });
      } catch {
        // در صورت خطا در حذف یک فایل، از بقیهٔ پاک‌سازی صرف‌نظر نمی‌کنیم.
      }
    }
  },

  /** بازیابی از یکی از بکاپ‌های خودکار داخلی، با نام فایل مشخص. */
  async restoreFromAutoBackup(fileName: string): Promise<void> {
    const path = `${AUTO_BACKUP_DIR}/${fileName}`;
    // بکاپ‌های خودکار همیشه با کلید دستگاهی رمزنگاری شده‌اند (نه رمز عبور)،
    // پس نیازی به گرفتن رمز از کاربر نیست.
    //
    // مسیر اصلی: خواندن استریمی از طریق آدرس فایل (convertFileSrc) — Capacitor 6 در readFile
    // offset ندارد، ولی WebView می‌تواند فایل را تکه‌تکه fetch کند.
    let source: BackupSource | null = null;
    try {
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
      const candidate = fetchSource(Capacitor.convertFileSrc(uri));
      await candidate.head(16); // بررسی اینکه fetch روی این WebView واقعاً کار می‌کند
      source = candidate;
    } catch {
      source = null;
    }
    if (source) {
      await restoreFromSource(source, null);
      return;
    }

    // پشتیبان: خواندن یک‌جای کل فایل (مثل قبل).
    const result = await Filesystem.readFile({ path, directory: Directory.Data, encoding: "utf8" as never });
    const text = typeof result.data === "string" ? result.data : await (result.data as Blob).text();
    await restoreFromSource(textSource(text), null);
  },

  /** حذف دستی یک بکاپ خودکار مشخص. */
  async deleteAutoBackup(fileName: string): Promise<void> {
    await Filesystem.deleteFile({
      path: `${AUTO_BACKUP_DIR}/${fileName}`,
      directory: Directory.Data,
    });
  },
};
