/**
 * تست i18n سه دیالوگ فرزند دستمزد در زبان‌های فعال (fa و en):
 *  WageAssignmentFormDialog (wageAssignmentForm.*)، WageCalculationHistoryDialog (wageHistory.*)،
 *  CalculationExplanationDialog (calcExplanation.*)
 *  - رندر واقعی SSR (تاریخچه با کش پیش‌پر، توضیح با/بدون مرحله و خطا، فرم افزودن/ویرایش)؛
 *  - بخش‌های وابسته به رویداد/افکت (toastها، ConfirmDialog بسته، منوی بازنشدهٔ روش‌ها، بخش مقادیر پیش‌فرض) ⇒ پوشش ایستا؛
 *  - خروجی فارسی با رفتار قبلی یکی است؛ کل فایل‌ها (بدون کامنت) حرف فارسی/عربی هاردکد ندارند.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { WageAssignmentFormDialog } from "../../widgets/wage-system/WageAssignmentFormDialog";
import { WageCalculationHistoryDialog } from "../../widgets/wage-system/WageCalculationHistoryDialog";
import { CalculationExplanationDialog } from "../../widgets/wage-system/CalculationExplanationDialog";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { ENABLED_LANGUAGES, getLanguageInfo } from "../../shared/i18n/languages";
import { PREF_KEYS, setPref } from "../../shared/storage/appPreferences";
import { formatCurrency } from "../../shared/utils/format";
import { toJalaliDisplay } from "../../shared/utils/jalaliDate";

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
function countOf(h: string, n: string): number {
  return n ? h.split(n).length - 1 : 0;
}
function placeholders(s: string): string {
  return (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(",");
}
function stripComments(path: string): string {
  const src = readFileSync(new URL(path, import.meta.url), "utf8");
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const LANGS: string[] = [...ENABLED_LANGUAGES];
const PERSIAN_ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_ONLY = new Set(["en"]);
const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });
const NS = ["wageAssignmentForm", "wageHistory", "calcExplanation"] as const;

const vars = [
  { key: "len", label: "VAR-LEN", unit: "UNIT-M", defaultValue: 0 },
  { key: "cnt", label: "VAR-CNT", unit: "UNIT-N", defaultValue: 0 },
];
const records = [
  { id: "r1", workerId: "w1", wageAssignmentId: "a1", date: "2026-01-05", variableValues: { len: 20, cnt: 3 }, payableAmount: 1500000, formulaSnapshot: "len*cnt*1000", note: "NOTE-ONE", createdAt: "2026-01-05T00:00:00Z" },
  { id: "r2", workerId: "w1", wageAssignmentId: "a1", date: "2026-01-06", variableValues: { len: 5 }, payableAmount: 500000, formulaSnapshot: "len*1000", note: null, createdAt: "2026-01-06T00:00:00Z" },
];

function wrapQc(child: unknown, qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return createElement(QueryClientProvider, { client: qc }, createElement(ThemeProvider, { theme }, createElement(ToastProvider, null, child as never)));
}
function renderHistory(scenario: "data" | "empty"): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["wage-calculations", "by-assignment", "a1"], scenario === "data" ? records : []);
  return renderToString(wrapQc(createElement(WageCalculationHistoryDialog, { open: true, wageAssignmentId: "a1", assignmentLabel: "ASSIGN-LBL", variableDefinitions: vars, onClose: () => {} }), qc)).replace(/&#x27;|&#39;/g, "'");
}
function renderExplain(kind: "steps" | "plain" | "zero" | "error"): string {
  return renderToString(
    createElement(
      ThemeProvider,
      { theme },
      createElement(CalculationExplanationDialog, {
        open: true,
        onClose: () => {},
        formulaText: "FORMULA-TXT",
        variables: vars,
        variableValues: kind === "zero" ? { len: 0, cnt: 0 } : { len: 20, cnt: 3 },
        steps: kind === "steps" ? [{ label: "STEP-ONE", value: 60 }] : [],
        finalAmount: 60000,
        error: kind === "error" ? "ERR-MSG" : null,
      })
    )
  ).replace(/&#x27;|&#39;/g, "'");
}
const worker = { id: "w1", firstName: "A", lastName: "B" } as never;
const method = { id: "m1", formula: { id: "f1", name: "M-NAME", description: "M-DESC", variables: vars }, isBuiltIn: false, createdAt: "", updatedAt: "" } as never;
function renderForm(existing: boolean): string {
  return renderToString(
    wrapQc(
      createElement(WageAssignmentFormDialog, {
        open: true,
        worker,
        jobType: { id: "j1", name: "JOB-X", suggestedWageMethodIds: ["m1"] } as never,
        wageMethods: [method],
        existing: existing ? ({ id: "a1", label: "EXIST-LBL", wageMethodId: "", defaultVariableValues: {} } as never) : null,
        onClose: () => {},
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

  const files = {
    wageAssignmentForm: stripComments("../../widgets/wage-system/WageAssignmentFormDialog.tsx"),
    wageHistory: stripComments("../../widgets/wage-system/WageCalculationHistoryDialog.tsx"),
    calcExplanation: stripComments("../../widgets/wage-system/CalculationExplanationDialog.tsx"),
  };
  const bundle = (ns: string) => Object.keys((i18n.getResourceBundle("fa", "common") as Record<string, Record<string, unknown>>)[ns]);
  const expectedCount: Record<string, number> = { wageAssignmentForm: 13, wageHistory: 10, calcExplanation: 10 };

  console.log("\n— پوشش ایستا");
  for (const ns of NS) {
    const code = files[ns];
    const defined = bundle(ns).map((k) => `${ns}.${k}`);
    const used = new Set([...code.matchAll(new RegExp(`"(${ns}\\.[\\w.]+)"`, "g"))].map((m) => m[1]));
    check(defined.length === expectedCount[ns], `${ns}: تعداد کلیدها (${defined.length})`);
    check(defined.every((k) => used.has(k)), `${ns}: هیچ کلید بلااستفاده‌ای نیست`);
    check([...used].every((k) => defined.includes(k)), `${ns}: هر کلید استفاده‌شده تعریف شده است`);
    check(!PERSIAN_ARABIC_RE.test(code), `${ns}: هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده`);
  }
  const f = files.wageAssignmentForm;
  check(/existing \? t\("wageAssignmentForm\.updated"\) : t\("wageAssignmentForm\.created"\)/.test(f), "فرم: هر دو توست از i18n می‌آیند");
  check(/t\("wageAssignmentForm\.suggestedHeader", \{ job: jobType\?\.name \?\? "" \}\)/.test(f) && /t\("wageAssignmentForm\.otherHeader"\)/.test(f), "فرم: سرتیترهای منوی روش‌ها (بسته در SSR) از i18n می‌آیند، نام شغل placeholder است");
  check(/t\("wageAssignmentForm\.defaultsTitle"\)/.test(f) && /t\("wageAssignmentForm\.defaultsHelp"\)/.test(f), "فرم: بخش مقادیر پیش‌فرض (وابسته به افکت) از i18n می‌آید");
  check(/mutation\.isPending \? t\("wageAssignmentForm\.saving"\) : t\("wageAssignmentForm\.save"\)/.test(f), "فرم: دکمهٔ ذخیره (عادی/در حال ذخیره) از i18n می‌آید");
  const h = files.wageHistory;
  check(/t\("wageHistory\.deleted"\)/.test(h) && /t\("wageHistory\.deleteTitle"\)/.test(h) && /confirmLabel=\{t\("common\.delete"\)\}/.test(h), "تاریخچه: توست حذف و ConfirmDialog (بسته در SSR) از i18n می‌آیند");
  check(/t\("wageHistory\.deleteConfirm", \{\s*amount: formatCurrency\(deletingRecord\.payableAmount\),\s*date: toJalaliDisplay\(deletingRecord\.date\),?\s*\}\)/.test(h), "تاریخچه: پیام تأیید حذف یک جملهٔ کامل با placeholder است");
  const e = files.calcExplanation;
  check(/i18n\.t\("calcExplanation\.summary", \{ parts: parts\.join\(i18n\.t\("calcExplanation\.summarySeparator"\)\) \}\)/.test(e) && /i18n\.t\("calcExplanation\.noValues"\)/.test(e), "توضیح: جملهٔ خلاصه یک کلید کامل با placeholder و جداکنندهٔ جدا (نه «،» هاردکد)");

  console.log("\n— ثبات خروجی فارسی (رفتار قبلی)");
  {
    const fa = i18n.getFixedT("fa");
    check(fa("wageAssignmentForm.titleAdd") === "افزودن آیتم دستمزد" && fa("wageAssignmentForm.titleEdit") === "ویرایش آیتم دستمزد" && fa("wageAssignmentForm.created") === "آیتم دستمزد ثبت شد." && fa("wageAssignmentForm.updated") === "آیتم دستمزد به‌روزرسانی شد.", "fa: فرم: عنوان‌ها و توست‌ها همان قبلی");
    check(fa("wageAssignmentForm.labelField") === "عنوان این آیتم" && fa("wageAssignmentForm.methodField") === "روش محاسبه" && fa("wageAssignmentForm.suggestedHeader", { job: "J" }) === "پیشنهادی برای شغل «J»" && fa("wageAssignmentForm.otherHeader") === "سایر روش‌ها", "fa: فرم: فیلدها و سرتیترها همان قبلی");
    check(fa("wageAssignmentForm.defaultsTitle") === "مقادیر پیش‌فرض این نیرو" && fa("wageAssignmentForm.saving") === "در حال ذخیره..." && fa("wageAssignmentForm.save") === "ذخیره" && fa("common.cancel") === "انصراف", "fa: فرم: بخش پیش‌فرض‌ها و دکمه‌ها همان قبلی");
    check(fa("wageHistory.title") === "تاریخچه محاسبات" && fa("wageHistory.totalLine", { n: 4 }) === "مجموع 4 محاسبه" && fa("wageHistory.note", { note: "N" }) === "یادداشت: N" && fa("wageHistory.viewExplanation") === "مشاهده نحوهٔ محاسبه", "fa: تاریخچه: عنوان/جمع/یادداشت/دکمه همان قبلی");
    check(fa("wageHistory.deleteConfirm", { amount: "A", date: "D" }) === "آیا از حذف این محاسبه (A — D) مطمئن هستید؟ این عملیات قابل بازگشت نیست." && fa("wageHistory.deleted") === "رکورد محاسبه حذف شد." && fa("wageHistory.deleteTitle") === "حذف رکورد محاسبه", "fa: تاریخچه: متن حذف همان قبلی");
    check(fa("calcExplanation.summary", { parts: "P" }) === "مقادیر واردشده — P." && fa("calcExplanation.summarySeparator") === "، " && fa("calcExplanation.noValues") === "مقداری برای متغیرها وارد نشده است." && fa("calcExplanation.gotIt") === "متوجه شدم", "fa: توضیح: خلاصه/جداکننده/دکمه همان قبلی");
  }

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان (ایستا): ${lang}`);
    for (const ns of NS) {
      const keys = bundle(ns).map((k) => `${ns}.${k}`);
      check(keys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}/${ns}: همهٔ ${keys.length} کلید موجود است`);
      check(keys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}/${ns}: placeholderها با fa یکی است`);
      if (lang !== "fa") {
        const same = keys.filter((k) => t(k) === fa(k));
        check(same.length === 0, `${lang}/${ns}: هیچ کلیدی عیناً فارسی نیست${same.length ? " (" + same.join(",") + ")" : ""}`);
      }
      if (LATIN_ONLY.has(lang)) check(keys.every((k) => !PERSIAN_ARABIC_RE.test(t(k))), `${lang}/${ns}: هیچ حرف فارسی/عربی در ترجمه‌ها نیست`);
    }
    check(t("wageHistory.deleteConfirm", { amount: "AMT1", date: "DAT1" }).includes("AMT1") && t("wageHistory.deleteConfirm", { amount: "AMT1", date: "DAT1" }).includes("DAT1") && t("wageAssignmentForm.suggestedHeader", { job: "JOB1" }).includes("JOB1") && t("wageHistory.totalLine", { n: 77 }).includes("77") && t("wageHistory.note", { note: "NT1" }).includes("NT1") && t("calcExplanation.summary", { parts: "PRT1" }).includes("PRT1"), `${lang}: interpolationها کار می‌کنند`);
    check(t("wageAssignmentForm.saving") !== t("wageAssignmentForm.save") && t("wageAssignmentForm.titleAdd") !== t("wageAssignmentForm.titleEdit") && t("wageAssignmentForm.created") !== t("wageAssignmentForm.updated"), `${lang}: جفت‌های «افزودن/ویرایش»، «ثبت/به‌روزرسانی»، «ذخیره/در حال ذخیره» متمایزند`);
  }

  console.log("\n— رندر SSR");
  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    setPref(PREF_KEYS.currency, getLanguageInfo(lang).defaultCurrency);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان (رندر): ${lang}`);

    // تاریخچه
    const hHtml = renderHistory("data");
    const hT = toText(hHtml);
    check(hT.length > 200 && !/wageHistory\.|common\.(close|delete)/.test(hHtml) && !hT.includes("{{"), `${lang}: تاریخچه رندر شد و کلید خام/placeholder نشت نکرده`);
    check(hT.includes(t("wageHistory.title")) && hT.includes("ASSIGN-LBL"), `${lang}: تاریخچه: عنوان و برچسب آیتم`);
    check(hT.includes(t("wageHistory.totalLine", { n: 2 })) && hT.includes(formatCurrency(2000000)), `${lang}: تاریخچه: «مجموع n محاسبه» و جمع مبلغ`);
    check(hT.includes(t("wageHistory.note", { note: "NOTE-ONE" })) && countOf(hT, t("wageHistory.note", { note: "" }).trim()) === 1, `${lang}: تاریخچه: یادداشت فقط برای رکوردی که یادداشت دارد`);
    check(countOf(hT, t("wageHistory.viewExplanation")) === 2 && countOf(hHtml, `>${t("common.delete")}<`) === 2, `${lang}: تاریخچه: دکمه‌های «مشاهده نحوهٔ محاسبه» و «حذف» برای هر دو رکورد`);
    check(countOf(hHtml, `aria-label="${t("common.close")}"`) === 1, `${lang}: تاریخچه: aria-label بستن`);
    check(hT.includes("VAR-LEN: 20 UNIT-M") && hT.includes("VAR-CNT: 3 UNIT-N") && hT.includes(toJalaliDisplay("2026-01-05")), `${lang}: تاریخچه: داده‌ها (برچسب/واحد متغیر، تاریخ) دست‌نخورده`);
    const hE = toText(renderHistory("empty"));
    check(hE.includes(t("wageHistory.emptyTitle")) && hE.includes(t("wageHistory.emptyDesc")) && !hE.includes(t("wageHistory.totalLine", { n: 0 })), `${lang}: تاریخچه: حالت خالی`);

    // توضیح محاسبه
    const parts = `VAR-LEN: 20 UNIT-M${t("calcExplanation.summarySeparator")}VAR-CNT: 3 UNIT-N`;
    const exHtml = renderExplain("steps");
    const ex = toText(exHtml);
    check(!/calcExplanation\.|common\.close/.test(exHtml) && !ex.includes("{{"), `${lang}: توضیح: کلید خام/placeholder نشت نکرده`);
    check(ex.includes(t("calcExplanation.title")) && ex.includes(t("calcExplanation.explanationLabel")) && ex.includes(t("calcExplanation.valuesLabel")) && ex.includes(t("calcExplanation.formulaLabel")) && ex.includes(t("calcExplanation.resultLabel")), `${lang}: توضیح: عنوان و برچسب بخش‌ها`);
    check(ex.includes(t("calcExplanation.summary", { parts: parts.replace(/\s+/g, " ") })), `${lang}: توضیح: جملهٔ خلاصه با جداکنندهٔ زبان (${JSON.stringify(t("calcExplanation.summarySeparator"))})`);
    check(ex.includes(t("calcExplanation.stepsLabel")) && ex.includes("STEP-ONE") && !toText(renderExplain("plain")).includes(t("calcExplanation.stepsLabel")), `${lang}: توضیح: «مراحل محاسبه» فقط وقتی مرحله هست`);
    check(ex.includes("FORMULA-TXT") && ex.includes(formatCurrency(60000)) && ex.includes(t("calcExplanation.gotIt")) && countOf(exHtml, `aria-label="${t("common.close")}"`) === 1, `${lang}: توضیح: فرمول (داده)، نتیجه، دکمهٔ «متوجه شدم»، aria بستن`);
    const zero = toText(renderExplain("zero"));
    check(zero.includes(t("calcExplanation.noValues")) && !zero.includes(t("calcExplanation.summary", { parts: "@@" }).split("@@")[0].trim()), `${lang}: توضیح: همهٔ مقادیر صفر ⇒ «مقداری وارد نشده»`);
    const err = toText(renderExplain("error"));
    check(err.includes("ERR-MSG") && !err.includes(t("calcExplanation.valuesLabel")) && err.includes(t("calcExplanation.gotIt")), `${lang}: توضیح: حالت خطا فقط پیام را نشان می‌دهد`);

    // فرم افزودن/ویرایش
    const addHtml = renderForm(false);
    const add = toText(addHtml);
    const editHtml = renderForm(true);
    const edit = toText(editHtml);
    check(!/wageAssignmentForm\.|common\.(close|cancel)/.test(addHtml) && !add.includes("{{"), `${lang}: فرم: کلید خام/placeholder نشت نکرده`);
    check(add.includes(t("wageAssignmentForm.titleAdd")) && !add.includes(t("wageAssignmentForm.titleEdit")), `${lang}: فرم افزودن: عنوان «افزودن»`);
    check(edit.includes(t("wageAssignmentForm.titleEdit")) && !edit.includes(t("wageAssignmentForm.titleAdd")), `${lang}: فرم ویرایش: عنوان «ویرایش»`);
    check(add.includes(t("wageAssignmentForm.labelField")) && addHtml.includes(`placeholder="${t("wageAssignmentForm.labelPlaceholder")}"`) && add.includes(t("wageAssignmentForm.methodField")), `${lang}: فرم: فیلد عنوان، placeholder و فیلد روش`);
    check(add.includes(t("wageAssignmentForm.save")) && add.includes(t("common.cancel")) && !add.includes(t("wageAssignmentForm.saving")) && countOf(addHtml, `aria-label="${t("common.close")}"`) === 1, `${lang}: فرم: دکمه‌ها و aria بستن (حالت عادی)`);
    check(/Mui-disabled/.test(addHtml), `${lang}: فرم خالی: دکمهٔ ذخیره غیرفعال است`);

    if (lang !== "fa") {
      const fa = i18n.getFixedT("fa");
      check(!hT.includes(fa("wageHistory.title")) && !ex.includes(fa("calcExplanation.title")) && !add.includes(fa("wageAssignmentForm.save")), `${lang}: صفحه‌ها عیناً فارسی نیستند`);
    }
    if (LATIN_ONLY.has(lang)) {
      for (const [name, txt] of [["history", hT], ["history-empty", hE], ["explain", ex], ["explain-zero", zero], ["explain-error", err], ["form-add", add], ["form-edit", edit]] as const) {
        const m = txt.match(PERSIAN_ARABIC_RE);
        if (m) console.log("    متن فارسی باقی‌مانده:", txt.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 80));
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
