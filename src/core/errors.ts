/**
 * خطاهای دامین — معادل کلاس‌های خطای بک‌اند، برای حفظ همان پیام‌های خطای فارسی
 * که قبلاً در رابط کاربری نمایش داده می‌شدند.
 */

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * خطای اختصاصی برای زمانی که حذف یک رکورد به‌خاطر وجود داده‌های وابسته
 * (مثلاً سابقه حضور/دفتر حساب یک نیرو) مجاز نیست. رابط کاربری با تشخیص
 * این نوع خطا (instanceof) می‌تواند به‌جای صرفاً نمایش خطا، گزینه‌ی جایگزین
 * (مثلاً «غیرفعال کردن») را پیشنهاد دهد.
 */
export class HasDependenciesError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "HasDependenciesError";
  }
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "خطای ناشناخته‌ای رخ داد.";
}
