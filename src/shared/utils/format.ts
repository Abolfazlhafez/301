import i18n from "../i18n";
import { PREF_KEYS, getPref } from "../storage/appPreferences";
import { CurrencyCode, getCurrencyInfo, getLanguageInfo } from "../i18n/languages";

/**
 * تبدیل عدد به رشته فارسی با جداکننده هزارگان.
 * (نگه‌داشته‌شده برای سازگاری با کدهای موجود که مستقیماً فرمت فارسی
 * می‌خواهند؛ برای فرمت وابسته به زبان فعلی از formatNumber استفاده کنید.)
 */
export function formatNumberFa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

/**
 * فرمت مبلغ به تومان با پسوند "تومان".
 * (نگه‌داشته‌شده برای سازگاری با کدهای موجود؛ برای فرمت وابسته به واحد پول
 * انتخابی کاربر از formatCurrency استفاده کنید.)
 */
export function formatCurrencyFa(value: number): string {
  return `${formatNumberFa(value)} تومان`;
}

/** نگاشت زبان اپ به locale مناسب برای Intl.NumberFormat. */
const NUMBER_FORMAT_LOCALE: Record<string, string> = {
  fa: "fa-IR",
  en: "en-US",
  ar: "ar-SA",
  tr: "tr-TR",
  ur: "ur-PK",
  ku: "en-US", // بدون locale اختصاصی پایدار در Intl؛ ارقام لاتین با جداکنندهٔ هزارگان استاندارد
  ps: "en-US", // مشابه بالا؛ برای پشتو هم ارقام لاتین استفاده می‌شود
  ru: "ru-RU",
};

/**
 * تبدیل عدد به رشته با جداکنندهٔ هزارگان، مطابق زبان فعلی برنامه (یا زبان
 * داده‌شده). برخلاف formatNumberFa که همیشه فارسی است، این تابع برای هر ۸
 * زبان پشتیبانی‌شده کار می‌کند.
 */
export function formatNumber(value: number, lang?: string): string {
  const language = lang ?? i18n.language ?? "fa";
  const locale = NUMBER_FORMAT_LOCALE[language] ?? "en-US";
  return new Intl.NumberFormat(locale).format(Math.round(value));
}

const CURRENCY_STORAGE_KEY = PREF_KEYS.currency;

/**
 * واحد پولی که کاربر واقعاً برایش انتخاب کرده (چه دستی، چه پیش‌فرض زبان)،
 * مستقیماً از همان کلید Preferences که useLanguage در آن ذخیره می‌کند.
 * چون format.ts یک ماژول سادهٔ غیر-React است (نه هوک)، نمی‌تواند state
 * کامپوننت useLanguage را بخواند؛ همین کلید مشترک تنها راه
 * است که این دو همیشه هماهنگ بمانند.
 */
function getStoredCurrency(language: string): CurrencyCode {
  try {
    const stored = getPref(CURRENCY_STORAGE_KEY);
    if (stored) return stored as CurrencyCode;
  } catch {
    // ذخیره‌سازی در دسترس نیست؛ به پیش‌فرض زبان برمی‌گردیم.
  }
  return getLanguageInfo(language).defaultCurrency;
}

/**
 * فرمت مبلغ همراه با نماد واحد پول، مطابق زبان/واحد پول فعلی برنامه.
 * واحد پول را می‌توان صراحتاً داد (مثلاً وقتی کاربر در تنظیمات واحد پول
 * دیگری غیر از پیش‌فرض زبان انتخاب کرده)، وگرنه از همان واحد پول
 * ذخیره‌شدهٔ کاربر (نه صرفاً پیش‌فرض زبان) استفاده می‌شود — قبلاً این تابع
 * وقتی currency داده نمی‌شد همیشه پیش‌فرض زبان را برمی‌گرداند، حتی اگر
 * کاربر قبلاً دستی واحد پول دیگری انتخاب کرده بود.
 */

/** فرمت درصد مطابق زبان فعلی برنامه و بدون Hard-code کردن نماد درصد. */
export function formatPercent(value: number, lang?: string): string {
  const language = lang ?? i18n.language ?? "fa";
  const locale = NUMBER_FORMAT_LOCALE[language] ?? "en-US";
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(Math.max(0, Math.min(100, value)) / 100);
}


