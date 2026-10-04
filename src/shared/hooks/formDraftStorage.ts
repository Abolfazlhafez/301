import { Preferences } from "@capacitor/preferences";

const DRAFT_KEY_PREFIX = "form-draft:";
// پیش‌نویس‌های قدیمی‌تر از این مدت، در هنگام خواندن نادیده گرفته و پاک
// می‌شوند — یک پیش‌نویس چند روز/هفته‌ای دیگر احتمالاً به‌دردنخور و
// گیج‌کننده است تا مفید.
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // ۲۴ ساعت

export interface StoredDraft<T> {
  savedAt: string;
  data: T;
}

/**
 * ذخیرهٔ یک پیش‌نویس در Storage دائمی Native (@capacitor/preferences —
 * روی اندروید از SharedPreferences بومی استفاده می‌کند، نه localStorage
 * وابسته به WebView). خطاها بی‌صدا نادیده گرفته می‌شوند چون این یک
 * قابلیت کمکی است، نه بخشی حیاتی از مسیر اجرای برنامه.
 */
export async function saveDraft<T>(draftKey: string, data: T): Promise<void> {
  const stored: StoredDraft<T> = { savedAt: new Date().toISOString(), data };
  await Preferences.set({ key: DRAFT_KEY_PREFIX + draftKey, value: JSON.stringify(stored) }).catch(() => {});
}

/**
 * خواندن یک پیش‌نویس ذخیره‌شده. اگر پیش‌نویس وجود نداشته باشد، خراب باشد،
 * یا از DRAFT_MAX_AGE_MS قدیمی‌تر باشد، null برمی‌گرداند — و در حالت
 * اخیر، پیش‌نویس منقضی‌شده را هم از Storage پاک می‌کند تا برای همیشه
 * روی دستگاه باقی نماند.
 */
export async function loadDraft<T>(draftKey: string): Promise<T | null> {
  const result = await Preferences.get({ key: DRAFT_KEY_PREFIX + draftKey }).catch(() => null);
  if (!result?.value) return null;
  try {
    const parsed = JSON.parse(result.value) as StoredDraft<T>;
    const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
    if (ageMs > DRAFT_MAX_AGE_MS) {
      await clearDraft(draftKey);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

/** پاک کردن یک پیش‌نویس ذخیره‌شده — معمولاً بعد از ثبت موفق فرم یا رد صریح پیشنهاد بازیابی. */
export async function clearDraft(draftKey: string): Promise<void> {
  await Preferences.remove({ key: DRAFT_KEY_PREFIX + draftKey }).catch(() => {});
}
