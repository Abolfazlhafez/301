/**
 * تولید شناسه یکتا. در محیط‌هایی که crypto.randomUUID در دسترس نیست
 * (مثلاً برخی WebView های قدیمی اندروید) از یک fallback ساده استفاده می‌کند.
 */
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// آخرین مقدار میکروثانیه‌ای مصنوعی برگردانده‌شده، برای تضمین این‌که هر
// فراخوانی بعدی همیشه اکیداً بزرگ‌تر باشد.
let lastMonotonicMicros = 0;

/**
 * یک رشتهٔ زمانی برمی‌گرداند که برخلاف new Date().toISOString() ساده،
 * حتی اگر چند بار در همان میلی‌ثانیه صدا زده شود، همیشه رشته‌ای اکیداً
 * بزرگ‌تر (به ترتیب مقایسهٔ رشته‌ای ساده) از فراخوانی قبلی تولید می‌کند.
 *
 * چرا لازم است: createdAt در چند جای برنامه (از جمله تاریخچهٔ محاسبات
 * دستمزد) برای مرتب‌سازی «جدیدترین اول» با مقایسهٔ رشته‌ای ساده استفاده
 * می‌شود. new Date().toISOString() فقط دقت میلی‌ثانیه دارد؛ اگر چند
 * رکورد خیلی سریع پشت‌سرهم (در همان میلی‌ثانیه) ساخته شوند — که روی
 * دستگاه‌های سریع یا در محاسبات دسته‌ای کاملاً ممکن است — ترتیب مرتب‌سازی
 * می‌تواند غیرقطعی/اشتباه شود.
 *
 * راه‌حل: خروجی همچنان یک رشتهٔ ISO 8601 معتبر و قابل‌فهم است (برای نمایش
 * تاریخ/زمان در UI)، اما بخش میلی‌ثانیه با یک شمارندهٔ میکروثانیه‌ایِ
 * مصنوعیِ monotonic (نه زمان واقعی — صرفاً برای تضمین ترتیب) جایگزین
 * می‌شود؛ چون این شمارنده هرگز به عقب برنمی‌گردد، تضمین می‌شود دو
 * فراخوانی پشت‌سرهم همیشه قابل تفکیک و به ترتیب صحیح باشند.
 */
export function monotonicIsoTimestamp(): string {
  const nowMicros = Date.now() * 1000;
  const micros = nowMicros > lastMonotonicMicros ? nowMicros : lastMonotonicMicros + 1;
  lastMonotonicMicros = micros;

  const realMs = Math.floor(micros / 1000);
  const syntheticSubMillis = micros % 1000; // ۰ تا ۹۹۹ — شمارندهٔ مصنوعیِ afزایشی
  const base = new Date(realMs).toISOString(); // مثل 2026-08-27T10:00:00.000Z (میلی‌ثانیهٔ واقعی)
  // بخش سه‌رقمی میلی‌ثانیهٔ استاندارد را با شش رقم (میلی‌ثانیهٔ واقعی سه‌رقمی
  // + سه‌رقم شمارندهٔ مصنوعی) جایگزین می‌کنیم. چون خروجی این تابع همیشه
  // دقیقاً همین طول و همین ساختار را دارد، مقایسهٔ رشته‌ای دو خروجی مختلف
  // این تابع همیشه با ترتیب زمانی واقعی هم‌راستا می‌ماند.
  const standardMillis = base.slice(20, 23); // سه رقم بین "." و "Z"
  return `${base.slice(0, 20)}${standardMillis}${String(syntheticSubMillis).padStart(3, "0")}Z`;
}
