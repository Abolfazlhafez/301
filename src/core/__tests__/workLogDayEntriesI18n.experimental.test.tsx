/**
 * تست i18n WorkLogDayEntries (گزارش‌های کار یک روز) در زبان‌های فعال (fa و en):
 *  - رندر واقعی SSR با کش react-query پیش‌پر: روز دارای دو گزارش (یکی با توضیح، یکی بی‌توضیح) و روز خالی؛
 *    بخش مخفی رندر خروجی تصویر (aria-hidden) از بررسی حذف می‌شود؛
 *  - پوشش ایستا برای بخش‌های وابسته به رویداد/افکت: توست‌ها، ConfirmDialog و EditTextDialogهای بسته،
 *    نام فایل PNG و عنوان اشتراک‌گذاری؛
 *  - نام فایل خروجی از زبان اپ می‌آید (fa همان قبلی؛ en لاتین ASCII)؛
 *  - کل فایل (بدون کامنت) حرف فارسی/عربی هاردکد ندارد.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { WorkLogDayEntries } from "../../widgets/work-log/WorkLogDayEntries";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { CURRENCIES, ENABLED_LANGUAGES } from "../../shared/i18n/languages";
import { PREF_KEYS, setPref } from "../../shared/storage/appPreferences";
import { toJalaliDisplay, toJalaliWithWeekday } from "../../shared/utils/jalaliDate";
import { sanitizeFilename } from "../../shared/utils/sanitizeFilename";

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

function toText(html: string): string {
  return html
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}
function countOf(haystack: string, needle: string): number {
  return needle ? haystack.split(needle).length - 1 : 0;
}

const LANGS: string[] = [...ENABLED_LANGUAGES]; // فقط زبان‌های فعال (فعلاً fa و en)
const PERSIAN_ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_ONLY = new Set(["en"]);
const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });
function placeholders(s: string): string {
  return (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(",");
}

const DATE = "2026-01-05";
const photos = [
  { id: "ph1", projectId: "p", relatedType: "site", relatedId: null, date: DATE, caption: "CAP-ONE", filename: "f1.jpg", originalName: "f1.jpg", mimeType: "image/jpeg", fileSize: 1, createdAt: "2026-01-05T00:00:00Z" },
  { id: "ph2", projectId: "p", relatedType: "site", relatedId: null, date: DATE, caption: null, filename: "f2.jpg", originalName: "f2.jpg", mimeType: "image/jpeg", fileSize: 1, createdAt: "2026-01-05T00:00:00Z" },
];

function renderDay(scenario: "data" | "empty"): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["photos", "site", "day", DATE], scenario === "data" ? photos : []);
  qc.setQueryData(["work-log-note", DATE], null);
  qc.setQueryData(["work-log-note", "all"], []);
  qc.setQueryData(["settings"], {});
  const html = renderToString(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(ThemeProvider, { theme }, createElement(ToastProvider, null, createElement(WorkLogDayEntries, { date: DATE })))
    )
  ).replace(/&#x27;|&#39;/g, "'");
  // بخش مخفی رندر خروجی تصویر (aria-hidden) از بررسی حذف می‌شود.
  const hiddenAt = html.search(/<div[^>]*aria-hidden="true"/);
  return hiddenAt === -1 ? html : html.slice(0, hiddenAt);
}

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  const src = readFileSync(new URL("../../widgets/work-log/WorkLogDayEntries.tsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const faBundle = (i18n.getResourceBundle("fa", "common") as { workLog: { dayEntries: Record<string, unknown> } }).workLog.dayEntries;
  const definedKeys = Object.keys(faBundle).map((k) => `workLog.dayEntries.${k}`);
  const usedKeys = new Set([...code.matchAll(/"(workLog\.dayEntries\.[\w.]+)"/g)].map((m) => m[1]));
  const K = "workLog.dayEntries.";

  console.log("\n— پوشش ایستا");
  check(definedKeys.length === 21, `تعداد کلیدها (${definedKeys.length})`);
  check(definedKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای در workLog.dayEntries نیست");
  check([...usedKeys].every((k) => definedKeys.includes(k)), "هر کلید استفاده‌شده در کد تعریف شده است");
  check(!PERSIAN_ARABIC_RE.test(code), "هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده");
  check(/confirmLabel=\{t\("common\.delete"\)\}/.test(code), "برچسب تأیید حذف از کلید مشترک common.delete می‌آید");
  check(countOf(code, `t("${K}editCaption")`) === 2 && countOf(code, `t("${K}editDescription")`) === 2, "aria-label و عنوان دیالوگ‌های ویرایش از یک کلید مشترک‌اند");
  check(new RegExp("`\\$\\{t\\(\"workLog\\.dayEntries\\.reportFilePrefix\"\\)\\}-\\$\\{jalali\\}\\.png`").test(code), "نام فایل PNG از پیشوند i18n + تاریخ ساخته می‌شود");
  check(/t\("workLog\.dayEntries\.shareTitle", \{ date: toJalaliDisplay\(date\) \}\)/.test(code), "عنوان اشتراک‌گذاری یک جملهٔ کامل با placeholder است");
  check(/result\.count > 1 \? t\("workLog\.dayEntries\.uploadedMany", \{ n: result\.count \}\) : t\("workLog\.dayEntries\.uploadedOne"\)/.test(code), "توست ثبت: مفرد/جمع با دو کلید کامل (نه چسباندن تکه‌ها)");
  check(/t\("workLog\.dayEntries\.captionSaved"\)/.test(code) && /t\("workLog\.dayEntries\.descriptionSaved"\)/.test(code) && /t\("workLog\.dayEntries\.deleted"\)/.test(code), "توست‌های ذخیرهٔ توضیح عکس/توضیحات کار/حذف از i18n می‌آیند");
  check(/title=\{t\("workLog\.dayEntries\.deleteTitle"\)\}/.test(code) && /description=\{t\("workLog\.dayEntries\.deleteConfirm"\)\}/.test(code), "ConfirmDialog (بسته در SSR) از i18n می‌آید");
  check(/label=\{t\("workLog\.dayEntries\.captionLabel"\)\}/.test(code) && /label=\{t\("workLog\.dayEntries\.descriptionLabel"\)\}/.test(code) && /suggestionLabel=\{t\("workLog\.dayEntries\.suggestionLabel"\)\}/.test(code), "برچسب EditTextDialogهای بسته از i18n می‌آید");

  console.log("\n— ثبات خروجی فارسی (رفتار قبلی)");
  {
    const fa = i18n.getFixedT("fa");
    check(fa(`${K}captionSaved`) === "توضیح عکس ذخیره شد." && fa(`${K}descriptionSaved`) === "توضیحات کار ذخیره شد." && fa(`${K}deleted`) === "گزارش حذف شد.", "fa: متن توست‌های ذخیره/حذف همان قبلی");
    check(fa(`${K}uploadedMany`, { n: 3 }) === "3 عکس با موفقیت ثبت شد." && fa(`${K}uploadedOne`) === "گزارش کار با موفقیت ثبت شد.", "fa: متن توست ثبت (چندتایی/تکی) همان قبلی");
    check(`${fa(`${K}reportFilePrefix`)}-5-دی-1404.png` === "گزارش-کار-5-دی-1404.png" && fa(`${K}shareTitle`, { date: "D" }) === "گزارش کار روز D", "fa: نام فایل و عنوان اشتراک‌گذاری همان قبلی");
    check(fa(`${K}editDescription`) === "ویرایش توضیحات کار" && fa(`${K}buildReport`) === "ساخت گزارش کار" && fa(`${K}addAria`) === "افزودن گزارش کار", "fa: aria-labelهای نوار بالا و دکمهٔ افزودن همان قبلی");
    check(fa(`${K}emptyTitle`) === "برای این روز گزارشی ثبت نشده است." && fa(`${K}emptyDesc`) === "با دکمه + عکس و توضیح کار انجام‌شده در این روز را اضافه کنید.", "fa: حالت خالی همان قبلی");
    check(fa(`${K}deleteSwipeAria`) === "حذف این گزارش" && fa(`${K}noCaption`) === "بدون توضیح متنی" && fa(`${K}photoAlt`) === "عکس گزارش کار" && fa(`${K}editCaption`) === "ویرایش توضیح عکس", "fa: متن‌های کارت گزارش همان قبلی");
    check(fa(`${K}deleteTitle`) === "حذف گزارش" && fa(`${K}deleteConfirm`) === "آیا از حذف این گزارش (عکس و توضیح) مطمئن هستید؟ این عملیات قابل بازگشت نیست.", "fa: متن ConfirmDialog همان قبلی");
    check(fa(`${K}captionLabel`) === "توضیح عکس" && fa(`${K}descriptionLabel`) === "توضیحات کار انجام‌شده در این روز" && fa(`${K}suggestionLabel`) === "استفاده از توضیح آخرین روز ثبت‌شده", "fa: برچسب EditTextDialogها همان قبلی");
  }

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان (ایستا): ${lang}`);
    check(definedKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${definedKeys.length} کلید موجود است`);
    check(definedKeys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    const interp: [string, Record<string, string | number>, string][] = [
      [`${K}uploadedMany`, { n: 42 }, "42"],
      [`${K}shareTitle`, { date: "DATE1" }, "DATE1"],
    ];
    check(interp.every(([k, o, needle]) => { const v = t(k, o); return v.includes(needle) && !v.includes("{{"); }), `${lang}: interpolationها کار می‌کنند (${interp.length} کلید)`);
    check(t(`${K}uploadedMany`, { n: 2 }) !== t(`${K}uploadedOne`), `${lang}: توست ثبت چندتایی و تکی متمایزند`);
    check(t(`${K}editDescription`) !== t(`${K}editCaption`) && t(`${K}captionLabel`) !== t(`${K}descriptionLabel`), `${lang}: ویرایش «توضیح عکس» و «توضیحات کار» متمایزند`);
    const fileName = sanitizeFilename(`${t(`${K}reportFilePrefix`)}-5-January-2026.png`);
    check(!/[\\/:*?"<>|]/.test(fileName) && fileName.endsWith(".png"), `${lang}: نام فایل PNG پس از پاک‌سازی مجاز و با پسوند درست است`);
    if (lang !== "fa") {
      const same = definedKeys.filter((k) => t(k) === fa(k));
      check(same.length === 0, `${lang}: هیچ کلیدی عیناً فارسی نیست${same.length ? " (" + same.join(",") + ")" : ""}`);
    }
    if (LATIN_ONLY.has(lang)) {
      check(definedKeys.every((k) => !PERSIAN_ARABIC_RE.test(t(k))), `${lang}: هیچ حرف فارسی/عربی در ترجمه‌ها نیست`);
      check(/^[\x20-\x7E]+$/.test(t(`${K}reportFilePrefix`)), `${lang}: پیشوند نام فایل لاتین ASCII است`);
    }
  }

  console.log("\n— رندر SSR");
  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان (رندر): ${lang}`);

    const dataHtml = renderDay("data");
    const dataT = toText(dataHtml);
    check(dataT.length > 100, `${lang}: صفحه رندر شد (${dataT.length} نویسه)`);
    check(!/workLog\.dayEntries\.|common\.delete/.test(dataHtml) && !dataT.includes("{{"), `${lang}: کلید خام/placeholder نشت نکرده`);
    check(dataT.includes(toJalaliWithWeekday(DATE)), `${lang}: سرتیتر تاریخ روز نمایش داده می‌شود`);
    check(countOf(dataHtml, `aria-label="${t(`${K}editDescription`)}"`) === 1, `${lang}: aria-label ویرایش توضیحات کار`);
    check(countOf(dataHtml, `aria-label="${t(`${K}buildReport`)}"`) === 1, `${lang}: aria-label ساخت گزارش کار`);
    check(countOf(dataHtml, `aria-label="${t(`${K}addAria`)}"`) === 1, `${lang}: aria-label دکمهٔ افزودن گزارش`);
    check(countOf(dataHtml, `aria-label="${t(`${K}editCaption`)}"`) === 2, `${lang}: aria-label ویرایش توضیح عکس برای هر دو گزارش`);
    check(countOf(dataHtml, `aria-label="${t(`${K}deleteSwipeAria`)}"`) === 2, `${lang}: aria-label حذف (کشیدن/swipe) برای هر دو گزارش`);
    check(countOf(dataT, "CAP-ONE") === 1 && countOf(dataHtml, 'alt="CAP-ONE"') === 1, `${lang}: توضیح گزارش (داده) در متن و alt دست‌نخورده`);
    check(countOf(dataT, t(`${K}noCaption`)) === 1, `${lang}: گزارش بی‌توضیح «بدون توضیح متنی» نشان می‌دهد (فقط یکی)`);
    check(countOf(dataHtml, `alt="${t(`${K}photoAlt`)}"`) === 1, `${lang}: alt عکس بی‌توضیح ترجمه شده`);
    check(!dataT.includes(t(`${K}emptyTitle`)), `${lang}: وقتی گزارش هست پیام «خالی» نیست`);
    check(!dataT.includes(t(`${K}deleteConfirm`)) && !dataT.includes(t(`${K}deleteTitle`)), `${lang}: ConfirmDialog بسته رندر نمی‌شود`);

    const emptyHtml = renderDay("empty");
    const emptyT = toText(emptyHtml);
    check(emptyT.includes(t(`${K}emptyTitle`)) && emptyT.includes(t(`${K}emptyDesc`)), `${lang}: روز خالی: عنوان/توضیح خالی`);
    check(!emptyT.includes(t(`${K}noCaption`)) && countOf(emptyHtml, `aria-label="${t(`${K}editCaption`)}"`) === 0, `${lang}: روز خالی: کارت گزارش رندر نمی‌شود`);
    check(countOf(emptyHtml, `aria-label="${t(`${K}buildReport`)}"`) === 1, `${lang}: روز خالی: دکمهٔ ساخت گزارش هنوز هست (غیرفعال)`);

    // نام فایل و عنوان اشتراک‌گذاری همان‌طور که کد می‌سازد.
    const jalali = toJalaliDisplay(DATE).replace(/\s/g, "-");
    const fileName = sanitizeFilename(`${t(`${K}reportFilePrefix`)}-${jalali}.png`);
    if (lang === "fa") {
      check(fileName.startsWith("گزارش-کار-") && fileName.endsWith(".png"), `fa: نام فایل PNG با پیشوند قبلی «گزارش-کار-»`);
    } else {
      check(fileName.startsWith("work-report-") && /^[\x20-\x7E]+$/.test(fileName), `${lang}: نام فایل PNG لاتین ASCII با پیشوند work-report (${fileName})`);
    }

    if (lang !== "fa") {
      check(!dataT.includes(i18n.getFixedT("fa")(`${K}noCaption`)), `${lang}: صفحه عیناً فارسی نیست`);
    }
    if (LATIN_ONLY.has(lang)) {
      for (const [name, txt] of [["data", dataT], ["empty", emptyT]] as const) {
        let stripped: string = txt;
        for (const c of Object.values(CURRENCIES)) stripped = stripped.split(c.symbol).join(" ");
        const m = stripped.match(PERSIAN_ARABIC_RE);
        if (m) console.log("    متن فارسی باقی‌مانده:", stripped.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 80));
        check(!m, `${lang}/${name}: هیچ حرف فارسی/عربی هاردکد در رندر نیست`);
      }
    }
  }

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
