import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

/**
 * نسخهٔ فایلیِ کلید رمزنگاری دستگاهی (در Directory.Data، مستقل از دیتابیس).
 *
 * این ماژول عمداً به db وابسته نیست تا هم db.ts (هنگام seed) و هم backupService
 * بتوانند از آن استفاده کنند، بدون import حلقه‌ای.
 *
 * چرا مهم است: بکاپ‌های خودکار با همین کلید رمز شده‌اند. اگر دیتابیس خالی شود
 * (مثلاً خطای مهاجرت یا پاک شدن دادهٔ WebView) و seed به‌جای بازیابی این کلید،
 * یک کلید تازه بسازد و فایل را با آن بازنویسی کند، همهٔ بکاپ‌های قبلی برای
 * همیشه غیرقابل‌رمزگشایی می‌شوند.
 */
export const DEVICE_KEY_FILE_NAME = "device-key.json";

export interface DeviceKeyFilePayload {
  deviceKeyBase64: string;
  createdAt: string;
}

/** نبودِ فایل یا هر خطای دیگر خاموش نادیده گرفته می‌شود (این فقط نسخهٔ پشتیبان است). */
export async function readDeviceKeyFile(): Promise<DeviceKeyFilePayload | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const result = await Filesystem.readFile({
      path: DEVICE_KEY_FILE_NAME,
      directory: Directory.Data,
      encoding: "utf8" as never,
    });
    const text = typeof result.data === "string" ? result.data : await (result.data as Blob).text();
    const parsed = JSON.parse(text) as Partial<DeviceKeyFilePayload>;
    if (parsed && typeof parsed.deviceKeyBase64 === "string" && typeof parsed.createdAt === "string") {
      return parsed as DeviceKeyFilePayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** نوشتن نسخهٔ فایلی؛ خطا نباید مانع کارکرد اصلی شود. */
export async function writeDeviceKeyFile(payload: DeviceKeyFilePayload): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Filesystem.writeFile({
      path: DEVICE_KEY_FILE_NAME,
      directory: Directory.Data,
      data: JSON.stringify(payload),
      encoding: "utf8" as never,
    });
  } catch {
    // لایهٔ افزونهٔ مقاومت است؛ اگر شکست بخورد، دیتابیس همچنان منبع اصلی است.
  }
}
