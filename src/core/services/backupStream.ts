/**
 * فرمت بکاپ تکه‌تکه (نسخهٔ ۲) — بدون وابستگی به دیتابیس؛ فقط قالب فایل + رمزنگاری + اعتبارسنجی.
 *
 * چرا: فرمت قدیمی (نسخهٔ ۱) کل بکاپ را یک JSON واحد می‌کرد و یک‌جا رمز می‌کرد؛ برای بکاپ‌های
 * پر از عکس، چند کپی بزرگ هم‌زمان در حافظه لازم بود. در این فرمت هر رکورد (یک دسته ردیف، یک عکس،
 * یک یادداشت صوتی) جداگانه رمز و در یک خط نوشته می‌شود؛ پس حافظهٔ لازم در حد «بزرگ‌ترین یک رکورد» است.
 *
 * قالب فایل (UTF-8، هر خط یک JSON):
 *   خط ۰    : هدر آشکار {"encrypted":true,"formatVersion":2,"app":"karegah-yar","fileId",...}
 *   خط ۱..N : {"i":<شماره>,"iv":"...","ct":"..."}  — هر کدام یک رکورد رمز‌شده (AES-GCM، IV مستقل)
 *   خط آخر  : تکهٔ «end» (رمز‌شده) شامل تعداد تکه‌ها و شمارش ردیف/عکس/صوت
 *
 * امنیت و یکپارچگی:
 *  - AAD هر تکه = fileId + شمارهٔ ترتیب → جابه‌جایی، حذف از وسط، تکرار و انتقال بین فایل‌ها شناسایی می‌شود.
 *  - تکهٔ end اجباری است → فایل ناقص (بریده‌شده) هرگز «سالم» پذیرفته نمی‌شود.
 *  - داده‌ای از کاربر (نام، مبلغ، ...) هیچ‌جا به‌صورت آشکار در فایل نیست؛ فقط هدر (نوع کلید و salt).
 *
 * سازگاری: فایل‌های نسخهٔ ۱ (و حتی بکاپ‌های قدیمی رمزنگاری‌نشده) توسط backupService همچنان با مسیر قدیمی
 * باز می‌شوند؛ تشخیص با پیشوند هدر انجام می‌شود (STREAM_HEADER_PREFIX).
 */

import {
  createChunkCipher,
  generateFileIdBase64,
  DEVICE_KEY_MISMATCH_MESSAGE,
  WRONG_PASSWORD_MESSAGE,
  type ChunkCipher,
} from "./backupCrypto";

export const STREAM_FORMAT_VERSION = 2;
/** پیشوند ثابت هدر (ترتیب کلیدها در نوشتن ثابت است)؛ برای تشخیص سریع بدون خواندن کل فایل. */
export const STREAM_HEADER_PREFIX = '{"encrypted":true,"formatVersion":2,';
const APP_ID = "karegah-yar";

export interface StreamHeader {
  encrypted: true;
  formatVersion: 2;
  app: "karegah-yar";
  fileId: string;
  keySource: "device" | "password";
  algorithm: "AES-GCM";
  saltBase64: string;
  iterations: number;
}

export type StreamRecord =
  | { t: "meta"; app: string; version: number; exportedAt: string }
  | { t: "rows"; table: string; rows: unknown[] }
  | { t: "photo"; meta: unknown; blobBase64: string; displayBlobBase64?: string }
  | { t: "voice"; meta: unknown; blobBase64: string };

export interface StreamEnd {
  chunks: number;
  counts: Record<string, number>;
}

/** خطای کلید/رمز اشتباه (تگ GCM تکهٔ اول رد شد). */
export class BackupKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupKeyError";
  }
}

/** پیام کاربرپسند «فایل رمزدار است»؛ متن قبلی سرویس بدون تغییر. */
export const BACKUP_PASSWORD_REQUIRED_MESSAGE =
  "این فایل پشتیبان با رمز عبور محافظت شده است. لطفاً رمز عبور را وارد کنید.";