/** فرمت متراژ همراه با واحد سطح، مطابق زبان فعلی برنامه. */
export function formatArea(value: number, lang?: string): string {
  const language = lang ?? i18n.language ?? "fa";
  const unit = language === "fa" ? "متر مربع" : language === "ar" ? "م²" : language === "tr" ? "m²" : language === "ru" ? "м²" : "m²";
  const formatted = new Intl.NumberFormat(NUMBER_FORMAT_LOCALE[language] ?? "en-US", { maximumFractionDigits: 2 }).format(value);
  return `${formatted} ${unit}`;
}

export function formatCurrency(value: number, currency?: CurrencyCode, lang?: string): string {
  const language = lang ?? i18n.language ?? "fa";
  const currencyCode = currency ?? getStoredCurrency(language);
  const info = getCurrencyInfo(currencyCode);
  const number = formatNumber(value, language);
  return info.position === "prefix" ? `${info.symbol} ${number}` : `${number} ${info.symbol}`;
}

/** واحدهای «ساعت»/«دقیقه»/«و» برای هر ۸ زبان، مخصوص formatMinutesToText. */
const DURATION_UNITS: Record<string, { hour: string; minute: string; and: string }> = {
  fa: { hour: "ساعت", minute: "دقیقه", and: "و" },
  en: { hour: "h", minute: "m", and: "" },
  ar: { hour: "ساعة", minute: "دقيقة", and: "و" },
  tr: { hour: "sa", minute: "dk", and: "" },
  ur: { hour: "گھنٹے", minute: "منٹ", and: "اور" },
  ku: { hour: "کاتژمێر", minute: "خولەک", and: "و" },
  ps: { hour: "ساعتونه", minute: "دقیقې", and: "او" },
  ru: { hour: "ч", minute: "мин", and: "" },
};

/**
 * تبدیل دقیقه به رشته خوانا "X ساعت و Y دقیقه"، مطابق زبان فعلی برنامه
 * (یا زبان داده‌شده). ارقام و واحدها هر دو بر اساس زبان تنظیم می‌شوند.
 */
export function formatMinutesToText(minutes: number, lang?: string): string {
  const language = lang ?? i18n.language ?? "fa";
  const units = DURATION_UNITS[language] ?? DURATION_UNITS.en;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const sep = units.and ? ` ${units.and} ` : " ";
  if (h === 0 && m === 0) return `${formatNumber(0, language)} ${units.minute}`;
  if (h === 0) return `${formatNumber(m, language)} ${units.minute}`;
  if (m === 0) return `${formatNumber(h, language)} ${units.hour}`;
  return `${formatNumber(h, language)} ${units.hour}${sep}${formatNumber(m, language)} ${units.minute}`;
}

/**
 * تبدیل ارقام انگلیسی رشته به ارقام فارسی (برای نمایش).
 */
export function toPersianDigits(input: string | number): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/[0-9]/g, (d) => persianDigits[Number(d)]);
}

const PERSIAN_DIGIT_MAP: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};
const ARABIC_INDIC_DIGIT_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

/**
 * تبدیل ارقام فارسی (۰-۹) و عربی (٠-٩) موجود در یک رشته به ارقام انگلیسی معمولی.
 * برای این‌که کاربر بتواند هرجا عدد وارد می‌کند (حقوق، نرخ، ساعت و ...) با
 * صفحه‌کلید فارسی هم تایپ کند، این تابع باید همیشه پیش از هر پردازش دیگری
 * روی ورودی خام فیلدهای عددی اجرا شود.
 */
export function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => PERSIAN_DIGIT_MAP[d] ?? ARABIC_INDIC_DIGIT_MAP[d] ?? d);
}

/**
 * تطبیق عبارت جستجو با یک متن، بدون حساسیت به حروف و بدون حساسیت به نوع رقم
 * (فارسی/عربی/انگلیسی). اگر عبارت خالی باشد (بعد از trim) همیشه true است.
 * فقط برای فیلتر نمایشی فهرست‌ها؛ هیچ داده‌ای را تغییر نمی‌دهد.
 */
export function matchesSearchTerm(haystack: string, rawTerm: string): boolean {
  const term = normalizeDigits(rawTerm.trim().toLowerCase());
  if (!term) return true;
  return normalizeDigits(haystack.toLowerCase()).includes(term);
}

/**
 * استخراج فقط رقم‌های یک رشته (پس از تبدیل ارقام فارسی/عربی به انگلیسی)؛
 * مناسب برای onChange فیلدهای عددی مثل حقوق و نرخ.
 */
export function toPlainDigitsOnly(input: string): string {
  return normalizeDigits(input).replace(/[^\d]/g, "");
}
