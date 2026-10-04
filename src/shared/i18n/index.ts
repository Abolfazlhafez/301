import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import fa from "./locales/fa/common.json";
import en from "./locales/en/common.json";
import ar from "./locales/ar/common.json";
import tr from "./locales/tr/common.json";
import ur from "./locales/ur/common.json";
import ku from "./locales/ku/common.json";
import ps from "./locales/ps/common.json";
import ru from "./locales/ru/common.json";
import { PREF_KEYS, getPref } from "../storage/appPreferences";
import { normalizeLanguage } from "./languages";

const STORAGE_KEY = PREF_KEYS.language;

function getStoredLanguage(): string {
  try {
    return normalizeLanguage(getPref(STORAGE_KEY));
  } catch {
    return "fa";
  }
}

// مقداردهی اولیه i18next با هر ۸ زبان از همان ابتدای بارگذاری اپ (نه به‌صورت
// lazy)، چون این پرونده‌ها بسیار کوچک‌اند و نیازی به بارگذاری غیرهمزمان
// جداگانه برای هرکدام نیست — این‌طوری هیچ‌وقت قبل از رندر اول صفحه، یک
// حالت «بدون ترجمه بارگذاری‌شده» دیده نمی‌شود.
i18n.use(initReactI18next).init({
  resources: {
    fa: { common: fa },
    en: { common: en },
    ar: { common: ar },
    tr: { common: tr },
    ur: { common: ur },
    ku: { common: ku },
    ps: { common: ps },
    ru: { common: ru },
  },
  lng: getStoredLanguage(),
  fallbackLng: "fa",
  defaultNS: "common",
  ns: ["common"],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