/**
 * فایل بکاپ با رمز عبور محافظت شده ولی رمزی داده نشده. رابط کاربری با
 * `instanceof` همین کلاس (نه تطبیق متن فارسی پیام) تشخیص می‌دهد که باید
 * کادر رمز را نشان دهد.
 */
export class BackupPasswordRequiredError extends Error {
  constructor(message: string = BACKUP_PASSWORD_REQUIRED_MESSAGE) {
    super(message);
    this.name = "BackupPasswordRequiredError";
  }
}

/** خطای فایل خراب/ناقص/دستکاری‌شده (بعد از این‌که کلید درست تأیید شده بود). */
export class BackupCorruptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupCorruptError";
  }
}

const CORRUPT_MESSAGE =
  "فایل پشتیبان خراب یا ناقص است (احتمالاً هنگام انتقال یا ذخیره کامل منتقل نشده). هیچ دیتایی از برنامه تغییر نکرد.";

// ───────────────────────── منبع خط‌به‌خط ─────────────────────────

/** منبع قابل‌خواندن چندباره: خط‌به‌خط (فرمت جدید) یا کل متن (مسیر قدیمی). */
export interface BackupSource {
  lines(): AsyncGenerator<string>;
  text(): Promise<string>;
  /** n کاراکتر اول (برای تشخیص فرمت بدون خواندن کل فایل). */
  head(n: number): Promise<string>;
}

const READ_STEP_BYTES = 1024 * 1024;

export function blobSource(blob: Blob, stepBytes: number = READ_STEP_BYTES): BackupSource {
  return {
    async *lines() {
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      for (let off = 0; off < blob.size; off += stepBytes) {
        const ab = await blob.slice(off, off + stepBytes).arrayBuffer();
        buf += decoder.decode(ab, { stream: true });
        let start = 0;
        for (let nl = buf.indexOf("\n", start); nl >= 0; nl = buf.indexOf("\n", start)) {
          yield buf.slice(start, nl);
          start = nl + 1;
        }
        buf = buf.slice(start);
      }
      buf += decoder.decode();
      if (buf.length) yield buf;
    },
    text: () => blob.text(),
    async head(n) {
      // سربرگ فقط ASCII است؛ n بایت اول برای n کاراکتر کافی است (چندبایتی‌ها فقط کوتاه‌تر می‌شوند).
      const ab = await blob.slice(0, n).arrayBuffer();
      return new TextDecoder("utf-8").decode(ab);
    },
  };
}

/**
 * منبع استریمی از روی یک آدرس قابل‌fetch (مثلاً convertFileSrc روی فایل بکاپ داخلی اندروید).
 * بایت‌ها تکه‌تکه از response.body خوانده می‌شوند؛ کل فایل هرگز یک‌جا وارد heap جاوااسکریپت نمی‌شود.
 * هر متد fetch مستقل خودش را می‌زند (منبع چندبار قابل‌خواندن است: اعتبارسنجی، سپس نوشتن).
 */
export function fetchSource(
  url: string,
  fetchImpl: (input: string) => Promise<Response> = (u) => fetch(u),
): BackupSource {
  const open = async (): Promise<Response> => {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`خواندن فایل پشتیبان ناموفق بود (${res.status}).`);
    return res;
  };
  return {
    async *lines() {
      const res = await open();
      if (!res.body) {
        // مرورگر/WebView بدون پشتیبانی از stream: ناچار کل متن را می‌خوانیم.
        yield* textSource(await res.text()).lines();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let start = 0;
          for (let nl = buf.indexOf("\n", start); nl >= 0; nl = buf.indexOf("\n", start)) {
            yield buf.slice(start, nl);
            start = nl + 1;
          }
          buf = buf.slice(start);
        }
        buf += decoder.decode();
        if (buf.length) yield buf;
      } finally {
        await reader.cancel().catch(() => {});
      }
    },
    async text() {
      return (await open()).text();
    },
    async head(n) {
      const res = await open();
      if (!res.body) return (await res.text()).slice(0, n);
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let out = "";
      try {
        while (out.length < n) {
          const { done, value } = await reader.read();
          if (done) break;
          out += decoder.decode(value, { stream: true });
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      return out.slice(0, n);
    },
  };
}

