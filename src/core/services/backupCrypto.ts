/**
 * رمزنگاری فایل‌های پشتیبان با Web Crypto API استاندارد (AES-GCM + PBKDF2).
 *
 * چرا Web Crypto و نه یک کتابخانهٔ خارجی: این API به‌صورت بومی هم در
 * مرورگر/WebView (که برنامهٔ فعلی روی آن اجرا می‌شود) و هم در Node.js
 * (برای اجرای تست‌های تجربی) موجود است — بدون نیاز به هیچ وابستگی اضافه.
 * وقتی معماری Native Android پیاده شود، منبع تولید/نگهداری کلید می‌تواند
 * به Android Keystore منتقل شود بدون این‌که فرمت رمزنگاری‌شدهٔ خروجی
 * (EncryptedPayload) تغییر کند — یعنی بکاپ‌های رمزنگاری‌شدهٔ قبلی همچنان
 * با نسخهٔ Native هم سازگار می‌مانند.
 *
 * دو حالت کلید پشتیبانی می‌شود:
 *  ۱. کلید دستگاهی (deviceKey): یک راز تصادفی که یک‌بار تولید و در
 *     جدولی کاملاً مستقل از فرآیند Backup/Restore نگه داشته می‌شود — یعنی
 *     خودِ کلید هرگز داخل فایل بکاپ قرار نمی‌گیرد. برای بکاپ خودکار داخلی
 *     استفاده می‌شود که بدون دخالت کاربر اجرا می‌شود.
 *  ۲. کلید مبتنی بر رمز عبور (password-derived): با PBKDF2 از یک رمز عبور
 *     که کاربر هنگام Export/Import دستی وارد می‌کند مشتق می‌شود. برای
 *     بکاپ‌هایی که ممکن است بین دستگاه‌ها منتقل شوند مناسب‌تر است، چون
 *     کلید دستگاهی مقصد با کلید دستگاهی مبدأ یکی نیست.
 */

const PBKDF2_ITERATIONS = 210_000; // توصیهٔ فعلی OWASP برای PBKDF2-SHA256
const AES_KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12; // طول استاندارد IV برای AES-GCM

/** ساختار نهایی یک بستهٔ رمزنگاری‌شده — قابل ذخیره/انتقال به‌صورت JSON. */
export interface EncryptedPayload {
  /** به‌صورت صریح مشخص می‌کند این بستهٔ رمزنگاری‌شده با کدام روش تولید کلید ساخته شده. */
  keySource: "device" | "password";
  algorithm: "AES-GCM";
  /** Base64 — برای مشتق‌سازی کلید از رمز عبور لازم است؛ برای کلید دستگاهی هم پر می‌شود (یکسان‌سازی فرمت) ولی استفاده نمی‌شود. */
  saltBase64: string;
  ivBase64: string;
  /** متن رمزنگاری‌شده به‌همراه تگ احراز اصالت GCM، به‌صورت Base64. */
  ciphertextBase64: string;
  iterations: number;
}

/** پیام خطای ناسازگاری کلید دستگاهی (مشترک بین فرمت قدیمی تک‌تکه‌ای و فرمت تکه‌تکه). */
export const DEVICE_KEY_MISMATCH_MESSAGE =
  "این فایل پشتیبان با کلید رمزنگاری دستگاه دیگری (یا نصب قبلی همین برنامه) ساخته شده و با نصب فعلی سازگار نیست — نه لزوماً به این معنا که فایل خراب است. برای بکاپ‌هایی که قرار است بین نصب‌ها/دستگاه‌ها منتقل شوند، از گزینهٔ رمز عبور هنگام «دانلود فایل پشتیبان» استفاده کنید.";

/** پیام خطای رمز عبور نادرست (مشترک بین فرمت قدیمی و فرمت تکه‌تکه). */
export const WRONG_PASSWORD_MESSAGE =
  "رمز عبور وارد‌شده درست نیست — لطفاً دوباره و با دقت (با توجه به حروف بزرگ/کوچک و فاصله) امتحان کنید. " +
        "فقط اگر مطمئنید رمز درست است و باز هم این خطا تکرار می‌شود، احتمال دارد فایل هنگام انتقال (مثلاً اشتراک‌گذاری از طریق پیام‌رسان‌ها) خراب یا ناقص شده باشد.";

function getSubtleCrypto(): SubtleCrypto {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto API در این محیط در دسترس نیست.");
  }
  return crypto.subtle;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** مشتق‌سازی یک کلید AES-GCM از یک رمز عبور متنی، با PBKDF2-SHA256. */
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const baseKey = await subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"]
  );
}

