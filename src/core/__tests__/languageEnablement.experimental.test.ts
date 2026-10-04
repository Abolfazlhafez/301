/**
 * تست غیرفعال‌سازی موقت زبان‌ها (فعلاً فقط fa فعال است؛ en هم قفل شد):
 *  - ENABLED_LANGUAGES دقیقاً [fa] است و LANGUAGE_LIST (منبع انتخابگر زبان) فقط fa را دارد؛
 *  - LANGUAGES و فایل‌های ترجمهٔ هر ۸ زبان سر جایشان هستند (چیزی حذف نشده؛ فعال‌سازی دوباره فقط افزودن به آرایه است)؛
 *  - normalizeLanguage: زبان فعال را نگه می‌دارد و زبان غیرفعال/خالی/نامعتبر را به fa برمی‌گرداند؛
 *  - رفتار واقعی: با زبان ذخیره‌شدهٔ غیرفعال (مثلاً ar یا en)، i18n با fa بالا می‌آید و هوک useLanguage مقدار اولیهٔ fa می‌دهد؛
 *  - ایستا: i18n/index.ts، useLanguage.ts و main.tsx همه از normalizeLanguage می‌گذرند و فهرست هاردکد ۸زبانه ندارند؛
 *    انتخابگر زبان در SettingsPage از LANGUAGE_LIST می‌آید و انتخابگر واحد پول طبق تصمیم فعلی دست‌نخورده است.
 */
import "fake-indexeddb/auto";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  ENABLED_LANGUAGES,
  LANGUAGES,
  LANGUAGE_LIST,
  isEnabledLanguage,
  normalizeLanguage,
} from "../../shared/i18n/languages";
import { PREF_KEYS, setPref } from "../../shared/storage/appPreferences";

let passed = 0;
let failed = 0;
function check(ok: boolean, name: string) {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
  }
}

const ALL = ["fa", "en", "ar", "tr", "ur", "ku", "ps", "ru"];
const INACTIVE = ["en", "ar", "tr", "ur", "ku", "ps", "ru"];

