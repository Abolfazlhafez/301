import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";

/**
 * cache مخصوص Emotion برای پشتیبانی از RTL در MUI.
 * این cache باعث می‌شود تمام استایل‌های تولیدشده توسط MUI به‌صورت خودکار
 * برای چیدمان راست‌به‌چپ (فارسی، عربی، اردو، کردی، پشتو) معکوس شوند.
 */
export const rtlCache = createCache({
  key: "muirtl",
  stylisPlugins: [prefixer, rtlPlugin],
});

/**
 * cache چپ‌به‌راست معمولی (بدون افزونهٔ rtl) برای زبان‌هایی که راست‌به‌چپ
 * نیستند (انگلیسی، ترکی، روسی). کلید متفاوت از rtlCache دارد تا Emotion
 * استایل‌های دو جهت را با هم قاطی نکند وقتی کاربر بین زبان‌ها جابه‌جا می‌شود.
 */
export const ltrCache = createCache({
  key: "muiltr",
  stylisPlugins: [prefixer],
});

export function getEmotionCacheForDir(dir: "rtl" | "ltr") {
  return dir === "rtl" ? rtlCache : ltrCache;
}