export function textSource(text: string): BackupSource {
  return {
    async *lines() {
      let start = 0;
      for (let nl = text.indexOf("\n", start); nl >= 0; nl = text.indexOf("\n", start)) {
        yield text.slice(start, nl);
        start = nl + 1;
      }
      if (start < text.length) yield text.slice(start);
    },
    text: async () => text,
    head: async (n) => text.slice(0, n),
  };
}

/** آیا این منبع با هدر فرمت تکه‌تکه شروع می‌شود؟ (BOM احتمالی نادیده گرفته می‌شود.) */
export async function isStreamBackup(source: BackupSource): Promise<boolean> {
  const head = (await source.head(STREAM_HEADER_PREFIX.length + 8)).replace(/^\uFEFF/, "");
  return head.startsWith(STREAM_HEADER_PREFIX);
}

function isStreamHeader(v: unknown): v is StreamHeader {
  if (!v || typeof v !== "object") return false;
  const h = v as Record<string, unknown>;
  return (
    h.encrypted === true &&
    h.formatVersion === STREAM_FORMAT_VERSION &&
    h.app === APP_ID &&
    typeof h.fileId === "string" &&
    h.fileId.length > 0 &&
    (h.keySource === "device" || h.keySource === "password") &&
    h.algorithm === "AES-GCM" &&
    typeof h.saltBase64 === "string" &&
    typeof h.iterations === "number"
  );
}

function aadFor(fileId: string, seq: number): string {
  return `${APP_ID}|${fileId}|${seq}`;
}

// ───────────────────────── نویسنده ─────────────────────────

/** تعداد کل «ردیف‌های» شمارش‌شده در تکهٔ end برای عکس/صوت با این کلیدها ثبت می‌شود. */
export const COUNT_KEY_PHOTOS = "photos";
export const COUNT_KEY_VOICE_NOTES = "voiceNotes";

export class StreamBackupWriter {
  private seq = 0;
  private readonly counts: Record<string, number> = {};
  private finished = false;

  private readonly cipher: ChunkCipher;
  private readonly fileId: string;
  private readonly emit: (line: string) => Promise<void>;

  private constructor(cipher: ChunkCipher, fileId: string, emit: (line: string) => Promise<void>) {
    this.cipher = cipher;
    this.fileId = fileId;
    this.emit = emit;
  }

  /** هدر را می‌نویسد و نویسنده را برمی‌گرداند. emit هر بار یک خط کامل (با \n پایانی) می‌گیرد. */
  static async create(opts: {
    cipher: ChunkCipher;
    exportedAt: string;
    dataVersion: number;
    emit: (line: string) => Promise<void>;
  }): Promise<StreamBackupWriter> {
    const fileId = generateFileIdBase64();
    const header: StreamHeader = {
      encrypted: true,
      formatVersion: STREAM_FORMAT_VERSION,
      app: APP_ID,
      fileId,
      keySource: opts.cipher.keySource,
      algorithm: "AES-GCM",
      saltBase64: opts.cipher.saltBase64,
      iterations: opts.cipher.iterations,
    };
    const headerLine = JSON.stringify(header);
    if (!headerLine.startsWith(STREAM_HEADER_PREFIX)) {
      throw new Error("خطای داخلی: ترتیب کلیدهای هدر بکاپ با STREAM_HEADER_PREFIX نمی‌خواند.");
    }
    await opts.emit(headerLine + "\n");
    const w = new StreamBackupWriter(opts.cipher, fileId, opts.emit);
    await w.writePlain(
      JSON.stringify({ t: "meta", app: APP_ID, version: opts.dataVersion, exportedAt: opts.exportedAt } satisfies StreamRecord)
    );
    return w;
  }

  private async writePlain(plaintext: string): Promise<void> {
    if (this.finished) throw new Error("خطای داخلی: نوشتن بعد از پایان بکاپ.");
    const i = this.seq;
    const { ivBase64, ciphertextBase64 } = await this.cipher.encrypt(plaintext, aadFor(this.fileId, i));
    this.seq += 1;
    await this.emit(JSON.stringify({ i, iv: ivBase64, ct: ciphertextBase64 }) + "\n");
  }

