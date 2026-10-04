/**
 * ساخت پیش‌نمایش کم‌حجم از یک عکس.
 *
 * چرا؟ decode یک عکس ۱۲ مگاپیکسلی حدود ۴۸ مگابایت RAM می‌خواهد؛ گریدی با ۵۰ عکس
 * می‌تواند WebView را بکشد. پیش‌نمایش ≈۳۲۰px فقط حدود نیم مگابایت RAM می‌خواهد و
 * حجم فایلش چند ده کیلوبایت است. عکس اصلی فقط وقتی کاربر روی عکس بزند باز می‌شود.
 *
 * ساخت پیش‌نمایش «تک‌مرحله‌ای و با decode کوچک‌شده» انجام می‌شود
 * (createImageBitmap با resizeWidth) و bitmap بلافاصله آزاد می‌شود.
 */

/** ضلع بلند پیش‌نمایش (پیکسل). برای گرید ۳ستونه روی گوشی‌های ۳x کافی است. */
export const THUMB_WIDTH = 320;
/** سقف ارتفاع برای عکس‌های خیلی بلند (پانوراما/اسکرین‌شات) تا حجم decode محدود بماند. */
export const THUMB_MAX_HEIGHT = 640;
export const THUMB_QUALITY = 0.6;

export type ThumbnailEncoder = (source: Blob) => Promise<Blob | null>;

interface Decoded {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  release: () => void;
}

/** اندازهٔ خروجی با حفظ نسبت تصویر و بدون بزرگ‌کردن عکس‌های کوچک. */
export function computeThumbSize(srcW: number, srcH: number): { width: number; height: number } {
  if (!(srcW > 0) || !(srcH > 0)) return { width: 0, height: 0 };
  let scale = Math.min(1, THUMB_WIDTH / srcW);
  if (srcH * scale > THUMB_MAX_HEIGHT) scale = THUMB_MAX_HEIGHT / srcH;
  return { width: Math.max(1, Math.round(srcW * scale)), height: Math.max(1, Math.round(srcH * scale)) };
}

async function decodeWithBitmap(source: Blob): Promise<Decoded | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    // فقط عرض داده می‌شود تا ارتفاع با حفظ نسبت محاسبه شود؛ decode در اندازهٔ کوچک انجام می‌شود.
    const bmp = await createImageBitmap(source, {
      resizeWidth: THUMB_WIDTH,
      resizeQuality: "medium",
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
    return {
      width: bmp.width,
      height: bmp.height,
      draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
      release: () => bmp.close(),
    };
  } catch {
    return null;
  }
}

async function decodeWithImageElement(source: Blob): Promise<Decoded | null> {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      release: () => {
        img.onload = null;
        img.onerror = null;
        img.removeAttribute("src");
        URL.revokeObjectURL(url);
      },
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}

/**
 * پیش‌نمایش را می‌سازد؛ در صورت هر خطا (محیط بدون canvas، فایل خراب، حافظهٔ کم) null برمی‌گرداند
 * و هرگز exception نمی‌اندازد — عکس اصلی در هر حالت دست‌نخورده می‌ماند.
 */
export const createThumbnailBlob: ThumbnailEncoder = async (source) => {
  if (typeof document === "undefined") return null;
  const decoded = (await decodeWithBitmap(source)) ?? (await decodeWithImageElement(source));
  if (!decoded) return null;
  try {
    const { width, height } = computeThumbSize(decoded.width, decoded.height);
    if (!width || !height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    decoded.draw(ctx, width, height);
    // WebP کوچک‌تر است؛ اگر مرورگر نتواند، خودکار PNG برمی‌گرداند که رد می‌کنیم و JPEG می‌خواهیم.
    let blob = await canvasToBlob(canvas, "image/webp", THUMB_QUALITY);
    if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", THUMB_QUALITY);
    // آزادسازی فوری حافظهٔ canvas
    canvas.width = 0;
    canvas.height = 0;
    return blob && blob.size > 0 ? blob : null;
  } catch {
    return null;
  } finally {
    decoded.release();
  }
};

let activeEncoder: ThumbnailEncoder = createThumbnailBlob;

/** نقطهٔ ورود واحد برای ساخت پیش‌نمایش (قابل جایگزینی در تست‌ها چون Node canvas ندارد). */
export function encodeThumbnail(source: Blob): Promise<Blob | null> {
  return activeEncoder(source);
}

/** فقط برای تست. null → بازگشت به موتور واقعی. */
export function setThumbnailEncoderForTests(fn: ThumbnailEncoder | null): void {
  activeEncoder = fn ?? createThumbnailBlob;
}
