/**
 * تشخیص فرمت واقعی فایل تصویر و تبدیل HEIC/HEIF به فرمتی قابل نمایش در وب.
 *
 * چرا این ماژول لازم است:
 * - مرورگرها و WebView اندروید معمولاً تصاویر HEIC/HEIF را مستقیم نمایش نمی‌دهند.
 * - بسیاری از گوشی‌ها هنگام انتخاب فایل، mimeType درستی برای HEIC ارسال نمی‌کنند
 *   (اغلب "" یا "application/octet-stream")، پس باید بایت‌های ابتدایی فایل را
 *   بررسی کرد (magic bytes) تا فرمت واقعی مشخص شود.
 * - تبدیل باید کاملاً آفلاین انجام شود (بدون فراخوانی سرور) و هرگز نباید باعث
 *   کرش برنامه شود، حتی برای فایل‌های خراب یا فرمت‌های ناشناخته.
 */

export type DetectedImageKind = "jpeg" | "png" | "webp" | "gif" | "heic" | "unknown";

/** خواندن چند بایت ابتدایی یک Blob برای بررسی امضای فرمت (magic bytes). */
async function readHeaderBytes(blob: Blob, length: number): Promise<Uint8Array> {
  const slice = blob.slice(0, length);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

function bytesToAscii(bytes: Uint8Array, start: number, end: number): string {
  return Array.from(bytes.slice(start, end))
    .map((b) => String.fromCharCode(b))
    .join("");
}

// برندهای شناخته‌شده HEIC/HEIF داخل جعبه ftyp فایل‌های ISOBMFF.
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

/**
 * تشخیص فرمت واقعی تصویر با بررسی امضای بایتی فایل (نه صرفاً mimeType مرورگر
 * که ممکن است نادرست یا خالی باشد). در صورت هر خطا، 'unknown' برمی‌گرداند و
 * هرگز پرتاب استثنا نمی‌کند تا مسیر آپلود هیچ‌گاه کرش نکند.
 */
export async function detectImageKind(file: Blob): Promise<DetectedImageKind> {
  try {
    const header = await readHeaderBytes(file, 32);

    // JPEG: FF D8 FF
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "jpeg";

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
    ) {
      return "png";
    }

    // GIF: "GIF87a" or "GIF89a"
    if (bytesToAscii(header, 0, 3) === "GIF") return "gif";

    // WEBP: "RIFF" .... "WEBP"
    if (bytesToAscii(header, 0, 4) === "RIFF" && bytesToAscii(header, 8, 12) === "WEBP") {
      return "webp";
    }

    // HEIC/HEIF: جعبه ISOBMFF با نوع "ftyp" در بایت ۴ تا ۷، و برند در بایت ۸ تا ۱۱
    if (header.length >= 12 && bytesToAscii(header, 4, 8) === "ftyp") {
      const brand = bytesToAscii(header, 8, 12).toLowerCase();
      if (HEIF_BRANDS.has(brand)) return "heic";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

/** بررسی سریع بر اساس پسوند نام فایل، به‌عنوان راهنمای کمکی (نه منبع اصلی تصمیم). */
export function hasHeicExtension(fileName: string): boolean {
  return /\.(heic|heif)$/i.test(fileName);
}

const MIME_BY_KIND: Record<Exclude<DetectedImageKind, "unknown" | "heic">, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function mimeTypeForKind(kind: DetectedImageKind): string {
  if (kind === "heic") return "image/heic";
  if (kind === "unknown") return "application/octet-stream";
  return MIME_BY_KIND[kind];
}

export interface HeicConversionResult {
  ok: true;
  blob: Blob;
}
export interface HeicConversionFailure {
  ok: false;
  reason: string;
}

/**
 * تبدیل یک فایل HEIC/HEIF به JPEG با کیفیت بالا، برای نمایش داخلی در برنامه.
 * فایل اصلی کاربر دست‌نخورده باقی می‌ماند؛ این تابع فقط یک Blob جدید برای
 * نمایش برمی‌گرداند و چیزی را جایگزین نمی‌کند.
 *
 * نکات ایمنی:
 * - کتابخانه heic2any به‌صورت پویا (dynamic import) بارگذاری می‌شود تا حجم
 *   بستهٔ اصلی برنامه افزایش نیابد و فقط وقتی واقعاً لازم است بارگذاری شود.
 * - یک سقف زمانی (timeout) روی عملیات تبدیل گذاشته شده تا در صورت گیر کردن
 *   روی فایل خراب یا حجیم، کل برنامه معطل/فریز نشود.
 * - هیچ استثنایی از این تابع بیرون نمی‌رود؛ همیشه یک نتیجهٔ موفق یا ناموفق
 *   قابل‌مدیریت برمی‌گرداند.
 */
// تبدیل HEIC کل تصویر را با رزولوشن کامل decode می‌کند (heic2any امکان کاهش رزولوشن قبل از decode یا
// لغو واقعی ندارد). برای جلوگیری از جهش حافظه، تبدیل‌ها یکی‌یکی انجام می‌شوند (نه هم‌زمان).
let heicQueue: Promise<unknown> = Promise.resolve();

type Heic2any = (opts: { blob: Blob; toType: string; quality: number }) => Promise<Blob | Blob[]>;
const defaultHeicLoader = async (): Promise<Heic2any> => (await import("heic2any")).default as unknown as Heic2any;
let loadHeic2any: () => Promise<Heic2any> = defaultHeicLoader;

/** فقط برای تست: جایگزینی بارگذاری heic2any (در محیط تست دیکودر واقعی وجود ندارد). بدون آرگومان = حالت پیش‌فرض. */
export function __setHeicLoaderForTests(loader?: () => Promise<Heic2any>): void {
  loadHeic2any = loader ?? defaultHeicLoader;
}

export function convertHeicToJpeg(
  file: Blob,
  quality = 0.92
): Promise<HeicConversionResult | HeicConversionFailure> {
  const run = heicQueue.then(() => convertHeicToJpegNow(file, quality));
  heicQueue = run.catch(() => {});
  return run;
}

async function convertHeicToJpegNow(
  file: Blob,
  quality: number
): Promise<HeicConversionResult | HeicConversionFailure> {
  const CONVERSION_TIMEOUT_MS = 25_000;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const conversionPromise = (async () => {
      const heic2any = await loadHeic2any();
      const result = await heic2any({ blob: file, toType: "image/jpeg", quality });
      // heic2any می‌تواند برای فایل‌های چندتصویری (burst) آرایه‌ای از Blob برگرداند؛
      // در آن حالت فقط اولین تصویر برای پیش‌نمایش استفاده می‌شود.
      return Array.isArray(result) ? result[0] : result;
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("زمان تبدیل تصویر HEIC به پایان رسید.")), CONVERSION_TIMEOUT_MS);
    });

    // اگر تایم‌اوت زودتر برنده شد، نتیجهٔ دیرهنگام conversionPromise نباید unhandled rejection شود.
    conversionPromise.catch(() => {});
    const blob = await Promise.race([conversionPromise, timeoutPromise]);
    if (!blob || blob.size === 0) {
      return { ok: false, reason: "تبدیل تصویر خروجی خالی داد." };
    }
    return { ok: true, blob };
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطای نامشخص در تبدیل تصویر HEIC.";
    return { ok: false, reason: message };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