  /** rowsJson: هر عنصر یک ردیف از قبل JSON.stringify‌شده (تا برای دسته‌های بزرگ دوباره کپی نشود). */
  async writeRows(table: string, rowsJson: string[]): Promise<void> {
    if (rowsJson.length === 0) return;
    await this.writePlain(`{"t":"rows","table":${JSON.stringify(table)},"rows":[${rowsJson.join(",")}]}`);
    this.counts[table] = (this.counts[table] ?? 0) + rowsJson.length;
  }

  async writePhoto(rec: { meta: unknown; blobBase64: string; displayBlobBase64?: string }): Promise<void> {
    await this.writePlain(JSON.stringify({ t: "photo", ...rec } satisfies StreamRecord));
    this.counts[COUNT_KEY_PHOTOS] = (this.counts[COUNT_KEY_PHOTOS] ?? 0) + 1;
  }

  async writeVoice(rec: { meta: unknown; blobBase64: string }): Promise<void> {
    await this.writePlain(JSON.stringify({ t: "voice", ...rec } satisfies StreamRecord));
    this.counts[COUNT_KEY_VOICE_NOTES] = (this.counts[COUNT_KEY_VOICE_NOTES] ?? 0) + 1;
  }

  /** تکهٔ پایانی را می‌نویسد؛ بدون این تکه فایل هنگام Restore «ناقص» تلقی می‌شود. */
  async finish(): Promise<void> {
    const end: StreamEnd & { t: "end" } = { t: "end", chunks: this.seq, counts: { ...this.counts } };
    await this.writePlain(JSON.stringify(end));
    this.finished = true;
  }
}

// ───────────────────────── خواننده ─────────────────────────

export interface StreamSecrets {
  /** رمز عبور کاربر (برای فایل‌های keySource="password"). */
  password: string | null;
  /** تحویل تنبل کلید دستگاهی (فقط وقتی فایل با کلید دستگاهی رمز شده باشد صدا زده می‌شود). */
  getDeviceKey: () => Promise<string>;
}

export class StreamBackupReader {
  /** پس از تکمیل موفق یک پیمایش (chunks) مقدار می‌گیرد. */
  end: StreamEnd | null = null;

  readonly header: StreamHeader;
  private readonly source: BackupSource;
  private readonly cipher: ChunkCipher;

  private constructor(source: BackupSource, header: StreamHeader, cipher: ChunkCipher) {
    this.source = source;
    this.header = header;
    this.cipher = cipher;
  }

  /** هدر را می‌خواند و رمزنگار را آماده می‌کند (PBKDF2 فقط یک‌بار؛ برای هر دو پیمایش استفاده می‌شود). */
  static async open(source: BackupSource, secrets: StreamSecrets): Promise<StreamBackupReader> {
    let headerLine: string | undefined;
    for await (const line of source.lines()) {
      headerLine = line;
      break;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse((headerLine ?? "").replace(/^\uFEFF/, ""));
    } catch {
      throw new BackupCorruptError(CORRUPT_MESSAGE);
    }
    if (!isStreamHeader(parsed)) throw new BackupCorruptError(CORRUPT_MESSAGE);

    let cipher: ChunkCipher;
    if (parsed.keySource === "password") {
      if (!secrets.password) {
        throw new BackupPasswordRequiredError();
      }
      cipher = await createChunkCipher(
        { keySource: "password", saltBase64: parsed.saltBase64, iterations: parsed.iterations },
        secrets.password
      );
    } else {
      cipher = await createChunkCipher({ keySource: "device" }, await secrets.getDeviceKey());
    }
    return new StreamBackupReader(source, parsed, cipher);
  }

