import { Preferences } from "@capacitor/preferences";

const RECENT_SEARCHES_KEY = "recent-global-searches";
export const MAX_RECENT_SEARCHES = 5;

/**
 * تاریخچهٔ چند عبارت جستجوی اخیر در جستجوی سراسری، برای این‌که کاربر با
 * یک لمس دوباره به همان جستجو برگردد. مثل formDraftStorage.ts، از
 * @capacitor/preferences استفاده می‌شود (نه localStorage وابسته به
 * WebView) تا روی اندروید از SharedPreferences بومی ذخیره شود. خطاها
 * بی‌صدا نادیده گرفته می‌شوند چون این فقط یک راحتی جانبی است، نه بخشی
 * حیاتی از مسیر اجرای برنامه.
 */
export async function loadRecentSearches(): Promise<string[]> {
  const result = await Preferences.get({ key: RECENT_SEARCHES_KEY }).catch(() => null);
  if (!result?.value) return [];
  try {
    const parsed = JSON.parse(result.value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q): q is string => typeof q === "string");
  } catch {
    return [];
  }
}

/**
 * یک عبارت جستجو را به بالای تاریخچه اضافه می‌کند (با حذف تکراری‌های
 * قبلی همان عبارت) و فهرست را به MAX_RECENT_SEARCHES مورد محدود می‌کند.
 * رشتهٔ خالی/فقط‌فاصله ذخیره نمی‌شود.
 */
export async function addRecentSearch(query: string): Promise<string[]> {
  const trimmed = query.trim();
  const current = await loadRecentSearches();
  if (!trimmed) return current;
  const updated = [trimmed, ...current.filter((q) => q !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
  await Preferences.set({ key: RECENT_SEARCHES_KEY, value: JSON.stringify(updated) }).catch(() => {});
  return updated;
}

/** پاک کردن کامل تاریخچهٔ جستجوهای اخیر — از طریق دکمهٔ «پاک کردن» در همان بخش. */
export async function clearRecentSearches(): Promise<void> {
  await Preferences.remove({ key: RECENT_SEARCHES_KEY }).catch(() => {});
}
