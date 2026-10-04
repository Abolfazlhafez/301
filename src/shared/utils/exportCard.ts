import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { sanitizeFilename } from "./sanitizeFilename";

/**
 * ذخیرهٔ مستقیم یک فایل در حافظهٔ *قابل‌دسترسِ* گوشی (نه فقط از طریق منوی
 * اشتراک‌گذاری). چرا این جدا از exportElementAsShareableImage/exportRowsAsCsv
 * لازم بود: آن دو تابع فایل را در Directory.Cache (پوشهٔ موقت/داخلی اپ، غیر
 * قابل مشاهده با فایل‌منیجر گوشی) می‌نویسند و سپس Share.share را باز
 * می‌کنند — یعنی «ذخیره در گوشی» فقط اگر کاربر از داخل شیت اشتراک‌گذاری
 * سیستم دقیقاً گزینهٔ درست (مثلاً «ذخیره در فایل‌ها»/«Save to Files») را
 * پیدا و انتخاب کند ممکن بود، که روی خیلی از گوشی‌ها اصلاً چنین گزینه‌ای
 * نیست یا واضح نیست. این تابع به‌جای آن مستقیماً در Directory.Documents
 * (پوشهٔ اسناد عمومی، با فایل‌منیجر قابل مشاهده) می‌نویسد — یک اقدام
 * قطعی و بدون نیاز به گام میانی.
 */
