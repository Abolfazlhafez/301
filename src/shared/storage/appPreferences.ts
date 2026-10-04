import { Preferences } from "@capacitor/preferences";

/**
 * تنظیمات سبک برنامه (تم، زبان، واحد پول، آخرین روز گزارش کار) در
 * @capacitor/preferences (SharedPreferences بومی) نگه داشته می‌شود، نه
 * localStorage وابسته به WebView.
 *
 * چون Preferences async است ولی اولین رندر باید مقدار درست را داشته باشد،
 * `bootstrapAppPreferences()` پیش از mount شدن App (در main.tsx) همهٔ کلیدها را
 * یک‌جا در یک cache حافظه‌ای می‌خواند و بعد از آن `getPref` کاملاً همگام است.
 *
 * مهاجرت از localStorage: اگر کلیدی فقط در localStorage باشد، به Preferences
 * کپی می‌شود و فقط بعد از «خواندن و تطبیق» مقدار نوشته‌شده، از localStorage حذف
 * می‌شود. اگر Preferences در دسترس نباشد، همان مقدار localStorage استفاده می‌شود
 * و چیزی پاک نمی‌شود.
 */
export const PREF_KEYS = {
  themeMode: "karegah-yar-theme-mode",
  language: "karegah-yar-language",
  currency: "karegah-yar-currency",
  currencyManual: "karegah-yar-currency-manual",
  workLogLastDate: "karegah-yar-work-log-last-date",
} as const;

const ALL_KEYS: string[] = Object.values(PREF_KEYS);
/** اگر Preferences دیرتر از این پاسخ بدهد، با مقدارهای localStorage شروع می‌کنیم. */
export const BOOTSTRAP_TIMEOUT_MS = 2500;

const cache = new Map<string, string>();
let bootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function readLegacy(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLegacy(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    // ذخیرهٔ تنظیمات یک راحتی جانبی است؛ شکست آن مسیر اصلی را متوقف نمی‌کند.
  }
}

function removeLegacy(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    // نادیده گرفته می‌شود.
  }
}

async function loadKey(key: string): Promise<void> {
  let prefsOk = true;
  let stored: string | null = null;
  try {
    stored = (await Preferences.get({ key })).value ?? null;
  } catch {
    prefsOk = false;
  }
  if (stored !== null) {
    cache.set(key, stored);
    return;
  }
  const legacy = readLegacy(key);
  if (legacy === null) return;
  cache.set(key, legacy);
  if (!prefsOk) return;
  try {
    await Preferences.set({ key, value: legacy });
    const back = await Preferences.get({ key });
    if (back.value === legacy) removeLegacy(key);
  } catch {
    // مهاجرت ناقص ماند؛ localStorage دست‌نخورده می‌ماند و دفعهٔ بعد دوباره تلاش می‌شود.
  }
}

/** هرگز reject نمی‌شود. باید پیش از رندر اول (و پیش از import شدن i18n/App) await شود. */
export function bootstrapAppPreferences(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  // مقدار اولیه از localStorage تا در صورت timeout هم اولین رندر مقدار منطقی داشته باشد.
  for (const key of ALL_KEYS) {
    const legacy = readLegacy(key);
    if (legacy !== null) cache.set(key, legacy);
  }
  const load = Promise.all(ALL_KEYS.map(loadKey)).then(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, BOOTSTRAP_TIMEOUT_MS);
  });
  bootstrapPromise = Promise.race([load, timeout]).then(() => {
    clearTimeout(timer);
    bootstrapped = true;
  });
  return bootstrapPromise;
}

/** خواندن همگام. قبل از bootstrap به localStorage برمی‌گردد (برای تست‌ها و ابزارها). */
export function getPref(key: string): string | null {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  return bootstrapped ? null : readLegacy(key);
}

/** نوشتن: cache همان لحظه به‌روز می‌شود و نوشتن بومی به‌ترتیب و در پس‌زمینه انجام می‌شود. */
export function setPref(key: string, value: string): void {
  if (cache.get(key) === value) return;
  cache.set(key, value);
  writeChain = writeChain
    .then(() => Preferences.set({ key, value }))
    .catch(() => writeLegacy(key, value));
}

/** برای تست: منتظر پایان نوشتن‌های در صف می‌ماند. */
export function flushPrefWrites(): Promise<void> {
  return writeChain;
}

/** فقط برای تست. */
export function __resetAppPreferencesForTest(): void {
  cache.clear();
  bootstrapped = false;
  bootstrapPromise = null;
  writeChain = Promise.resolve();
}
