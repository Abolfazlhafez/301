/**
 * تست i18n MonthlyPayrollSummarySection (خلاصهٔ حقوق ماهانه) در هر ۸ زبان:
 *  - رندر واقعی SSR با کش react-query پیش‌پر: حالت «داده‌دار» (جدول صفحه + جدول مخفی خروجی تصویر، با/بدون دستمزد نگهبانی)
 *    و حالت «بدون نیروی فعال» (EmptyState)؛
 *  - پوشش ایستا برای بخش‌های وابسته به رویداد (سرستون‌ها و نام فایل CSV/PNG، عنوان اشتراک‌گذاری، دو توست ذخیره):
 *    همهٔ کلیدهای payrollSummary.* در کد استفاده شده‌اند، در ۸ زبان هستند، placeholderها با fa یکی‌اند و interpolation کار می‌کند؛
 *  - خروجی فارسی بایت‌به‌بایت با رفتار قبلی یکی است (سرستون‌ها و نام فایل‌های fa)؛
 *  - کل فایل (بدون کامنت) حرف فارسی/عربی هاردکد ندارد.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { MonthlyPayrollSummarySection } from "../../pages/reports/MonthlyPayrollSummarySection";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { CURRENCIES, ENABLED_LANGUAGES } from "../../shared/i18n/languages";
import { PREF_KEYS, setPref } from "../../shared/storage/appPreferences";
import { getCurrentJalaliMonthRange, toJalaliShort } from "../../shared/utils/jalaliDate";
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
const LATIN_CYRILLIC_ONLY = new Set(["en", "tr", "ru"]);
const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });

function placeholders(s: string): string {
  return (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(",");
}

const ROWS = [
  { workerId: "w1", workerFullName: "WNAME-ONE", position: "POS-ONE", presentDaysCount: 10, totalUsefulMinutes: 600, totalPayableSalary: 5000, totalGuardDutyPayableSalary: 700 },
  { workerId: "w2", workerFullName: "WNAME-TWO", position: "POS-TWO", presentDaysCount: 5, totalUsefulMinutes: 90, totalPayableSalary: 3000, totalGuardDutyPayableSalary: 0 },
];

function renderHtml(scenario: "data" | "empty"): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const range = getCurrentJalaliMonthRange();
  qc.setQueryData(["monthly-payroll-summary", range.from, range.to], scenario === "data" ? ROWS : []);
  qc.setQueryData(["settings"], { projectName: "PROJX" });
  return renderToString(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(ThemeProvider, { theme }, createElement(ToastProvider, null, createElement(MonthlyPayrollSummarySection)))
    )
  ).replace(/&#x27;|&#39;/g, "'");
}

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  const src = readFileSync(new URL("../../pages/reports/MonthlyPayrollSummarySection.tsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const faBundle = (i18n.getResourceBundle("fa", "common") as { payrollSummary: Record<string, unknown> }).payrollSummary;
  const flat = (o: Record<string, unknown>, pre = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? flat(v as Record<string, unknown>, `${pre}${k}.`) : [`${pre}${k}`]));
  const definedKeys = flat(faBundle).map((k) => `payrollSummary.${k}`);
  const usedKeys = new Set([...code.matchAll(/"(payrollSummary\.[\w.]+)"/g)].map((m) => m[1]));

  console.log("\n— پوشش ایستا");
  check(definedKeys.length === 22, `تعداد کلیدها (${definedKeys.length})`);
  check(definedKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای در payrollSummary نیست");
  check([...usedKeys].every((k) => definedKeys.includes(k)), "هر کلید استفاده‌شده در کد تعریف شده است");
  check(!PERSIAN_ARABIC_RE.test(code), "هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده");
  check(/"reports\.workerReport\.fromDateLabel"/.test(code) && /"reports\.workerReport\.toDateLabel"/.test(code), "برچسب‌های «از تاریخ/تا تاریخ» از کلیدهای موجود reports.workerReport.* می‌آیند");
  check(!/const headers = \[\s*"/.test(code) && (code.match(/buildCsvTable\(\)/g) ?? []).length >= 3, "سرستون‌ها و ردیف‌های CSV یک تعریف مشترک دارند (اشتراک‌گذاری + ذخیره در گوشی)");
  check((code.match(/csvFileName\(\)/g) ?? []).length >= 2 && (code.match(/imageFileName\(\)/g) ?? []).length >= 2, "نام فایل CSV (۲ مسیر) و PNG (۲ مسیر) از دو تابع i18n می‌آیند");
  check(/exportElementAsShareableImage\(exportTableRef\.current, imageFileName\(\), t\("payrollSummary\.exportTitle"\)\)/.test(code), "عنوان اشتراک‌گذاری عکس از i18n می‌آید");
  check(/t\("payrollSummary\.totalRow", \{ count: reports\.length \}\)/.test(code) && (code.match(/payrollSummary\.totalRow/g) ?? []).length === 2, "ردیف «جمع کل (n نفر)» در جدول صفحه و جدول خروجی یک کلید کامل است (نه چسباندن تکه‌ها)");
  check(/t\("payrollSummary\.dateRange", \{ from: toJalaliShort\(from\), to: toJalaliShort\(to\) \}\)/.test(code), "بازهٔ تاریخ خروجی تصویر یک جملهٔ کامل است");
  check(/t\("payrollSummary\.toastExcelSaved"\)/.test(code) && /t\("payrollSummary\.toastImageSaved"\)/.test(code), "هر دو توست ذخیره در گوشی از i18n می‌آیند");

  // رفتار فارسی نباید تغییر کرده باشد (خروجی fa بایت‌به‌بایت همان قبلی).
  console.log("\n— ثبات خروجی فارسی (رفتار قبلی)");
  {
    const fa = i18n.getFixedT("fa");
    check(fa("payrollSummary.csvFileName", { from: "F", to: "T" }) === "حقوق-ماهانه-F-تا-T.csv", "fa: نام فایل CSV همان قبلی");
    check(fa("payrollSummary.imageFileName", { from: "F", to: "T" }) === "خلاصه-حقوق-F-تا-T.png", "fa: نام فایل PNG همان قبلی");
    const expectedHeaders = [
      "نام نیرو",
      "سمت",
      "روزهای حضور",
      "ساعات کار مفید",
      "حقوق کار عادی (SYM)",
      "دستمزد نگهبانی (SYM)",
      "جمع کل قابل پرداخت (SYM)",
    ];
    const got = ["csvWorker", "csvPosition", "csvPresentDays", "csvUsefulHours", "csvRegular", "csvGuard", "csvTotal"].map((k) => fa(`payrollSummary.${k}`, { symbol: "SYM" }));
    check(JSON.stringify(got) === JSON.stringify(expectedHeaders), "fa: هفت سرستون CSV همان قبلی");
    check(fa("payrollSummary.exportTitle") === "خلاصهٔ حقوق ماهانه", "fa: عنوان خروجی همان قبلی");
    check(fa("payrollSummary.totalRow", { count: 3 }) === "جمع کل (3 نفر)", "fa: ردیف جمع کل همان قبلی");
    check(fa("payrollSummary.dateRange", { from: "F", to: "T" }) === "F تا T", "fa: بازهٔ تاریخ همان قبلی");
    check(fa("payrollSummary.toastExcelSaved") === "فایل اکسل در حافظهٔ گوشی ذخیره شد." && fa("payrollSummary.toastImageSaved") === "عکس در حافظهٔ گوشی ذخیره شد.", "fa: متن توست‌ها همان قبلی");
  }

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان (ایستا): ${lang}`);
    check(definedKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${definedKeys.length} کلید موجود است`);
    check(definedKeys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    const interp: [string, Record<string, string | number>, string][] = [
      ["payrollSummary.totalRow", { count: 7 }, "7"],
      ["payrollSummary.dateRange", { from: "FROM1", to: "TO2" }, "FROM1"],
      ["payrollSummary.csvFileName", { from: "FROM1", to: "TO2" }, "TO2"],
      ["payrollSummary.imageFileName", { from: "FROM1", to: "TO2" }, "FROM1"],
      ["payrollSummary.csvRegular", { symbol: "SYM" }, "SYM"],
      ["payrollSummary.csvGuard", { symbol: "SYM" }, "SYM"],
      ["payrollSummary.csvTotal", { symbol: "SYM" }, "SYM"],
    ];
    check(interp.every(([k, o, needle]) => { const v = t(k, o); return v.includes(needle) && !v.includes("{{"); }), `${lang}: interpolationها کار می‌کنند (${interp.length} کلید)`);
    const csvKeys = ["csvWorker", "csvPosition", "csvPresentDays", "csvUsefulHours", "csvRegular", "csvGuard", "csvTotal"];
    check(new Set(csvKeys.map((k) => t(`payrollSummary.${k}`, { symbol: "S" }))).size === 7, `${lang}: هفت سرستون CSV متمایزند`);
    const colKeys = ["colWorker", "colPresentDays", "colUsefulHours", "colRegular", "colGuardDuty", "colTotal"];
    check(new Set(colKeys.map((k) => t(`payrollSummary.${k}`))).size === 6, `${lang}: شش سرستون جدول متمایزند`);
    const csvName = sanitizeFilename(t("payrollSummary.csvFileName", { from: "1405/01/01", to: "1405/01/31" }));
    const pngName = sanitizeFilename(t("payrollSummary.imageFileName", { from: "1405/01/01", to: "1405/01/31" }));
    check(!/[\\/:*?"<>|]/.test(csvName) && csvName.endsWith(".csv") && !/[\\/:*?"<>|]/.test(pngName) && pngName.endsWith(".png"), `${lang}: نام فایل‌ها پس از پاک‌سازی مجاز و با پسوند درست‌اند`);
    check(csvName !== pngName, `${lang}: نام فایل CSV و PNG متفاوت‌اند`);
    if (lang !== "fa") {
      const same = definedKeys.filter((k) => t(k) === fa(k));
      check(same.length === 0, `${lang}: هیچ کلیدی عیناً فارسی نیست${same.length ? " (" + same.join(",") + ")" : ""}`);
    }
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      check(definedKeys.every((k) => !PERSIAN_ARABIC_RE.test(t(k))), `${lang}: هیچ حرف فارسی/عربی در ترجمه‌ها نیست`);
    }
  }

  console.log("\n— رندر SSR");
  const COLS = ["colWorker", "colPresentDays", "colUsefulHours", "colRegular", "colGuardDuty", "colTotal"];
  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان (رندر): ${lang}`);

    const dataHtml = renderHtml("data");
    const dataT = toText(dataHtml);
    check(dataT.length > 300, `${lang}: صفحه رندر شد (${dataT.length} نویسه)`);
    check(!/payrollSummary\.|reports\.workerReport\.|common\.(cancel|delete|loading)/.test(dataHtml) && !dataT.includes("{{"), `${lang}: کلید خام/placeholder نشت نکرده`);
    for (const k of COLS) {
      const label = t(`payrollSummary.${k}`);
      check(countOf(dataHtml, `>${label}</th>`) === 2, `${lang}: سرستون «${k}» هم در جدول صفحه و هم در جدول خروجی تصویر است`);
    }
    const totalRowText = t("payrollSummary.totalRow", { count: ROWS.length });
    check(countOf(dataT, totalRowText) === 2, `${lang}: ردیف جمع کل دو بار (صفحه + خروجی تصویر)`);
    check(countOf(dataT, t("payrollSummary.exportTitle")) === 1, `${lang}: عنوان خروجی تصویر یک‌بار`);
    const range = getCurrentJalaliMonthRange();
    const rangeText = t("payrollSummary.dateRange", { from: toJalaliShort(range.from), to: toJalaliShort(range.to) });
    check(dataT.includes(`PROJX · ${rangeText}`), `${lang}: نام پروژه + بازهٔ تاریخ در خروجی تصویر`);
    check(dataT.includes(t("reports.workerReport.fromDateLabel")) && dataT.includes(t("reports.workerReport.toDateLabel")), `${lang}: برچسب‌های انتخابگر تاریخ ترجمه شده`);
    check(countOf(dataT, "WNAME-ONE") === 2 && countOf(dataT, "POS-TWO") === 2, `${lang}: نام و سمت نیروها (داده) دست‌نخورده در هر دو جدول`);
    check(countOf(dataT, "—") >= 2, `${lang}: دستمزد نگهبانی صفر با «—» نشان داده می‌شود`);
    check(!dataT.includes(t("payrollSummary.emptyTitle")), `${lang}: وقتی نیرو هست پیام «خالی» نیست`);

    const emptyHtml = renderHtml("empty");
    const emptyT = toText(emptyHtml);
    check(emptyT.includes(t("payrollSummary.emptyTitle")) && emptyT.includes(t("payrollSummary.emptyDesc")), `${lang}: بدون نیروی فعال: عنوان/توضیح خالی`);
    check(countOf(emptyHtml, `>${t("payrollSummary.exportTitle")}<`) === 0 && countOf(emptyHtml, `>${t("payrollSummary.colWorker")}</th>`) === 0, `${lang}: بدون نیرو: جدول و خروجی تصویر رندر نمی‌شود`);
    check(!/payrollSummary\./.test(emptyHtml), `${lang}: بدون نیرو: کلید خام نشت نکرده`);

    if (lang !== "fa") {
      check(!dataT.includes(i18n.getFixedT("fa")("payrollSummary.exportTitle")), `${lang}: صفحه عیناً فارسی نیست`);
    }
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      for (const [name, txt] of [["data", dataT], ["empty", emptyT]] as const) {
        let stripped: string = txt;
        for (const c of Object.values(CURRENCIES)) stripped = stripped.split(c.symbol).join(" ");
        const m = stripped.match(PERSIAN_ARABIC_RE);
        if (m) console.log("    متن فارسی باقی‌مانده:", stripped.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 80));
        check(!m, `${lang}/${name}: هیچ حرف فارسی/عربی هاردکد در رندر نیست (به‌جز نماد واحد پول)`);
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