export async function saveBlobToDeviceStorage(blob: Blob, filename: string): Promise<void> {
  const safeFilename = sanitizeFilename(filename);

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: safeFilename,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
    return;
  }

  // مرورگر معمولی: «ذخیره در گوشی» و «اشتراک‌گذاری» عملاً یک عمل یکسانند
  // (هر دو یعنی دانلود فایل)، پس همان مسیر دانلود مستقیم استفاده می‌شود.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * از یک عنصر DOM یک عکس (PNG) می‌سازد و آن را برای اشتراک‌گذاری یا دانلود آماده می‌کند.
 * روی اپلیکیشن نصب‌شده (Capacitor/Android) از منوی اشتراک‌گذاری بومی سیستم استفاده‌
 * می‌کند؛ در مرورگر معمولی، فایل مستقیم دانلود می‌شود.
 *
 * چرا html-to-image به‌جای html2canvas: html2canvas موتور متنِ خودش را دارد
 * (متن را دوباره با canvas می‌کِشد، نه با موتور رندر خودِ مرورگر)، و این
 * موتور برای زبان‌های راست‌به‌چپِ با حروف چسبان مثل فارسی/عربی به‌درستی کار
 * نمی‌کند — نتیجه‌اش این بود که در خروجی نهایی (عکس گزارش کار) حروف از هم
 * جدا و به‌هم‌ریخته دیده می‌شدند، هرچند پیش‌نمایش زندهٔ داخل مرورگر کاملاً
 * سالم بود (چون آن‌جا مرورگر خودش متن را می‌چیند). html-to-image به‌جای
 * بازسازی متن، عنصر را داخل یک SVG با foreignObject سریالایز می‌کند و از
 * موتور رندر خودِ مرورگر (همان چیزی که پیش‌نمایش را درست نشان می‌داد)
 * برای رسم استفاده می‌کند — بنابراین شکل‌گیری حروف فارسی هم درست می‌ماند.
 *
 * import پویا همچنان برای جلوگیری از افزایش حجم بارگذاری اولیهٔ صفحه است.
 *
 * نکتهٔ مهم دربارهٔ تم روشن/تاریک: پیش از این، پس‌زمینهٔ خروجی همیشه سفید
 * (#ffffff) بود، فارغ از تم فعلی برنامه — یعنی در حالت شب، متن روشن روی
 * زمینهٔ خودِ صفحه به‌درستی دیده می‌شد ولی همان عنصر وقتی روی زمینهٔ سفید
 * عکس گرفته می‌شد یا نامرئی/کم‌کنتراست بود یا رنگ زمینهٔ خروجی با ظاهر
 * واقعی صفحه اصلاً هم‌خوانی نداشت. برای رفع این مشکل، پس‌زمینهٔ خروجی از
 * روی رنگ واقعیِ محاسبه‌شدهٔ (computed style) خودِ عنصر یا نزدیک‌ترین
 * والد غیرشفاف آن خوانده می‌شود — یعنی همان رنگی که تم MUI همین الان
 * روی صفحه اعمال کرده — مگر این‌که صراحتاً یک رنگ دیگر با پارامتر
 * backgroundColor مشخص شده باشد.
 */
export async function exportElementAsShareableImage(
  element: HTMLElement,
  filename: string,
  shareTitle: string,
  options?: { backgroundColor?: string }
): Promise<void> {
  const blob = await renderElementToImageBlob(element, options);
  const safeFilename = sanitizeFilename(filename);

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    const result = await Filesystem.writeFile({
      path: safeFilename,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: shareTitle,
      files: [result.uri],
    });
    return;
  }

  // مرورگر معمولی (بدون Capacitor): دانلود مستقیم فایل
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** منطق مشترک رندر یک عنصر DOM به Blob تصویر — بین حالت اشتراک‌گذاری و حالت ذخیرهٔ مستقیم یکسان است. */
async function renderElementToImageBlob(
  element: HTMLElement,
  options?: { backgroundColor?: string }
): Promise<Blob> {
  const { toBlob } = await import("html-to-image");

  const resolvedBackground = options?.backgroundColor ?? resolveElementBackgroundColor(element);

  const blob = await toBlob(element, {
    backgroundColor: resolvedBackground,
    pixelRatio: 2,
    skipFonts: true,
  });

  if (!blob) {
    throw new Error("تولید تصویر ناموفق بود.");
  }
  return blob;
}

/**
 * از یک عنصر DOM یک عکس (PNG) می‌سازد و آن را مستقیماً در حافظهٔ
 * قابل‌دسترسِ گوشی ذخیره می‌کند (بدون بازکردن منوی اشتراک‌گذاری) — نگاه
 * کنید به توضیح `saveBlobToDeviceStorage` بالا برای دلیل وجود این مسیر جدا.
 */
export async function saveElementAsImageToDevice(
  element: HTMLElement,
  filename: string,
  options?: { backgroundColor?: string }
): Promise<void> {
  const blob = await renderElementToImageBlob(element, options);
  await saveBlobToDeviceStorage(blob, filename);
}

/**
 * رنگ پس‌زمینهٔ واقعیِ رندرشدهٔ یک عنصر را برمی‌گرداند — یعنی چیزی که چشم
 * کاربر همین الان روی صفحه می‌بیند، نه یک مقدار ثابت حدسی. چون خیلی از
 * Boxهای MUI به‌طور پیش‌فرض شفاف هستند (background rgba(0,0,0,0) یا
 * "transparent") و پس‌زمینهٔ واقعی از یک والد بالاتر (مثلاً خودِ Card یا
 * پس‌زمینهٔ کلی صفحه) می‌آید، از خودِ عنصر شروع کرده و در صورت شفاف بودن
 * تا ۶ سطح به سمت والدها بالا می‌رود؛ اگر هیچ‌کدام رنگی نداشتند، به رنگ
 * پس‌زمینهٔ کلی <body> (که خودِ تم آن‌جا تنظیم کرده) بازمی‌گردد.
 */
function resolveElementBackgroundColor(element: HTMLElement): string {
  let current: HTMLElement | null = element;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    const bg = window.getComputedStyle(current).backgroundColor;
    if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
      return bg;
    }
    current = current.parentElement;
  }
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  return bodyBg && bodyBg !== "transparent" && bodyBg !== "rgba(0, 0, 0, 0)" ? bodyBg : "#ffffff";
}

/**
 * اشتراک‌گذاری یک Blob از پیش موجود (مثلاً یک عکس ذخیره‌شده) از طریق منوی
 * اشتراک‌گذاری بومی سیستم. برخلاف exportElementAsShareableImage، اینجا
 * چیزی رندر نمی‌شود — Blob همان چیزی است که از قبل در IndexedDB ذخیره شده
 * (مثلاً یک عکس سایت). روی مرورگر معمولی، مثل بقیهٔ توابع این فایل، به
 * دانلود مستقیم برمی‌گردد چون Web Share API برای فایل در همه‌جا پشتیبانی نمی‌شود.
 */
export async function shareExistingBlob(blob: Blob, filename: string, shareTitle: string): Promise<void> {
  const safeFilename = sanitizeFilename(filename);

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    const result = await Filesystem.writeFile({
      path: safeFilename,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: shareTitle,
      files: [result.uri],
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