/** ساخت یک CryptoKey مستقیم از رشتهٔ base64 یک کلید دستگاهی خام (بدون PBKDF2 — چون خودِ کلید دستگاهی از قبل تصادفی و باکیفیت است). */
async function importDeviceKey(deviceKeyBase64: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const raw = base64ToBytes(deviceKeyBase64);
  return subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/**
 * تولید یک کلید دستگاهی تصادفی جدید و باکیفیت (۲۵۶ بیت)، به‌صورت رشتهٔ
 * base64 خام — برای ذخیره در جدول deviceSecrets.
 */
export function generateDeviceKeyBase64(): string {
  return bytesToBase64(randomBytes(AES_KEY_LENGTH_BITS / 8));
}

/** رمزنگاری یک رشتهٔ متنی (معمولاً JSON.stringify شدهٔ payload بکاپ) با کلید دستگاهی. */
export async function encryptWithDeviceKey(plaintext: string, deviceKeyBase64: string): Promise<EncryptedPayload> {
  const subtle = getSubtleCrypto();
  const key = await importDeviceKey(deviceKeyBase64);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const encoder = new TextEncoder();
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, encoder.encode(plaintext));
  return {
    keySource: "device",
    algorithm: "AES-GCM",
    saltBase64: "", // کلید دستگاهی نیازی به salt ندارد؛ برای یکسان‌بودن فرمت خالی نگه داشته می‌شود.
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(new Uint8Array(ciphertext)),
    iterations: 0,
  };
}

/** رمزگشایی یک بستهٔ رمزنگاری‌شده با keySource="device"، با همان کلید دستگاهی. */
export async function decryptWithDeviceKey(payload: EncryptedPayload, deviceKeyBase64: string): Promise<string> {
  if (payload.keySource !== "device") {
    throw new Error("این بسته با کلید دستگاهی رمزنگاری نشده است.");
  }
  const subtle = getSubtleCrypto();
  const key = await importDeviceKey(deviceKeyBase64);
  const iv = base64ToBytes(payload.ivBase64);
  const ciphertext = base64ToBytes(payload.ciphertextBase64);
  let plainBuffer: ArrayBuffer;
  try {
    plainBuffer = await subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ciphertext as BufferSource);
  } catch {
    // نکته: این فایل با «کلید دستگاهی» رمزنگاری شده بود (بدون رمز عبور).
    // اگر همین حالا هم با کلید دستگاهی فعلی باز نشود، رایج‌ترین دلیل خرابی
    // فایل نیست — بلکه این است که برنامه از نصب قبلی پاک و از نو نصب شده
    // (مثلاً هنگام بروزرسانی، یا تعویض گوشی)، که باعث می‌شود یک کلید دستگاهی
    // کاملاً تازه و متفاوت ساخته شود. این پیام حالا این را صریح می‌گوید تا
    // کاربر به‌جای فکر کردن به «فایل خراب»، بداند مشکل از عدم تطابق دستگاه/نصب
    // است — و برای انتقال بین دستگاه‌ها یا نگه‌داری مطمئن‌تر، از «دانلود فایل
    // پشتیبان» با یک رمز عبور دستی استفاده کند (که به کلید دستگاه وابسته نیست).
    throw new Error(DEVICE_KEY_MISMATCH_MESSAGE);
  }
  return new TextDecoder().decode(plainBuffer);
}

/** رمزنگاری یک رشتهٔ متنی با کلید مشتق‌شده از رمز عبور کاربر. */
export async function encryptWithPassword(plaintext: string, password: string): Promise<EncryptedPayload> {
  const subtle = getSubtleCrypto();
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const key = await deriveKeyFromPassword(password, salt);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const encoder = new TextEncoder();
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, encoder.encode(plaintext));
  return {
    keySource: "password",
    algorithm: "AES-GCM",
    saltBase64: bytesToBase64(salt),
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(new Uint8Array(ciphertext)),
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * رمزگشایی یک بستهٔ رمزنگاری‌شده با keySource="password". اگر رمز عبور
 * اشتباه باشد، AES-GCM تگ احراز اصالت را رد می‌کند و خطای مشخص «رمز عبور
 * اشتباه یا فایل خراب است» پرتاب می‌شود — نه یک خروجی نامفهوم بی‌صدا.
 */
export async function decryptWithPassword(payload: EncryptedPayload, password: string): Promise<string> {
  if (payload.keySource !== "password") {
    throw new Error("این بسته با رمز عبور رمزنگاری نشده است.");
  }
  const subtle = getSubtleCrypto();
  const salt = base64ToBytes(payload.saltBase64);
  const key = await deriveKeyFromPassword(password, salt);
  const iv = base64ToBytes(payload.ivBase64);
  const ciphertext = base64ToBytes(payload.ciphertextBase64);
  let plainBuffer: ArrayBuffer;
  try {
    plainBuffer = await subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ciphertext as BufferSource);
  } catch {
    // نکته: بیشترِ قریب‌به‌اتفاق موارد این خطا، صرفاً رمز عبور اشتباه است
    // (مثلاً بزرگ/کوچک بودن حروف یا یک فاصلهٔ اضافه) — نه واقعاً فایل خراب.
    // پیام قبلی («رمز اشتباه یا فایل خراب») این دو حالت را هم‌وزن نشان
    // می‌داد و کاربر را نگران خرابی فایل می‌کرد، در حالی که تقریباً همیشه
    // راه‌حل فقط تلاش دوبارهٔ رمز است. حالا صریحاً همین را اول می‌گوید.
    throw new Error(WRONG_PASSWORD_MESSAGE);
  }
  return new TextDecoder().decode(plainBuffer);
}

