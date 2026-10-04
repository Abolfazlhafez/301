/**
 * تست i18n DailyReportSection (گزارش روزانه) در زبان‌های فعال (fa و en):
 *  - رندر واقعی SSR با کش react-query پیش‌پر: «داده‌دار» (با یادداشت)، «داده‌دار بدون تنظیمات/یادداشت» و «بدون نیرو»؛
 *    بخش مخفی صفحات A4 خروجی PDF (DailyReportWorkersPage، هنوز منتقل‌نشده و خارج از محدودهٔ این دور) از بررسی حذف می‌شود؛
 *  - پوشش ایستا برای بخش‌های وابسته به افکت/رویداد (دیالوگ‌های بسته، توست‌ها، نام فایل PDF): همهٔ کلیدهای dailyReport.* در کد
 *    استفاده شده‌اند، در fa و en هستند، placeholderها یکی‌اند و interpolation کار می‌کند؛
 *  - خروجی فارسی (متن‌ها و نام فایل PDF) با رفتار قبلی یکی است؛
 *  - کل فایل (بدون کامنت) حرف فارسی/عربی هاردکد ندارد.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { DailyReportSection } from "../../pages/reports/DailyReportSection";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { CURRENCIES, ENABLED_LANGUAGES } from "../../shared/i18n/languages";
import { PREF_KEYS, setPref } from "../../shared/storage/appPreferences";
import { getTodayIso } from "../../shared/utils/jalaliDate";
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

const TODAY = getTodayIso();

function makeReport(id: string, name: string, position: string, withDetails: boolean) {
  return {
    workerId: id,
    workerFullName: name,
    position,
    date: TODAY,
    checkIn: "08:00",
    checkOut: "17:00",
    totalAttendanceMinutes: 540,
    totalTimeLossMinutes: withDetails ? 30 : 0,
    totalBreakMinutes: withDetails ? 60 : 0,
    usefulMinutes: 450,
    dailyBaseSalary: 1000,
    hourlyRate: 100,
    payableSalary: 4500,
    guardDuty: { enabled: false, rateType: "hourly", rate: 0, shiftsCount: 0, totalMinutes: 0, payableSalary: 0, shifts: [] },
    timeLosses: withDetails ? [{ id: `${id}-tl`, startTime: "09:00", endTime: "09:30", durationMinutes: 30, reason: "REASON-LOSS", note: null }] : [],
    breakTimes: withDetails ? [{ id: `${id}-bt`, type: "lunch", typeLabel: "LABEL-BREAK", startTime: "12:00", endTime: "13:00", durationMinutes: 60, note: null }] : [],
  };
}

type Scenario = "data" | "bare" | "empty";

function renderVisibleHtml(scenario: Scenario): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rows = scenario === "empty" ? [] : [makeReport("w1", "WNAME-ONE", "POS-ONE", true), makeReport("w2", "WNAME-TWO", "POS-TWO", false)];
  qc.setQueryData(["daily-report-all", TODAY], rows);
  qc.setQueryData(["settings"], scenario === "data" ? { projectName: "PROJX", supervisorName: "SUP-ONE", projectLocation: "" } : {});
  qc.setQueryData(["daily-report-note", TODAY], scenario === "data" ? { supervisorNote: "NOTE-X" } : null);
  const html = renderToString(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(ThemeProvider, { theme }, createElement(ToastProvider, null, createElement(DailyReportSection)))
    )
  ).replace(/&#x27;|&#39;/g, "'");
  // بخش مخفی صفحات A4 (آخرین عنصر) از بررسی حذف می‌شود.
  // (با aria-hidden روی خود div پیدا می‌شود؛ نه با متن CSS که emotion قبل از عنصر درج می‌کند.)
  const hiddenAt = html.search(/<div[^>]*aria-hidden="true"/);
  if (hiddenAt === -1) return html;
  return html.slice(0, hiddenAt);
}

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  const src = readFileSync(new URL("../../pages/reports/DailyReportSection.tsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const faBundle = (i18n.getResourceBundle("fa", "common") as { dailyReport: Record<string, unknown> }).dailyReport;
  const flat = (o: Record<string, unknown>, pre = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? flat(v as Record<string, unknown>, `${pre}${k}.`) : [`${pre}${k}`]));
  // کلیدهای زیر dailyReport.pdf.* مال DailyReportWorkersPage‌اند و در تست خودش پوشش داده می‌شوند.
  const definedKeys = flat(faBundle).filter((k) => !k.startsWith("pdf.")).map((k) => `dailyReport.${k}`);
  const usedKeys = new Set([...code.matchAll(/"(dailyReport\.[\w.]+)"/g)].map((m) => m[1]));

  console.log("\n— پوشش ایستا");
  check(definedKeys.length === 27, `تعداد کلیدها (${definedKeys.length})`);
  check(definedKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای در dailyReport نیست");
  check([...usedKeys].every((k) => definedKeys.includes(k)), "هر کلید استفاده‌شده در کد تعریف شده است");
  check(!PERSIAN_ARABIC_RE.test(code), "هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده");
  check(/"common\.cancel"/.test(code) && /"common\.save"/.test(code) && /"reports\.workerReport\.exportingPdf"/.test(code), "کلیدهای مشترک موجود (انصراف/ذخیره/در حال ساخت PDF) دوباره استفاده شده‌اند");
  check(/`\$\{t\("dailyReport\.pdfFilePrefix"\)\}-\$\{date\}\.pdf`/.test(code), "نام فایل PDF از پیشوند i18n + تاریخ ساخته می‌شود");
  check(/t\("dailyReport\.supervisorLine", \{ name: settings\.supervisorName \}\)/.test(code), "«سرپرست: نام» یک جملهٔ کامل است (نه چسباندن تکه‌ها)");
  check((code.match(/t\("dailyReport\.detailLine", \{ label: /g) ?? []).length === 2, "سطر جزئیات اتلاف وقت و استراحت یک کلید کامل مشترک دارند");
  check(/t\("dailyReport\.projectInfoSaved"\)/.test(code) && /t\("dailyReport\.noteSaved"\)/.test(code), "هر دو توست ذخیره از i18n می‌آیند");
  check(/t\("dailyReport\.noteDialogTitle"\)/.test(code) && /t\("dailyReport\.noteDialogLabel"\)/.test(code) && /t\("dailyReport\.projectDialogTitle"\)/.test(code) && /t\("dailyReport\.projectNameLabel"\)/.test(code) && /t\("dailyReport\.supervisorNameLabel"\)/.test(code) && /t\("dailyReport\.projectLocationLabel"\)/.test(code), "متن‌های دو دیالوگ (بسته در SSR) از i18n می‌آیند");

  console.log("\n— ثبات خروجی فارسی (رفتار قبلی)");
  {
    const fa = i18n.getFixedT("fa");
    check(`${fa("dailyReport.pdfFilePrefix")}-2026-01-01.pdf` === "گزارش-روزانه-2026-01-01.pdf", "fa: نام فایل PDF همان قبلی");
    check(fa("dailyReport.supervisorLine", { name: "N" }) === "سرپرست: N", "fa: «سرپرست: N» همان قبلی");
    check(fa("dailyReport.detailLine", { label: "L", start: "09:00", end: "10:00" }) === "• L (09:00 تا 10:00)", "fa: سطر جزئیات همان قبلی");
    check(fa("dailyReport.projectInfoSaved") === "اطلاعات پروژه ذخیره شد." && fa("dailyReport.noteSaved") === "یادداشت سرپرست ذخیره شد.", "fa: متن توست‌ها همان قبلی");
    check(fa("dailyReport.emptyTitle") === "گزارشی برای این تاریخ وجود ندارد." && fa("dailyReport.emptyDesc") === "ابتدا نیروی فعال ثبت کنید.", "fa: متن حالت خالی همان قبلی");
    check(fa("dailyReport.downloadPdf") === "دانلود PDF گزارش روزانه" && fa("reports.workerReport.exportingPdf") === "در حال ساخت PDF...", "fa: متن دکمهٔ PDF (عادی/در حال ساخت) همان قبلی");
    check(fa("dailyReport.addNote") === "افزودن یادداشت سرپرست" && fa("dailyReport.editNote") === "ویرایش یادداشت سرپرست", "fa: متن دکمهٔ یادداشت همان قبلی");
    check(fa("dailyReport.summaryTitle") === "خلاصهٔ گزارش کار" && fa("dailyReport.timeLossDetails") === "جزئیات اتلاف وقت:" && fa("dailyReport.breakDetails") === "جزئیات استراحت مجاز:", "fa: عنوان‌های خلاصه و جزئیات همان قبلی");
    check(fa("dailyReport.projectDialogTitle") === "اطلاعات پروژه و سرپرست" && fa("dailyReport.projectNameLabel") === "نام پروژه/کارگاه" && fa("dailyReport.projectLocationLabel") === "محل پروژه (اختیاری)", "fa: متن دیالوگ اطلاعات پروژه همان قبلی");
  }

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان (ایستا): ${lang}`);
    check(definedKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${definedKeys.length} کلید موجود است`);
    check(definedKeys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    const interp: [string, Record<string, string | number>, string][] = [
      ["dailyReport.supervisorLine", { name: "NAME1" }, "NAME1"],
      ["dailyReport.detailLine", { label: "LBL1", start: "S1", end: "E1" }, "E1"],
    ];
    check(interp.every(([k, o, needle]) => { const v = t(k, o); return v.includes(needle) && !v.includes("{{"); }), `${lang}: interpolationها کار می‌کنند (${interp.length} کلید)`);
    const pdfName = sanitizeFilename(`${t("dailyReport.pdfFilePrefix")}-2026-01-01.pdf`);
    check(!/[\\/:*?"<>|]/.test(pdfName) && pdfName.endsWith(".pdf"), `${lang}: نام فایل PDF پس از پاک‌سازی مجاز و با پسوند درست است`);
    const labelKeys = ["timeLoss", "allowedBreak", "usefulTime", "finalSalary"];
    check(new Set(labelKeys.map((k) => t(`dailyReport.${k}`))).size === 4, `${lang}: چهار برچسب خلاصه متمایزند`);
    check(t("dailyReport.addNote") !== t("dailyReport.editNote"), `${lang}: «افزودن» و «ویرایش» یادداشت متمایزند`);
    if (lang !== "fa") {
      const same = definedKeys.filter((k) => t(k) === fa(k));
      check(same.length === 0, `${lang}: هیچ کلیدی عیناً فارسی نیست${same.length ? " (" + same.join(",") + ")" : ""}`);
    }
    if (LATIN_ONLY.has(lang)) {
      check(definedKeys.every((k) => !PERSIAN_ARABIC_RE.test(t(k))), `${lang}: هیچ حرف فارسی/عربی در ترجمه‌ها نیست`);
      check(/^[\x20-\x7E]+$/.test(t("dailyReport.pdfFilePrefix")), `${lang}: پیشوند نام فایل PDF لاتین ASCII است`);
    }
  }

  console.log("\n— رندر SSR");
  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان (رندر): ${lang}`);

    const dataHtml = renderVisibleHtml("data");
    const dataT = toText(dataHtml);
    check(dataT.length > 300, `${lang}: صفحه رندر شد (${dataT.length} نویسه)`);
    check(!/dailyReport\.|reports\.workerReport\.|common\.(cancel|save)/.test(dataHtml) && !dataT.includes("{{"), `${lang}: کلید خام/placeholder نشت نکرده`);
    check(dataT.includes("PROJX") && dataT.includes(t("dailyReport.supervisorLine", { name: "SUP-ONE" })), `${lang}: نام پروژه و «سرپرست: نام» نمایش داده می‌شود`);
    check(countOf(dataHtml, `aria-label="${t("dailyReport.editProjectInfoAria")}"`) === 1, `${lang}: aria-label ویرایش اطلاعات پروژه ترجمه شده`);
    check(dataT.includes(t("dailyReport.dateLabel")), `${lang}: برچسب تاریخ ترجمه شده`);
    check(dataT.includes(t("dailyReport.downloadPdf")), `${lang}: دکمهٔ دانلود PDF ترجمه شده`);
    check(dataT.includes(t("dailyReport.editNote")) && !dataT.includes(t("dailyReport.addNote")), `${lang}: با یادداشت موجود «ویرایش یادداشت» نشان داده می‌شود`);
    check(countOf(dataT, t("dailyReport.summaryTitle")) === 2, `${lang}: عنوان خلاصه برای هر دو نیرو`);
    for (const k of ["timeLoss", "allowedBreak", "usefulTime", "finalSalary"]) {
      check(countOf(dataHtml, `>${t(`dailyReport.${k}`)}<`) === 2, `${lang}: برچسب «${k}» برای هر دو نیرو`);
    }
    check(countOf(dataT, t("dailyReport.timeLossDetails")) === 1 && countOf(dataT, t("dailyReport.breakDetails")) === 1, `${lang}: بخش جزئیات فقط برای نیروی دارای اتلاف/استراحت`);
    check(dataT.includes(t("dailyReport.detailLine", { label: "REASON-LOSS", start: "09:00", end: "09:30" })), `${lang}: سطر جزئیات اتلاف وقت`);
    check(dataT.includes(t("dailyReport.detailLine", { label: "LABEL-BREAK", start: "12:00", end: "13:00" })), `${lang}: سطر جزئیات استراحت`);
    check(countOf(dataT, "WNAME-ONE") === 1 && countOf(dataT, "POS-TWO") === 1, `${lang}: نام و سمت نیروها (داده) دست‌نخورده`);
    check(!dataT.includes(t("dailyReport.emptyTitle")), `${lang}: وقتی نیرو هست پیام «خالی» نیست`);

    const bareT = toText(renderVisibleHtml("bare"));
    check(bareT.includes(t("dailyReport.noProject")) && bareT.includes(t("dailyReport.noSupervisor")), `${lang}: بدون تنظیمات: «پروژه‌ای ثبت نشده» و «سرپرست ثبت نشده»`);
    check(bareT.includes(t("dailyReport.addNote")) && !bareT.includes(t("dailyReport.editNote")), `${lang}: بدون یادداشت «افزودن یادداشت» نشان داده می‌شود`);

    const emptyT = toText(renderVisibleHtml("empty"));
    check(emptyT.includes(t("dailyReport.emptyTitle")) && emptyT.includes(t("dailyReport.emptyDesc")), `${lang}: بدون نیرو: عنوان/توضیح خالی`);
    check(!emptyT.includes(t("dailyReport.downloadPdf")) && !emptyT.includes(t("dailyReport.summaryTitle")), `${lang}: بدون نیرو: دکمه و خلاصه رندر نمی‌شود`);

    if (lang !== "fa") {
      check(!dataT.includes(i18n.getFixedT("fa")("dailyReport.downloadPdf")), `${lang}: صفحه عیناً فارسی نیست`);
    }
    if (LATIN_ONLY.has(lang)) {
      for (const [name, txt] of [["data", dataT], ["bare", bareT], ["empty", emptyT]] as const) {
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
