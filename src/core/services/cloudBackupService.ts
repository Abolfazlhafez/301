import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { settingsService } from "./settingsService";
import { backupService } from "./backupService";
import type { BackupSource } from "./backupStream";

/**
 * بکاپ ابری اختیاری — یک «آینهٔ» رمزنگاری‌شده از همان فایل بکاپ محلی
 * (backupService.exportAll)، که به‌جای فایل روی دیسک، در یک جدول ساده در
 * پروژهٔ شخصی Supabase کاربر ذخیره می‌شود.
 *
 * اصول طراحی:
 *  ۱. برنامه کاملاً آفلاین باقی می‌ماند. این سرویس هرگز در مسیر خواندن/
 *     نوشتن دادهٔ اصلی برنامه قرار نمی‌گیرد — فقط وقتی صریحاً صدا زده
 *     شود (توسط useCloudBackup یا کاربر با دکمهٔ «بکاپ ابری اکنون») و
 *     اتصال اینترنت موجود باشد، تلاش می‌کند.
 *  ۲. هیچ خطایی از این سرویس نباید تجربهٔ کاربر یا داده‌های محلی را مختل
 *     کند — قطعی اینترنت، خاموش‌بودن قابلیت، یا اشتباه در تنظیمات همگی
 *     باید بی‌صدا (یا با پیام قابل‌فهم در UI، نه throw غیرمنتظره در مسیر
 *     اصلی) مدیریت شوند.
 *  ۳. کلید/آدرس Supabase مخصوص حساب شخصی هر کاربر است و هرگز در کد
 *     هاردکد نمی‌شود؛ از settingsService (که در Dexie محلی ذخیره است)
 *     خوانده می‌شود.
 *  ۴. محتوایی که در Supabase قرار می‌گیرد، همان محتوای رمزنگاری‌شدهٔ
 *     بکاپ نسخهٔ ۲ است — یعنی حتی اگر کسی به‌جز کاربر به
 *     جدول Supabase دسترسی پیدا کند (که با RLS باید غیرممکن باشد)،
 *     داده‌ها بدون رمز عبور/کلید دستگاهی خوانا نیستند.
 *  ۵. (از ۱.۵.۰) آپلود تکه‌ای و اتمیک: بکاپ خط‌به‌خط (همان خطوط رمزشدهٔ فایل نسخهٔ ۲) در
 *     تکه‌های ≈۵۰۰KB زیر یک upload_id تازه در جدول chunks نوشته می‌شود و فقط بعد از آپلود
 *     کامل، ردیف heads (اشاره‌گر نسخهٔ فعال) به آن upload_id برمی‌گردد. آپلود ناقص هرگز
 *     جایگزین بکاپ سالم قبلی نمی‌شود. اگر جدول‌های جدید ساخته نشده باشند، به ردیف
 *     قدیمی payload تکی (جدول karegah_yar_device_backups) برمی‌گردد.
 */

export interface CloudBackupConnectionTestResult {
  ok: boolean;
  message: string;
}

/** جدول قدیمی (payload تکی) — برای سازگاری با بکاپ‌های قبلی و کاربرانی که SQL جدید را اجرا نکرده‌اند. */
const TABLE_NAME = "karegah_yar_device_backups";
const CHUNKS_TABLE = "karegah_yar_backup_chunks";
const HEADS_TABLE = "karegah_yar_backup_heads";

const DEFAULT_CHUNK_CHARS = 512 * 1024;

type ClientFactory = (url: string, anonKey: string) => SupabaseClient;

const defaultClientFactory: ClientFactory = (url, anonKey) =>
  createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

let clientFactory: ClientFactory = defaultClientFactory;
let chunkChars = DEFAULT_CHUNK_CHARS;

/** فقط برای تست‌ها: تزریق کلاینت ساختگی و اندازهٔ تکهٔ کوچک. */
export const cloudBackupTestHooks = {
  setClientFactory(factory: ClientFactory | null): void {
    clientFactory = factory ?? defaultClientFactory;
  },
  setChunkChars(n: number | null): void {
    chunkChars = n ?? DEFAULT_CHUNK_CHARS;
  },
};

/** جدول‌های تکه‌ای در پروژهٔ Supabase کاربر ساخته نشده‌اند (SQL جدید اجرا نشده). */
class CloudSchemaMissingError extends Error {}

interface SupabaseErrorLike {
  message?: string;
  code?: string;
}

