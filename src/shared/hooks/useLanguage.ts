import { useCallback, useEffect, useState } from "react";
import i18n from "../i18n";
import { PREF_KEYS, getPref, setPref } from "../storage/appPreferences";
import { CurrencyCode, LanguageCode, getLanguageInfo, normalizeLanguage } from "../i18n/languages";

const LANG_STORAGE_KEY = PREF_KEYS.language;
const CURRENCY_STORAGE_KEY = PREF_KEYS.currency;
const CURRENCY_MANUAL_STORAGE_KEY = PREF_KEYS.currencyManual;

function getInitialLanguage(): LanguageCode {
  // زبان ذخیره‌شدهٔ غیرفعال (مثلاً کاربری که قبلاً عربی انتخاب کرده) و مقدار
  // خالی/نامعتبر هر دو به فارسی برمی‌گردند — اپ برای بازار فارسی‌زبان ساخته شده.
  return normalizeLanguage(getPref(LANG_STORAGE_KEY));
}

function getInitialCurrency(language: LanguageCode): CurrencyCode {
  const stored = getPref(CURRENCY_STORAGE_KEY);
  if (stored) return stored as CurrencyCode;
  return getLanguageInfo(language).defaultCurrency;
}

function getIsCurrencyManual(): boolean {
  return getPref(CURRENCY_MANUAL_STORAGE_KEY) === "1";
}

/**
 * هوک مدیریت زبان و واحد پول اپ. با هوک useThemeMode هم‌الگو است: مقدار در
 * Preferences بومی نگه داشته می‌شود و تغییرش بلافاصله روی کل اپ (جهت صفحه،
 * تقویم، فرمت اعداد و واحد پول) اثر می‌گذارد.
 */
export function useLanguage() {
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => getInitialCurrency(language));

  useEffect(() => {
    setPref(LANG_STORAGE_KEY, language);
    const info = getLanguageInfo(language);
    document.documentElement.dir = info.dir;
    document.documentElement.lang = language;
    i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    setPref(CURRENCY_STORAGE_KEY, currency);
  }, [currency]);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    // با تغییر زبان، واحد پول فقط زمانی به‌صورت پیش‌فرض به واحد رایج آن
    // زبان تغییر می‌کند که کاربر قبلاً هیچ‌وقت واحد پول را به‌صورت دستی
    // انتخاب نکرده باشد. اگر کاربر قبلاً از تنظیمات واحد پول را دستی عوض
    // کرده، آن انتخاب باید صرفاً با تغییر زبان از بین نرود.
    if (!getIsCurrencyManual()) {
      setCurrencyState(getLanguageInfo(next).defaultCurrency);
    }
  }, []);

  const setCurrency = useCallback((next: CurrencyCode) => {
    setPref(CURRENCY_MANUAL_STORAGE_KEY, "1");
    setCurrencyState(next);
  }, []);

  const info = getLanguageInfo(language);

  return { language, setLanguage, currency, setCurrency, dir: info.dir, calendar: info.calendar };
}
