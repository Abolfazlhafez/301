import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * لرزش سبک هپتیک برای اکشن‌های مهم اپ (ذخیره، حذف، چک‌این سریع، سواپ).
 *
 * چرا این پوششِ محافظ لازم است: در نسخهٔ وب/PWA (که در مرورگر توسعه هم
 * استفاده می‌شود) پلاگین Haptics پیاده‌سازی واقعی ندارد و فراخوانی مستقیم آن
 * می‌تواند خطا پرتاب کند؛ Capacitor.isNativePlatform() تشخیص می‌دهد که آیا
 * واقعاً داخل اپ اندروید هستیم یا نه. حتی روی خودِ اندروید هم برخی دستگاه‌ها
 * موتور لرزش را در دسترس نمی‌گذارند، پس خطای احتمالی همیشه بی‌صدا نادیده
 * گرفته می‌شود — هپتیک هرگز نباید یک اکشن واقعی (ذخیره/حذف) را متوقف کند.
 */
async function safeHaptic(fn: () => Promise<void>): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await fn();
  } catch {
    // در دسترس نبودن موتور لرزش روی برخی دستگاه‌ها؛ کاملاً بی‌خطر نادیده گرفته می‌شود.
  }
}

export const haptics = {
  /** لرزش خیلی سبک — برای تعامل‌های مکرر و کم‌اهمیت (مثلاً عبور از آستانهٔ سواپ). */
  light: () => safeHaptic(() => Haptics.impact({ style: ImpactStyle.Light })),
  /** لرزش متوسط — برای اکشن‌های قطعی مثل تأیید حذف یا ثبت سریع. */
  medium: () => safeHaptic(() => Haptics.impact({ style: ImpactStyle.Medium })),
  /** الگوی لرزش «موفقیت» — هم‌زمان با toast سبز موفقیت. */
  success: () => safeHaptic(() => Haptics.notification({ type: NotificationType.Success })),
  /** الگوی لرزش «هشدار/خطا» — هم‌زمان با toast قرمز خطا. */
  warning: () => safeHaptic(() => Haptics.notification({ type: NotificationType.Warning })),
};
