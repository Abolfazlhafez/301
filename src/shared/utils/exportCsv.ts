import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { sanitizeFilename } from "./sanitizeFilename";
import { saveBlobToDeviceStorage } from "./exportCard";

/**
 * یک مقدار را برای قرارگرفتن ایمن در یک سلول CSV آماده می‌کند (کوتیشن و
 * escape در صورت نیاز). export شده تا مستقیماً و بدون نیاز به پلتفرم
 * (Filesystem/Share/document) قابل تست باشد — این دقیقاً همان بخشی از
 * فایل است که واقعاً منطق (نه صرفاً فراخوانی API) دارد.
 */
export function csvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * محتوای کامل متنی یک فایل CSV (شامل BOM برای سازگاری با اکسل) را از
 * هدرها و ردیف‌ها می‌سازد — بدون هیچ کاری روی فایل‌سیستم. جدا شده از
 * exportRowsAsCsv تا منطق ساخت متن مستقل از پلتفرم (که در Node هم قابل
 * تست است) از بخش نوشتن/اشتراک‌گذاری فایل (که فقط در مرورگر/WebView
 * واقعی معنا دارد) تفکیک شود.
 */
export function buildCsvContent(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return "\uFEFF" + lines.join("\r\n");
}

/**
 * از یک آرایه از ردیف‌ها یک فایل CSV سازگار با اکسل می‌سازد و آن را
 * اشتراک‌گذاری/دانلود می‌کند. از همان الگوی موجود در بقیهٔ خروجی‌های اپ
 * (exportCard.ts) پیروی می‌کند: روی اندروید از منوی اشتراک‌گذاری بومی
 * استفاده می‌شود، در مرورگر معمولی فایل مستقیم دانلود می‌شود.
 *
 * نکته: یک BOM در ابتدای فایل اضافه می‌شود تا اکسل (به‌خصوص نسخهٔ ویندوزی)
 * متن فارسی/UTF-8 را درست تشخیص دهد و به‌جای حروف بی‌معنی نشان دهد.
 */
export async function exportRowsAsCsv(headers: string[], rows: (string | number)[][], filename: string): Promise<void> {
  const safeFilename = sanitizeFilename(filename);
  const csvContent = buildCsvContent(headers, rows);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    const result = await Filesystem.writeFile({
      path: safeFilename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, files: [result.uri] });
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

/**
 * از یک آرایه از ردیف‌ها یک فایل CSV می‌سازد و آن را مستقیماً در حافظهٔ
 * قابل‌دسترسِ گوشی ذخیره می‌کند (بدون بازکردن منوی اشتراک‌گذاری) — نگاه
 * کنید به توضیح `saveBlobToDeviceStorage` در exportCard.ts برای دلیل وجود
 * این مسیر جدا از exportRowsAsCsv.
 */
export async function saveRowsAsCsvToDevice(
  headers: string[],
  rows: (string | number)[][],
  filename: string
): Promise<void> {
  const csvContent = buildCsvContent(headers, rows);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  await saveBlobToDeviceStorage(blob, filename);
}
