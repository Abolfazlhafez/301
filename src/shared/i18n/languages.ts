/**
 * فهرست زبان‌های پشتیبانی‌شده در اپ، همراه با متادیتای لازم برای هرکدام:
 * جهت نوشتار (راست‌به‌چپ/چپ‌به‌راست)، تقویم (جلالی فقط برای فارسی، بقیه میلادی)،
 * و واحد پول پیش‌فرض آن زبان (که کاربر می‌تواند در تنظیمات آن را عوض کند).
 *
 * این فایل تنها منبع حقیقت (single source of truth) برای افزودن زبان جدید است؛
 * برای اضافه کردن یک زبان تازه کافی است یک ورودی اینجا و پروندهٔ ترجمهٔ
 * متناظرش در locales/<code>/common.json اضافه شود.
 */

export type LanguageCode = "fa" | "en" | "ar" | "tr" | "ur" | "ku" | "ps" | "ru";

export type CurrencyCode = "IRT" | "USD" | "SAR" | "TRY" | "PKR" | "IQD" | "AFN" | "RUB";

export interface CurrencyInfo {
  code: CurrencyCode;
  /** نماد/برچسبی که کنار عدد نمایش داده می‌شود. */
  symbol: string;
  /** آیا نماد قبل از عدد می‌آید یا بعد از آن. */
  position: "prefix" | "suffix";
  /** نام قابل‌نمایش واحد پول، برای فهرست انتخاب در تنظیمات. */
  labelKey: string;
}

export interface LanguageInfo {
  code: LanguageCode;
  /** نام زبان به خط خودش، برای نمایش در فهرست انتخاب زبان. */
  nativeName: string;
  dir: "rtl" | "ltr";
  /** آیا این زبان از تقویم جلالی استفاده می‌کند (فقط فارسی) یا میلادی. */
  calendar: "jalali" | "gregorian";
  defaultCurrency: CurrencyCode;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  IRT: { code: "IRT", symbol: "تومان", position: "suffix", labelKey: "currency.IRT" },
  USD: { code: "USD", symbol: "$", position: "prefix", labelKey: "currency.USD" },
  SAR: { code: "SAR", symbol: "ر.س", position: "suffix", labelKey: "currency.SAR" },
  TRY: { code: "TRY", symbol: "₺", position: "suffix", labelKey: "currency.TRY" },
  PKR: { code: "PKR", symbol: "Rs", position: "prefix", labelKey: "currency.PKR" },
  IQD: { code: "IQD", symbol: "د.ع", position: "suffix", labelKey: "currency.IQD" },
  AFN: { code: "AFN", symbol: "؋", position: "suffix", labelKey: "currency.AFN" },
  RUB: { code: "RUB", symbol: "₽", position: "suffix", labelKey: "currency.RUB" },
};

export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  fa: { code: "fa", nativeName: "فارسی", dir: "rtl", calendar: "jalali", defaultCurrency: "IRT" },
  en: { code: "en", nativeName: "English", dir: "ltr", calendar: "gregorian", defaultCurrency: "USD" },
  ar: { code: "ar", nativeName: "العربية", dir: "rtl", calendar: "gregorian", defaultCurrency: "SAR" },
  tr: { code: "tr", nativeName: "Türkçe", dir: "ltr", calendar: "gregorian", defaultCurrency: "TRY" },
  ur: { code: "ur", nativeName: "اردو", dir: "rtl", calendar: "gregorian", defaultCurrency: "PKR" },
  ku: { code: "ku", nativeName: "کوردی", dir: "rtl", calendar: "gregorian", defaultCurrency: "IQD" },
  ps: { code: "ps", nativeName: "پښتو", dir: "rtl", calendar: "gregorian", defaultCurrency: "AFN" },
  ru: { code: "ru", nativeName: "Русский", dir: "ltr", calendar: "gregorian", defaultCurrency: "RUB" },
};

/**
 * زبان‌های فعال (قابل‌انتخاب و تحت‌پوشش تست). فعلاً فقط فارسی؛ انگلیسی و بقیه
 * (en, ar, tr, ur, ku, ps, ru) موقتاً قفل‌اند: فایل‌های ترجمه و ورودی‌های
 * LANGUAGES سر جایشان هستند، فقط در انتخابگر دیده نمی‌شوند و زبان ذخیره‌شدهٔ
 * غیرفعال (مثلاً en) هنگام شروع به فارسی برمی‌گردد. برای فعال‌کردن دوبارهٔ یک
 * زبان کافی است کدش را به این آرایه اضافه کنید (و کلیدهای عقب‌افتاده‌اش را
 * ترجمه کنید).
 */
export const ENABLED_LANGUAGES: readonly LanguageCode[] = ["fa"];

export function isEnabledLanguage(code: string | null | undefined): code is LanguageCode {
  return !!code && (ENABLED_LANGUAGES as readonly string[]).includes(code);
}

/** زبان ورودی را در صورت فعال‌بودن برمی‌گرداند، وگرنه فارسی (پیش‌فرض اپ). */
export function normalizeLanguage(code: string | null | undefined): LanguageCode {
  return isEnabledLanguage(code) ? code : "fa";
}

export const LANGUAGE_LIST: LanguageInfo[] = ENABLED_LANGUAGES.map((code) => LANGUAGES[code]);

export function getLanguageInfo(code: string): LanguageInfo {
  return LANGUAGES[code as LanguageCode] ?? LANGUAGES.fa;
}

export function getCurrencyInfo(code: string): CurrencyInfo {
  return CURRENCIES[code as CurrencyCode] ?? CURRENCIES.IRT;
}