function isMissingTableError(error: SupabaseErrorLike | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

/** خطای Supabase را به خطای مناسب تبدیل می‌کند: نبود جدول = CloudSchemaMissingError. */
function toCloudError(error: SupabaseErrorLike, context: string): Error {
  if (isMissingTableError(error)) return new CloudSchemaMissingError(context);
  return new Error(`${context}: ${error.message ?? "خطای ناشناخته"}`);
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newUploadId(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = c.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface CloudBackupHead {
  upload_id: string;
  chunk_count: number;
  total_chars: number;
  manifest_checksum: string;
}

/** منبع خط‌به‌خطِ بکاپ که تکه‌ها را یکی‌یکی از Supabase می‌گیرد (هر لحظه فقط یک تکه در حافظه). */
function chunkedCloudSource(client: SupabaseClient, deviceId: string, head: CloudBackupHead): BackupSource {
  const fetchChunk = async (index: number): Promise<{ payload: string; checksum: string }> => {
    const { data, error } = await client
      .from(CHUNKS_TABLE)
      .select("payload,checksum")
      .eq("device_id", deviceId)
      .eq("upload_id", head.upload_id)
      .eq("chunk_index", index)
      .maybeSingle();
    if (error) throw new Error(`خطا در دریافت تکهٔ ${index} بکاپ ابری: ${error.message}`);
    if (!data || typeof data.payload !== "string") {
      throw new Error(`بکاپ ابری ناقص است: تکهٔ ${index} از ${head.chunk_count} یافت نشد. هیچ دیتایی از برنامه تغییر نکرد.`);
    }
    const actual = await sha256Hex(data.payload);
    if (actual !== data.checksum) {
      throw new Error(`بکاپ ابری خراب است: چک‌سام تکهٔ ${index} نمی‌خواند. هیچ دیتایی از برنامه تغییر نکرد.`);
    }
    return { payload: data.payload, checksum: data.checksum };
  };

  async function* lines(): AsyncGenerator<string> {
    if (!Number.isInteger(head.chunk_count) || head.chunk_count <= 0) {
      throw new Error("بکاپ ابری معتبر نیست: تعداد تکه‌ها نامعتبر است.");
    }
    const checksums: string[] = [];
    let totalChars = 0;
    let carry = "";
    for (let i = 0; i < head.chunk_count; i++) {
      const { payload, checksum } = await fetchChunk(i);
      checksums.push(checksum);
      totalChars += payload.length;
      carry += payload;
      let start = 0;
      for (let nl = carry.indexOf("\n", start); nl >= 0; nl = carry.indexOf("\n", start)) {
        yield carry.slice(start, nl);
        start = nl + 1;
      }
      carry = carry.slice(start);
    }
    if (carry.length) yield carry;
    if (totalChars !== head.total_chars || (await sha256Hex(checksums.join(","))) !== head.manifest_checksum) {
      throw new Error("بکاپ ابری خراب است: مجموع تکه‌ها با ردیف اصلی نمی‌خواند. هیچ دیتایی از برنامه تغییر نکرد.");
    }
  }

  return {
    lines,
    async text() {
      let out = "";
      for (let i = 0; i < head.chunk_count; i++) out += (await fetchChunk(i)).payload;
      return out;
    },
    async head(n: number) {
      return (await fetchChunk(0)).payload.slice(0, n);
    },
  };
}

function getClient(url: string, anonKey: string): SupabaseClient {
  return clientFactory(url, anonKey);
}

/** آیا اتصال اینترنت در حال حاضر برقرار به‌نظر می‌رسد؟ (بررسی سطحی — درخواست واقعی خودش هم می‌تواند شکست بخورد، این فقط یک میان‌بر برای صرفه‌جویی است.) */
function isLikelyOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** آپلود تکه‌ای اتمیک: تکه‌ها زیر upload_id تازه، و فقط در پایان heads به آن اشاره می‌کند. */
async function uploadChunked(client: SupabaseClient, deviceId: string): Promise<void> {
  const uploadId = newUploadId();
  const checksums: string[] = [];
  let totalChars = 0;
  let buffer = "";

  const flush = async () => {
    if (!buffer) return;
    const payload = buffer;
    buffer = "";
    const checksum = await sha256Hex(payload);
    const { error } = await client.from(CHUNKS_TABLE).upsert({
      device_id: deviceId,
      upload_id: uploadId,
      chunk_index: checksums.length,
      payload,
      checksum,
      chars: payload.length,
      created_at: new Date().toISOString(),
    });
    if (error) throw toCloudError(error, "آپلود تکهٔ بکاپ ابری ناموفق بود");
    checksums.push(checksum);
    totalChars += payload.length;
  };

  try {
    await backupService.exportToLines(async (line) => {
      buffer += line;
      if (buffer.length >= chunkChars) await flush();
    });
    await flush();
    if (checksums.length === 0) throw new Error("بکاپ خالی ساخته شد.");

    // نقطهٔ فعال‌سازی: تا این ردیف عوض نشود، بکاپ قبلی (سالم) همچنان نسخهٔ فعال است.
    const head: CloudBackupHead & { device_id: string; updated_at: string } = {
      device_id: deviceId,
      upload_id: uploadId,
      chunk_count: checksums.length,
      total_chars: totalChars,
      manifest_checksum: await sha256Hex(checksums.join(",")),
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from(HEADS_TABLE).upsert(head);
    if (error) throw toCloudError(error, "فعال‌سازی بکاپ ابری ناموفق بود");
  } catch (err) {
    // آپلود ناقص: تکه‌های همین تلاش را (در صورت امکان) پاک می‌کنیم؛ نسخهٔ فعال قبلی دست‌نخورده است.
    if (!(err instanceof CloudSchemaMissingError)) {
      try {
        await client.from(CHUNKS_TABLE).delete().eq("device_id", deviceId).eq("upload_id", uploadId);
      } catch {
        // فقط زباله می‌ماند؛ در بکاپ موفق بعدی پاک می‌شود.
      }
    }
    throw err;
  }

  // پاک‌سازی نسخه‌های قبلی و آپلودهای ناقص قدیمی. شکستش بکاپ را خراب نمی‌کند.
  try {
    await client.from(CHUNKS_TABLE).delete().eq("device_id", deviceId).neq("upload_id", uploadId);
  } catch {
    // نادیده گرفته می‌شود.
  }
}

/** مسیر قدیمی: کل بکاپ در یک ردیف payload (برای کاربرانی که جدول‌های جدید را نساخته‌اند). */
async function uploadLegacySingleRow(client: SupabaseClient, deviceId: string): Promise<void> {
  const blob = await backupService.exportAll();
  const encryptedText = await blob.text();
  const { error } = await client.from(TABLE_NAME).upsert({
    device_id: deviceId,
    payload: encryptedText,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

let cloudBackupInFlight: Promise<void> | null = null;

async function runCloudBackupIfDueInner(): Promise<void> {
  try {
    const settings = await settingsService.get();
    if (!settings.cloudBackupEnabled) return;
    if (!settings.cloudBackupSupabaseUrl || !settings.cloudBackupSupabaseAnonKey) return;
    if (!isLikelyOnline()) return;

    const intervalMs = settings.cloudBackupIntervalHours * 60 * 60 * 1000;
    if (settings.lastCloudBackupAt) {
      const elapsedMs = Date.now() - new Date(settings.lastCloudBackupAt).getTime();
      if (elapsedMs < intervalMs) return;
    }

    const client = getClient(settings.cloudBackupSupabaseUrl, settings.cloudBackupSupabaseAnonKey);
    try {
      await uploadChunked(client, settings.cloudBackupDeviceId);
    } catch (err) {
      if (!(err instanceof CloudSchemaMissingError)) throw err;
      // جدول‌های تکه‌ای ساخته نشده‌اند: مثل نسخه‌های قبل، یک‌تکه.
      await uploadLegacySingleRow(client, settings.cloudBackupDeviceId);
    }

    await settingsService.markCloudBackupDone(new Date().toISOString());
  } catch (err) {
    // هر خطا (قطع اینترنت، آپلود ناقص، ...) برای کاربر بی‌صدا؛ lastCloudBackupAt عوض نمی‌شود و تلاش بعدی دوباره انجام می‌شود.
    // فقط نام/پیام خطا لاگ می‌شود (بدون URL/کلید/داده) تا عیب‌یابی ممکن باشد.
    console.warn("[cloudBackup] auto backup failed:", err instanceof Error ? err.name : "unknown");
    // برای نمایش در تنظیمات؛ قطع اینترنت وسط کار هم همین‌جا ثبت می‌شود و با اولین موفقیت بعدی پاک می‌شود.
    const message = err instanceof Error && err.message ? err.message : "unknown";
    await settingsService.markCloudBackupError(message).catch(() => {});
  }
}

export const cloudBackupService = {
  /**
   * تست اتصال به Supabase با تنظیمات داده‌شده — بدون آپلود واقعی داده،
   * فقط یک درخواست سبک برای بررسی این‌که آدرس/کلید درست و جدول‌ها موجودند.
   */
  async testConnection(url: string, anonKey: string): Promise<CloudBackupConnectionTestResult> {
    if (!isLikelyOnline()) {
      return { ok: false, message: "دستگاه به اینترنت متصل نیست." };
    }
    try {
      const client = getClient(url, anonKey);
      const heads = await client.from(HEADS_TABLE).select("device_id").limit(1);
      const chunks = await client.from(CHUNKS_TABLE).select("device_id").limit(1);
      const chunkedMissing = isMissingTableError(heads.error) || isMissingTableError(chunks.error);

      if (!chunkedMissing) {
        const other = heads.error ?? chunks.error;
        if (other) return { ok: false, message: `خطا در اتصال: ${other.message}` };
        return { ok: true, message: "اتصال به Supabase با موفقیت برقرار شد (بکاپ تکه‌ای فعال است)." };
      }

      // جدول‌های جدید نیستند؛ آیا جدول قدیمی هست؟
      const { error } = await client.from(TABLE_NAME).select("device_id").limit(1);
      if (error) {
        if (isMissingTableError(error)) {
          return {
            ok: false,
            message: `اتصال برقرار شد، ولی جدول‌های بکاپ در پروژهٔ Supabase شما یافت نشد. طبق راهنمای تنظیمات، ابتدا SQL را اجرا کنید.`,
          };
        }
        return { ok: false, message: `خطا در اتصال: ${error.message}` };
      }
      return {
        ok: true,
        message:
          "اتصال برقرار شد، ولی جدول‌های بکاپ تکه‌ای ساخته نشده‌اند؛ فعلاً بکاپ به‌صورت قدیمی (یک‌تکه) ذخیره می‌شود. برای بکاپ تکه‌ای، SQL راهنما را اجرا کنید.",
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "خطای ناشناخته در اتصال." };
    }
  },

  /**
   * اگر بکاپ ابری فعال باشد، اینترنت موجود باشد، و از آخرین بکاپ ابری
   * موفق به‌اندازهٔ کافی گذشته باشد، یک بکاپ تازه می‌سازد و تکه‌تکه در Supabase کاربر ذخیره می‌کند.
   * هرگز throw نمی‌کند. اجرای هم‌زمان (شروع اپ + resume) یک Promise مشترک دارد.
   */
  async runCloudBackupIfDue(): Promise<void> {
    if (cloudBackupInFlight) return cloudBackupInFlight;
    cloudBackupInFlight = runCloudBackupIfDueInner().finally(() => {
      cloudBackupInFlight = null;
    });
    return cloudBackupInFlight;
  },

  /**
   * بازیابی از آخرین بکاپ ابری فعال — برای دستگاه جدید یا بعد از پاک‌شدن دادهٔ محلی.
   * اول نسخهٔ تکه‌ای (heads)، و اگر نبود، ردیف قدیمی payload تکی.
   */
  async restoreFromCloud(url: string, anonKey: string, deviceId: string): Promise<void> {
    const client = getClient(url, anonKey);

    const headRes = await client
      .from(HEADS_TABLE)
      .select("upload_id,chunk_count,total_chars,manifest_checksum")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (headRes.error) {
      if (!isMissingTableError(headRes.error)) {
        throw new Error(`خطا در دریافت بکاپ ابری: ${headRes.error.message}`);
      }
      // جدول heads نیست: فقط مسیر قدیمی.
    } else if (headRes.data) {
      // اگر نسخهٔ تکه‌ای هست ولی ناقص/خراب است، عمداً به ردیف قدیمیِ کهنه برنمی‌گردیم.
      await backupService.importFromSource(chunkedCloudSource(client, deviceId, headRes.data as CloudBackupHead));
      return;
    }

    const { data, error } = await client
      .from(TABLE_NAME)
      .select("payload")
      .eq("device_id", deviceId)
      .maybeSingle();

    // کاربر جدید فقط جدول‌های تکه‌ای را ساخته؛ نبود جدول قدیمی یعنی «هیچ بکاپی نیست».
    if (error && !isMissingTableError(error)) throw new Error(`خطا در دریافت بکاپ ابری: ${error.message}`);
    if (error || !data?.payload) throw new Error("هیچ بکاپ ابری‌ای برای این دستگاه یافت نشد.");

    const file = new File([data.payload as string], "cloud-backup.json", { type: "application/json" });
    await backupService.importAll(file);
  },
};
