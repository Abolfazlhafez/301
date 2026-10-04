/**
 * تست i18n DailyReportWorkersPage (صفحهٔ A4 خروجی PDF گزارش روزانه) در زبان‌های فعال (fa و en):
 *  - رندر واقعی SSR صفحهٔ A4 در دو حالت: «صفحهٔ آخر» (خلاصه + یادداشت) و «صفحهٔ میانی» (بدون خلاصه)، با/بدون یادداشت و نگهبانی؛
 *  - پوشش ایستای همهٔ کلیدهای dailyReport.pdf.* (استفاده‌شده، تعریف‌شده، placeholderها، interpolation)؛
 *  - ثبات خروجی فارسی با رفتار قبلی؛ نبود فارسی هاردکد در کل فایل؛
 *  - نگهبان جهت: direction ثابت "rtl" فایل با افزونهٔ RTL استایل در fa به ltr تبدیل می‌شود و در en همان rtl می‌ماند
 *    (چیدمان en آینهٔ fa است). اگر کسی direction را عوض کند این تست می‌شکند تا حتماً ظاهر PDF دوباره دیده شود.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { compile, serialize, middleware, stringify, prefixer } from "stylis";
import rtlPluginMod from "stylis-plugin-rtl";
import i18n from "../../shared/i18n";
import { DailyReportWorkersPage } from "../../widgets/daily-report/DailyReportWorkersPage";
import { CURRENCIES, ENABLED_LANGUAGES } from "../../shared/i18n/languages";
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

function toText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
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
const theme = createTheme();

function placeholders(s: string): string {
  return (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(",");
}

function makeReport(id: string, name: string, position: string, guard: number) {
  return {
    workerId: id,
    workerFullName: name,
    position,
    date: "2026-01-01",
    checkIn: "08:00",
    checkOut: "17:00",
    totalAttendanceMinutes: 540,
    totalTimeLossMinutes: 30,
    totalBreakMinutes: 60,
    usefulMinutes: 450,
    dailyBaseSalary: 1000,
    hourlyRate: 100,
    payableSalary: 4500,
    guardDuty: { enabled: guard > 0, rateType: "hourly" as const, rate: 0, shiftsCount: guard > 0 ? 1 : 0, totalMinutes: 0, payableSalary: guard, shifts: [] },
    timeLosses: [],
    breakTimes: [],
  };
}

type Scenario = "last" | "middle";

function renderPage(scenario: Scenario, note: string): string {
  const last = scenario === "last";
  return renderToString(
    createElement(
      ThemeProvider,
      { theme },
      createElement(DailyReportWorkersPage, {
        id: "p0",
        date: "2026-01-01",
        projectName: "PROJX",
        supervisorName: "SUP-ONE",
        supervisorNote: note,
        workers: [makeReport("w1", "WNAME-ONE", "POS-ONE", 700), makeReport("w2", "WNAME-TWO", "POS-TWO", 0)],
        pageIndex: 1,
        pageCount: 3,
        showSummaryFooter: last,
        generatedAtLabel: "GENAT-LABEL",
        grandTotals: { workersCount: 7, totalUsefulMinutes: 900, totalTimeLossMinutes: 60, totalPayableSalary: 9000 },
      })
    )
  ).replace(/&#x27;|&#39;/g, "'");
}

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  const src = readFileSync(new URL("../../widgets/daily-report/DailyReportWorkersPage.tsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const faBundle = (i18n.getResourceBundle("fa", "common") as { dailyReport: { pdf: Record<string, string> } }).dailyReport.pdf;
  const pdfKeys = Object.keys(faBundle).map((k) => `dailyReport.pdf.${k}`);
  const usedKeys = new Set([...code.matchAll(/"(dailyReport\.[\w.]+)"/g)].map((m) => m[1]));

  console.log("\n— پوشش ایستا");
  check(pdfKeys.length === 16, `تعداد کلیدهای dailyReport.pdf.* (${pdfKeys.length})`);
  check(pdfKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای در dailyReport.pdf نیست");
  check([...usedKeys].filter((k) => k.startsWith("dailyReport.pdf.")).every((k) => pdfKeys.includes(k)), "هر کلید pdf استفاده‌شده در کد تعریف شده است");
  check(["dailyReport.supervisorLine", "dailyReport.timeLoss", "dailyReport.allowedBreak", "dailyReport.usefulTime", "dailyReport.finalSalary"].every((k) => usedKeys.has(k)), "کلیدهای مشترک موجود (سرپرست/اتلاف/استراحت/مفید/حقوق نهایی) دوباره استفاده شده‌اند");
  check(!PERSIAN_ARABIC_RE.test(code), "هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده");
  check(/t\("dailyReport\.pdf\.pageOf", \{ page: pageIndex \+ 1, total: pageCount \}\)/.test(code), "«صفحه n از m» یک جملهٔ کامل است");
  check(/t\("dailyReport\.pdf\.dateLine", \{ date: toJalaliWithWeekday\(date\) \}\)/.test(code) && /t\("dailyReport\.pdf\.generatedAt", \{ time: generatedAtLabel \}\)/.test(code), "«تاریخ گزارش» و «زمان تهیه» جملهٔ کامل‌اند");

  console.log("\n— ثبات خروجی فارسی (رفتار قبلی)");
  {
    const fa = i18n.getFixedT("fa");
    check(fa("dailyReport.pdf.brandName") === "کارگاه‌یار" && fa("dailyReport.pdf.brandTagline") === "مدیریت هوشمند کارگاه", "fa: نام و شعار برند همان قبلی");
    check(fa("dailyReport.pdf.title") === "گزارش روزانه نیروها" && fa("dailyReport.pdf.dateLine", { date: "D" }) === "تاریخ گزارش: D", "fa: عنوان و خط تاریخ همان قبلی");
    check(fa("dailyReport.pdf.projectLine", { name: "N" }) === "پروژه: N" && fa("dailyReport.supervisorLine", { name: "N" }) === "سرپرست: N", "fa: «پروژه/سرپرست» همان قبلی");
    check(fa("dailyReport.pdf.summaryTitle") === "خلاصه گزارش" && fa("dailyReport.pdf.noteTitle") === "یادداشت سرپرست", "fa: عنوان خلاصه و یادداشت همان قبلی");
    check(fa("dailyReport.pdf.workersCountValue", { n: 7 }) === "7 نفر" && fa("dailyReport.pdf.totalWorkers") === "تعداد نیروها", "fa: «x نفر» و برچسب تعداد همان قبلی");
    check(fa("dailyReport.pdf.totalUseful") === "کل زمان مفید" && fa("dailyReport.pdf.totalLoss") === "کل اتلاف وقت" && fa("dailyReport.pdf.totalPay") === "جمع حقوق", "fa: برچسب‌های جمع همان قبلی");
    check(fa("dailyReport.pdf.footerBrand") === "تهیه‌شده با نرم‌افزار کارگاه‌یار" && fa("dailyReport.pdf.pageOf", { page: 2, total: 3 }) === "صفحه 2 از 3" && fa("dailyReport.pdf.generatedAt", { time: "T" }) === "زمان تهیه گزارش: T", "fa: فوتر همان قبلی");
    check(fa("dailyReport.pdf.guardPlus") === "+ نگهبانی", "fa: «+ نگهبانی» همان قبلی");
    check(fa("dailyReport.timeLoss") === "اتلاف وقت" && fa("dailyReport.allowedBreak") === "استراحت مجاز" && fa("dailyReport.usefulTime") === "زمان مفید" && fa("dailyReport.finalSalary") === "حقوق نهایی", "fa: برچسب‌های کارت نیرو همان قبلی");
  }

  console.log("\n— نگهبان جهت (افزونهٔ RTL استایل)");
  {
    const rtlPlugin = ((rtlPluginMod as unknown as { default?: unknown }).default ?? rtlPluginMod) as never;
    const css = ".a{direction:rtl;}";
    const inRtlCache = serialize(compile(css), middleware([prefixer, rtlPlugin, stringify]));
    const inLtrCache = serialize(compile(css), middleware([prefixer, stringify]));
    check(inRtlCache.includes("direction:ltr") && inLtrCache.includes("direction:rtl"), "فرض پایه: direction:rtl در کش RTL (fa) به ltr و در کش LTR (en) همان rtl می‌شود");
    check(/direction: "rtl"/.test(code) && (code.match(/direction: "(rtl|ltr)"/g) ?? []).length >= 1 && (code.match(/\bdirection: "rtl",\n/g) ?? []).length === 1, "کانتینر A4 همچنان direction:\"rtl\" ثابت دارد (چیدمان en آینهٔ fa؛ ظاهر واقعی PDF تأییدنشده)");
  }

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان (ایستا): ${lang}`);
    check(pdfKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${pdfKeys.length} کلید موجود است`);
    check(pdfKeys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    const interp: [string, Record<string, string | number>, string][] = [
      ["dailyReport.pdf.dateLine", { date: "DATE1" }, "DATE1"],
      ["dailyReport.pdf.projectLine", { name: "NAME1" }, "NAME1"],
      ["dailyReport.pdf.workersCountValue", { n: 42 }, "42"],
      ["dailyReport.pdf.pageOf", { page: 2, total: 9 }, "9"],
      ["dailyReport.pdf.generatedAt", { time: "TIME1" }, "TIME1"],
    ];
    check(interp.every(([k, o, needle]) => { const v = t(k, o); return v.includes(needle) && !v.includes("{{"); }), `${lang}: interpolationها کار می‌کنند (${interp.length} کلید)`);
    const totalKeys = ["totalWorkers", "totalUseful", "totalLoss", "totalPay"];
    check(new Set(totalKeys.map((k) => t(`dailyReport.pdf.${k}`))).size === 4, `${lang}: چهار برچسب خلاصه متمایزند`);
    if (lang !== "fa") {
      const same = pdfKeys.filter((k) => t(k) === fa(k));
      check(same.length === 0, `${lang}: هیچ کلیدی عیناً فارسی نیست${same.length ? " (" + same.join(",") + ")" : ""}`);
    }
    if (LATIN_ONLY.has(lang)) {
      check(pdfKeys.every((k) => !PERSIAN_ARABIC_RE.test(t(k))), `${lang}: هیچ حرف فارسی/عربی در ترجمه‌ها نیست`);
    }
  }

  console.log("\n— رندر SSR");
  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان (رندر): ${lang}`);

    const lastHtml = renderPage("last", "NOTE-X");
    const lastT = toText(lastHtml);
    const midT = toText(renderPage("middle", ""));
    const lastNoNoteT = toText(renderPage("last", ""));

    check(lastT.length > 300, `${lang}: صفحه رندر شد (${lastT.length} نویسه)`);
    check(!/dailyReport\.|common\./.test(lastHtml) && !lastT.includes("{{"), `${lang}: کلید خام/placeholder نشت نکرده`);
    check(lastT.includes(t("dailyReport.pdf.brandName")) && lastT.includes(t("dailyReport.pdf.brandTagline")), `${lang}: نام و شعار برند در سربرگ`);
    check(lastT.includes(t("dailyReport.pdf.title")), `${lang}: عنوان گزارش`);
    check(lastT.includes(t("dailyReport.pdf.projectLine", { name: "PROJX" })) && lastT.includes(t("dailyReport.supervisorLine", { name: "SUP-ONE" })), `${lang}: ردیف پروژه و سرپرست`);
    check(lastT.includes(t("dailyReport.pdf.pageOf", { page: 2, total: 3 })), `${lang}: «صفحه ۲ از ۳»`);
    check(lastT.includes(t("dailyReport.pdf.generatedAt", { time: "GENAT-LABEL" })), `${lang}: «زمان تهیه گزارش»`);
    check(lastT.includes(t("dailyReport.pdf.footerBrand")), `${lang}: فوتر برند`);
    for (const k of ["timeLoss", "allowedBreak", "usefulTime", "finalSalary"]) {
      check(countOf(lastHtml, `>${t(`dailyReport.${k}`)}<`) === 2, `${lang}: برچسب «${k}» برای هر دو کارت نیرو`);
    }
    check(countOf(lastT, t("dailyReport.pdf.guardPlus")) === 1, `${lang}: «+ نگهبانی» فقط برای نیروی دارای دستمزد نگهبانی`);
    check(countOf(lastT, "WNAME-ONE") === 1 && countOf(lastT, "POS-TWO") === 1, `${lang}: نام و سمت نیروها (داده) دست‌نخورده`);
    for (const k of ["summaryTitle", "totalWorkers", "totalUseful", "totalLoss", "totalPay", "noteTitle"]) {
      check(lastT.includes(t(`dailyReport.pdf.${k}`)), `${lang}: صفحهٔ آخر «${k}» دارد`);
    }
    check(lastT.includes(t("dailyReport.pdf.workersCountValue", { n: 7 })), `${lang}: مقدار تعداد نیروها (7)`);
    check(lastT.includes("NOTE-X"), `${lang}: متن یادداشت سرپرست (داده) دست‌نخورده`);
    check(!midT.includes(t("dailyReport.pdf.summaryTitle")) && !midT.includes(t("dailyReport.pdf.noteTitle")) && !midT.includes(t("dailyReport.pdf.totalPay")), `${lang}: صفحهٔ میانی خلاصه و یادداشت ندارد`);
    check(midT.includes(t("dailyReport.pdf.footerBrand")) && midT.includes(t("dailyReport.pdf.pageOf", { page: 2, total: 3 })), `${lang}: صفحهٔ میانی فوتر دارد`);
    check(lastNoNoteT.includes(t("dailyReport.pdf.noteTitle")) && !lastNoNoteT.includes("NOTE-X"), `${lang}: بدون یادداشت فقط عنوان بخش (خط‌های خالی) می‌ماند`);

    if (lang !== "fa") {
      check(!lastT.includes(i18n.getFixedT("fa")("dailyReport.pdf.title")), `${lang}: صفحه عیناً فارسی نیست`);
    }
    if (LATIN_ONLY.has(lang)) {
      // خط تاریخ شمسی (toJalaliWithWeekday) هنوز فارسی است: کار جدا و از قبل ثبت‌شده؛ فقط همان خط از بررسی کنار گذاشته می‌شود.
      let stripped: string = lastT.replace(/Report date:[^A-Za-z]*[^]*?(?=Project:)/, " ");
      for (const c of Object.values(CURRENCIES)) stripped = stripped.split(c.symbol).join(" ");
      const m = stripped.match(PERSIAN_ARABIC_RE);
      if (m) console.log("    متن فارسی باقی‌مانده:", stripped.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 80));
      check(!m, `${lang}: هیچ حرف فارسی/عربی هاردکد در رندر نیست (به‌جز نماد واحد پول و خط تاریخ شمسی)`);
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