  /**
   * تکه‌های داده را به‌ترتیب می‌دهد (meta اول). در پایان پیمایش (بدون خطا) end پر می‌شود و درستی
   * ترتیب، تعداد و شمارش‌ها تأیید شده است. هر ناسازگاری → خطا (BackupKeyError / BackupCorruptError).
   */
  async *chunks(): AsyncGenerator<StreamRecord> {
    this.end = null;
    const { fileId } = this.header;
    const tally: Record<string, number> = {};
    let seq = 0;
    let isFirstLine = true;
    let ended: StreamEnd | null = null;

    for await (const line of this.source.lines()) {
      if (isFirstLine) {
        isFirstLine = false; // هدر (در open اعتبارسنجی شده)
        continue;
      }
      const clean = line.endsWith("\r") ? line.slice(0, -1) : line;
      if (ended) {
        // بعد از تکهٔ end فقط خط خالی مجاز است (مثلاً \n اضافه)
        if (clean.length === 0) continue;
        throw new BackupCorruptError(CORRUPT_MESSAGE);
      }

      let env: { i: number; iv: string; ct: string };
      try {
        const v = JSON.parse(clean) as Record<string, unknown>;
        if (typeof v.i !== "number" || typeof v.iv !== "string" || typeof v.ct !== "string") throw new Error("shape");
        env = { i: v.i, iv: v.iv, ct: v.ct };
      } catch {
        throw new BackupCorruptError(CORRUPT_MESSAGE);
      }
      if (env.i !== seq) throw new BackupCorruptError(CORRUPT_MESSAGE);

      let plain: string;
      try {
        plain = await this.cipher.decrypt(env.iv, env.ct, aadFor(fileId, seq));
      } catch {
        if (seq === 0) {
          throw new BackupKeyError(this.header.keySource === "password" ? WRONG_PASSWORD_MESSAGE : DEVICE_KEY_MISMATCH_MESSAGE);
        }
        throw new BackupCorruptError(CORRUPT_MESSAGE);
      }

      let rec: Record<string, unknown>;
      try {
        rec = JSON.parse(plain) as Record<string, unknown>;
      } catch {
        throw new BackupCorruptError(CORRUPT_MESSAGE);
      }

      if (seq === 0 && rec.t !== "meta") throw new BackupCorruptError(CORRUPT_MESSAGE);
      if (seq > 0 && rec.t === "meta") throw new BackupCorruptError(CORRUPT_MESSAGE);

      if (rec.t === "end") {
        const chunks = rec.chunks;
        const counts = rec.counts;
        if (typeof chunks !== "number" || !counts || typeof counts !== "object") throw new BackupCorruptError(CORRUPT_MESSAGE);
        if (chunks !== seq) throw new BackupCorruptError(CORRUPT_MESSAGE);
        const c = counts as Record<string, number>;
        const keys = new Set([...Object.keys(c), ...Object.keys(tally)]);
        for (const k of keys) {
          if ((c[k] ?? 0) !== (tally[k] ?? 0)) throw new BackupCorruptError(CORRUPT_MESSAGE);
        }
        ended = { chunks, counts: c };
        seq += 1;
        continue;
      }

      if (rec.t === "meta") {
        if (rec.app !== APP_ID) throw new BackupCorruptError("فایل پشتیبان معتبر نیست.");
      } else if (rec.t === "rows") {
        if (typeof rec.table !== "string" || !Array.isArray(rec.rows)) throw new BackupCorruptError(CORRUPT_MESSAGE);
        tally[rec.table] = (tally[rec.table] ?? 0) + rec.rows.length;
      } else if (rec.t === "photo") {
        if (typeof rec.blobBase64 !== "string" || !rec.meta || typeof rec.meta !== "object") throw new BackupCorruptError(CORRUPT_MESSAGE);
        tally[COUNT_KEY_PHOTOS] = (tally[COUNT_KEY_PHOTOS] ?? 0) + 1;
      } else if (rec.t === "voice") {
        if (typeof rec.blobBase64 !== "string" || !rec.meta || typeof rec.meta !== "object") throw new BackupCorruptError(CORRUPT_MESSAGE);
        tally[COUNT_KEY_VOICE_NOTES] = (tally[COUNT_KEY_VOICE_NOTES] ?? 0) + 1;
      } else {
        throw new BackupCorruptError(CORRUPT_MESSAGE);
      }

      seq += 1;
      yield rec as unknown as StreamRecord;
    }

    if (!ended) throw new BackupCorruptError(CORRUPT_MESSAGE);
    this.end = ended;
  }
}