/** بررسی سطحی این‌که آیا یک آبجکت شکل EncryptedPayload معتبر دارد یا نه (بدون رمزگشایی). */
export function isEncryptedPayloadShape(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.keySource === "device" || v.keySource === "password") &&
    v.algorithm === "AES-GCM" &&
    typeof v.ivBase64 === "string" &&
    typeof v.ciphertextBase64 === "string"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// رمزنگاری تکه‌تکه (فرمت بکاپ نسخهٔ ۲)
//
// فرمت قدیمی کل JSON را یک‌جا رمز می‌کرد، پس برای بکاپ‌های حجیم چندین کپی
// بزرگ هم‌زمان در حافظه لازم بود. این‌جا کلید فقط یک‌بار ساخته می‌شود
// (PBKDF2 فقط یک‌بار) و هر «تکه» با IV تصادفیِ مستقل و AAD اختصاصی رمز می‌شود.
// AAD شامل شناسهٔ فایل و شمارهٔ ترتیب است، پس جابه‌جایی/حذف/تکرار تکه‌ها
// یا انتقال تکه‌ها بین دو فایل، در رمزگشایی (تگ GCM) شناسایی می‌شود.
// تابع‌های قدیمی بالا دست‌نخورده می‌مانند تا فایل‌های قدیمی همچنان باز شوند.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChunkCipherParams {
  keySource: "device" | "password";
  /** فقط برای keySource="password": salt به‌صورت base64 (برای رمزگشایی الزامی؛ برای رمزنگاری اگر نباشد ساخته می‌شود). */
  saltBase64?: string;
  iterations?: number;
}

export interface ChunkCipher {
  keySource: "device" | "password";
  saltBase64: string;
  iterations: number;
  encrypt(plaintext: string, aad: string): Promise<{ ivBase64: string; ciphertextBase64: string }>;
  /** در صورت ناموفق‌بودن تگ GCM، خطای خام (غیرقابل‌تفسیر) پرتاب می‌شود؛ تفسیر پیام با فراخواننده است. */
  decrypt(ivBase64: string, ciphertextBase64: string, aad: string): Promise<string>;
}

/**
 * ساخت یک رمزنگار تکه‌ای. secret = رمز عبور (برای "password") یا کلید دستگاهی base64 (برای "device").
 */
export async function createChunkCipher(params: ChunkCipherParams, secret: string): Promise<ChunkCipher> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();

  let key: CryptoKey;
  let saltBase64 = "";
  let iterations = 0;
  if (params.keySource === "password") {
    const salt = params.saltBase64 ? base64ToBytes(params.saltBase64) : randomBytes(SALT_LENGTH_BYTES);
    saltBase64 = bytesToBase64(salt);
    iterations = PBKDF2_ITERATIONS;
    if (params.iterations !== undefined && params.iterations !== PBKDF2_ITERATIONS) {
      // تعداد تکرار فایل باید با ثابت برنامه یکی باشد؛ مقدار دلخواهِ فایل (مثلاً خیلی بزرگ) هرگز اعمال نمی‌شود.
      throw new Error("پارامترهای رمزنگاری این فایل پشتیبان پشتیبانی نمی‌شود.");
    }
    key = await deriveKeyFromPassword(secret, salt);
  } else {
    key = await importDeviceKey(secret);
  }

  return {
    keySource: params.keySource,
    saltBase64,
    iterations,
    async encrypt(plaintext, aad) {
      const iv = randomBytes(IV_LENGTH_BYTES);
      const ct = await subtle.encrypt(
        { name: "AES-GCM", iv: iv as BufferSource, additionalData: encoder.encode(aad) as BufferSource },
        key,
        encoder.encode(plaintext)
      );
      return { ivBase64: bytesToBase64(iv), ciphertextBase64: bytesToBase64(new Uint8Array(ct)) };
    },
    async decrypt(ivBase64, ciphertextBase64, aad) {
      const plain = await subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(ivBase64) as BufferSource, additionalData: encoder.encode(aad) as BufferSource },
        key,
        base64ToBytes(ciphertextBase64) as BufferSource
      );
      return new TextDecoder().decode(plain);
    },
  };
}

/** یک شناسهٔ تصادفی کوتاه (base64) برای اتصال تکه‌های یک فایل بکاپ به همان فایل. */
export function generateFileIdBase64(): string {
  return bytesToBase64(randomBytes(12));
}