function read(rel: string): string {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";

  console.log("\n— ثابت‌ها و فهرست");
  check(JSON.stringify([...ENABLED_LANGUAGES]) === JSON.stringify(["fa"]), "ENABLED_LANGUAGES دقیقاً [fa] است");
  check(JSON.stringify(LANGUAGE_LIST.map((l) => l.code)) === JSON.stringify(["fa"]), "LANGUAGE_LIST (انتخابگر زبان) فقط fa را دارد");
  check(!LANGUAGE_LIST.some((l) => l.code === "en"), "en در LANGUAGE_LIST نیست");
  check(LANGUAGE_LIST.every((l) => l.nativeName === LANGUAGES[l.code].nativeName), "ورودی‌های LANGUAGE_LIST همان ورودی‌های LANGUAGES هستند");
  check(Object.keys(LANGUAGES).sort().join(",") === [...ALL].sort().join(","), "LANGUAGES هنوز هر ۸ زبان را دارد (برای فعال‌سازی دوباره)");
  check(ENABLED_LANGUAGES.every((c) => c in LANGUAGES), "هر زبان فعال در LANGUAGES تعریف شده است");

  console.log("\n— فایل‌های ترجمه حذف نشده‌اند");
  for (const lang of ALL) {
    const url = new URL(`../../shared/i18n/locales/${lang}/common.json`, import.meta.url);
    let ok = existsSync(url);
    if (ok) {
      try {
        ok = typeof JSON.parse(readFileSync(url, "utf8")) === "object";
      } catch {
        ok = false;
      }
    }
    check(ok, `${lang}: common.json موجود و JSON معتبر است`);
  }

  console.log("\n— normalizeLanguage / isEnabledLanguage");
  check(normalizeLanguage("fa") === "fa", "fa همان‌طور که هست می‌ماند");
  check(normalizeLanguage("en") === "fa", "زبان ذخیره‌شدهٔ en (کاربری که قبلاً انگلیسی انتخاب کرده) به fa برمی‌گردد");
  check(INACTIVE.every((c) => normalizeLanguage(c) === "fa"), "هر هفت زبان غیرفعال (از جمله en) به fa برمی‌گردند");
  check(normalizeLanguage("") === "fa" && normalizeLanguage(null) === "fa" && normalizeLanguage(undefined) === "fa" && normalizeLanguage("xx") === "fa", "مقدار خالی/نامعتبر به fa برمی‌گردد");
  check(isEnabledLanguage("fa") && !isEnabledLanguage("en") && !isEnabledLanguage("ru") && !isEnabledLanguage(null), "isEnabledLanguage درست تشخیص می‌دهد (fa بله؛ en/ru/null نه)");

  console.log("\n— رفتار واقعی با زبان ذخیره‌شدهٔ غیرفعال");
  setPref(PREF_KEYS.language, "ar");
  const { default: i18n } = await import("../../shared/i18n");
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));
  check(i18n.language === "fa", `با زبان ذخیره‌شدهٔ ar، i18n با fa شروع می‌شود (i18n.language=${i18n.language})`);
  check(i18n.t("nav.dashboard") === i18n.getFixedT("fa")("nav.dashboard"), "متن‌ها فارسی رندر می‌شوند، نه عربی");
  check(i18n.getFixedT("en")("nav.dashboard") !== i18n.getFixedT("fa")("nav.dashboard"), "منابع en هنوز ثبت‌اند (فایل locale حذف نشده؛ فعال‌سازی دوباره فقط افزودن به آرایه است)");

  const { useLanguage } = await import("../../shared/hooks/useLanguage");
  const Probe = () => createElement("span", null, useLanguage().language);
  const html = (lang: string) => {
    setPref(PREF_KEYS.language, lang);
    return renderToString(createElement(Probe)).replace(/<[^>]*>/g, "");
  };
  check(html("ar") === "fa", "useLanguage: مقدار اولیه برای ar برابر fa است");
  check(INACTIVE.every((c) => html(c) === "fa"), "useLanguage: مقدار اولیه برای هر هفت زبان غیرفعال برابر fa است");
  check(html("en") === "fa", "useLanguage: زبان ذخیره‌شدهٔ en به fa برمی‌گردد");
  check(html("fa") === "fa", "useLanguage: fa حفظ می‌شود");

  console.log("\n— پوشش ایستا");
  const idx = read("../../shared/i18n/index.ts");
  const hook = read("../../shared/hooks/useLanguage.ts");
  const main = read("../../main.tsx");
  const settings = read("../../pages/settings/SettingsPage.tsx");
  check(/normalizeLanguage\(getPref\(STORAGE_KEY\)\)/.test(idx), "i18n/index.ts زبان ذخیره‌شده را normalize می‌کند");
  check(/normalizeLanguage\(getPref\(LANG_STORAGE_KEY\)\)/.test(hook) && !/ar:\s*1/.test(hook), "useLanguage.ts از normalizeLanguage می‌گذرد و فهرست هاردکد ۸زبانه ندارد");
  check(/normalizeLanguage\(getPref\(PREF_KEYS\.language\)\)/.test(main) && !/getPref\(PREF_KEYS\.language\) \|\| "fa"/.test(main), "main.tsx جهت/زبان اولیه را از زبان normalize‌شده می‌گیرد");
  check(/LANGUAGE_LIST\.map\(/.test(settings) && !/Object\.values\(LANGUAGES\)/.test(settings), "انتخابگر زبان SettingsPage از LANGUAGE_LIST (فقط زبان‌های فعال) می‌آید");
  check(/LANGUAGE_LIST\.length\s*>\s*1\s*&&/.test(settings), "با یک زبان فعال، فیلد انتخابگر زبان در SettingsPage پنهان است");
  check(/Object\.values\(CURRENCIES\)\.map\(/.test(settings), "انتخابگر واحد پول طبق تصمیم فعلی دست‌نخورده است (همهٔ واحدها)");

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));
  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("خطای اجرای تست:", err);
    process.exit(1);
  });
