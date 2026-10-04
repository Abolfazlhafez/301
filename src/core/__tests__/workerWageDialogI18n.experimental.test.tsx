/**
 * تست i18n WorkerWageDialog (دستمزد نیرو + دیالوگ اجرای محاسبه) در زبان‌های فعال (fa و en):
 *  - رندر واقعی SSR با کش react-query پیش‌پر: دیالوگ اصلی (با آیتم‌های فعال/غیرفعال و روش ناشناخته، و حالت خالی)
 *    و RunCalculationDialog (روش «دقیقه‌ای» با پر شدن خودکار، پیش‌نمایش موفق، و پیش‌نمایش دارای خطا)؛
 *  - پوشش ایستا برای بخش‌های وابسته به رویداد/افکت (توست‌ها، ConfirmDialog بسته، متن حالت ثبت‌در‌حال‌انجام)؛
 *  - خروجی فارسی با رفتار قبلی یکی است؛
 *  - کل فایل (بدون کامنت) حرف فارسی/عربی هاردکد ندارد.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { RunCalculationDialog, WorkerWageDialog } from "../../widgets/wage-system/WorkerWageDialog";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { CURRENCIES, ENABLED_LANGUAGES } from "../../shared/i18n/languages";
import { PREF_KEYS, setPref } from "../../shared/storage/appPreferences";
import { getTodayIso, toJalaliDisplay } from "../../shared/utils/jalaliDate";

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
const worker = { id: "w1", firstName: "FIRST-N", lastName: "LAST-N", jobTypeId: "jt1" } as never;
const jobTypes = [{ id: "jt1", name: "JOBNAME-X" }];
const methods = [
  { id: "m-known", formula: { name: "METHOD-NAME-A", variables: [{ key: "rate", label: "VAR-LABEL", unit: "VAR-UNIT", defaultValue: 5 }] } },
  { id: "wm-per-minute", formula: { name: "METHOD-PM", variables: [{ key: "minutes", label: "VAR-MIN", unit: "UNIT-MIN", defaultValue: 0 }] } },
];
const assignments = [
  { id: "a1", workerId: "w1", wageMethodId: "m-known", label: "ASSIGN-ACTIVE", defaultVariableValues: {}, isActive: true },
  { id: "a2", workerId: "w1", wageMethodId: "m-missing", label: "ASSIGN-INACTIVE", defaultVariableValues: {}, isActive: false },
];

function renderMain(scenario: "data" | "empty"): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["wage-assignments", "w1"], scenario === "data" ? assignments : []);
  qc.setQueryData(["wage-methods"], methods);
  qc.setQueryData(["job-types"], jobTypes);
  return renderToString(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        ThemeProvider,
        { theme },
        createElement(ToastProvider, null, createElement(WorkerWageDialog, { open: true, worker, onClose: () => {} }))
      )
    )
  ).replace(/&#x27;|&#39;/g, "'");
}

function renderRun(scenario: "perMinute" | "error"): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const methodId = scenario === "perMinute" ? "wm-per-minute" : "m-known";
  qc.setQueryData(["wage-method", methodId], methods.find((m) => m.id === methodId));
  qc.setQueryData(["daily-report", "w1", TODAY], { usefulMinutes: 123 });
  qc.setQueryData(
    ["wage-preview", "a1", {}],
    scenario === "perMinute" ? { value: 4567, formulaText: "F", steps: [], error: null } : { value: 0, formulaText: "", steps: [], error: "PREVIEW-ERR" }
  );
  return renderToString(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        ThemeProvider,
        { theme },
        createElement(
          ToastProvider,
          null,
          createElement(RunCalculationDialog, {
            open: true,
            worker,
            assignmentId: "a1",
            assignmentLabel: "ASSIGN-ACTIVE",
            methodId,
            defaultVariableValues: {},
            onClose: () => {},
          })
        )
      )
    )
  ).replace(/&#x27;|&#39;/g, "'");
}

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  const src = readFileSync(new URL("../../widgets/wage-system/WorkerWageDialog.tsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const faBundle = (i18n.getResourceBundle("fa", "common") as { wageDialog: Record<string, unknown> }).wageDialog;
  const definedKeys = Object.keys(faBundle).map((k) => `wageDialog.${k}`);
  const usedKeys = new Set([...code.matchAll(/"(wageDialog\.[\w.]+)"/g)].map((m) => m[1]));

  console.log("\n— پوشش ایستا");
  check(definedKeys.length === 23, `تعداد کلیدها (${definedKeys.length})`);
  check(definedKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای در wageDialog نیست");
  check([...usedKeys].every((k) => definedKeys.includes(k)), "هر کلید استفاده‌شده در کد تعریف شده است");
  check(!PERSIAN_ARABIC_RE.test(code), "هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده");
  check(/"common\.close"/.test(code) && /"common\.delete"/.test(code) && /"common\.cancel"/.test(code), "کلیدهای مشترک موجود (بستن/حذف/انصراف) دوباره استفاده شده‌اند");
  check(countOf(code, 't("common.close")') === 2, "aria-label بستن در هر دو دیالوگ ترجمه می‌شود");
  check(/t\("wageDialog\.itemDeleted"\)/.test(code) && /t\("wageDialog\.calcSaved"\)/.test(code), "هر دو توست از i18n می‌آیند");
  check(/t\("wageDialog\.deleteConfirm", \{ label: deletingAssignment\.label \}\)/.test(code), "پیام تأیید حذف یک جملهٔ کامل با placeholder است (نه چسباندن تکه‌ها)");
  check(/t\("wageDialog\.deleteTitle"\)/.test(code) && /confirmLabel=\{t\("common\.delete"\)\}/.test(code), "ConfirmDialog (بسته در SSR) از i18n می‌آید");
  check(/saveMutation\.isPending \? t\("wageDialog\.saving"\) : t\("wageDialog\.saveCalc"\)/.test(code), "متن دکمهٔ ثبت (عادی/در حال ثبت) از i18n می‌آید");
  check(/t\("wageDialog\.usefulTimeHint", \{ date: toJalaliDisplay\(date\), minutes: dailyReport\.usefulMinutes \}\)/.test(code), "پیام «زمان مفید واقعی» یک جملهٔ کامل است و تاریخ شمسی دست‌نخورده می‌ماند");
  check(/t\("wageDialog\.unknownMethod"\)/.test(code), "«نامشخص» (روش حذف‌شده) از i18n می‌آید");

  console.log("\n— ثبات خروجی فارسی (رفتار قبلی)");
  {
    const fa = i18n.getFixedT("fa");
    check(fa("wageDialog.title", { name: "N" }) === "دستمزد N" && fa("wageDialog.jobLine", { job: "J" }) === "شغل: J", "fa: عنوان و خط شغل همان قبلی");
    check(fa("wageDialog.addItem") === "افزودن آیتم دستمزد" && fa("wageDialog.emptyTitle") === "هنوز آیتم دستمزدی ثبت نشده", "fa: دکمهٔ افزودن و عنوان حالت خالی همان قبلی");
    check(fa("wageDialog.emptyDesc") === "با دکمهٔ بالا یک روش پرداخت برای این نیرو تعریف کنید — مثلاً «دیوارچینی → مترمربعی».", "fa: توضیح حالت خالی همان قبلی");
    check(fa("wageDialog.methodLine", { method: "M" }) === "روش پرداخت: M" && fa("wageDialog.unknownMethod") === "نامشخص" && fa("wageDialog.inactive") === "غیرفعال", "fa: خط روش پرداخت/نامشخص/غیرفعال همان قبلی");
    check(fa("wageDialog.calculate") === "محاسبه" && fa("wageDialog.history") === "تاریخچه" && fa("wageDialog.edit") === "ویرایش" && fa("common.delete") === "حذف", "fa: دکمه‌های هر آیتم همان قبلی");
    check(fa("wageDialog.itemDeleted") === "آیتم دستمزد حذف شد." && fa("wageDialog.calcSaved") === "محاسبه ثبت شد.", "fa: متن توست‌ها همان قبلی");
    check(fa("wageDialog.deleteTitle") === "حذف آیتم دستمزد" && fa("wageDialog.deleteConfirm", { label: "L" }) === "آیا از حذف «L» مطمئن هستید؟ سابقهٔ محاسبات قبلی این آیتم حذف نمی‌شود، فقط دیگر امکان محاسبهٔ جدید با آن نخواهد بود.", "fa: متن ConfirmDialog همان قبلی");
    check(fa("wageDialog.calcTitle", { label: "L" }) === "محاسبه — L" && fa("wageDialog.usefulTimeHint", { date: "D", minutes: 5 }) === "زمان مفید واقعی D: 5 دقیقه (خودکار پر شد، قابل تغییر است)", "fa: عنوان دیالوگ محاسبه و پیام زمان مفید همان قبلی");
    check(fa("wageDialog.dateLabel") === "تاریخ" && fa("wageDialog.noteLabel") === "یادداشت (اختیاری)" && fa("wageDialog.computedAmount") === "مبلغ محاسبه‌شده" && fa("wageDialog.viewExplanation") === "مشاهده نحوهٔ محاسبه", "fa: برچسب‌های فرم محاسبه همان قبلی");
    check(fa("wageDialog.saving") === "در حال ثبت..." && fa("wageDialog.saveCalc") === "ثبت محاسبه", "fa: متن دکمهٔ ثبت همان قبلی");
  }

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان (ایستا): ${lang}`);
    check(definedKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${definedKeys.length} کلید موجود است`);
    check(definedKeys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    const interp: [string, Record<string, string | number>, string][] = [
      ["wageDialog.title", { name: "NAME1" }, "NAME1"],
      ["wageDialog.jobLine", { job: "JOB1" }, "JOB1"],
      ["wageDialog.methodLine", { method: "METH1" }, "METH1"],
      ["wageDialog.deleteConfirm", { label: "LBL1" }, "LBL1"],
      ["wageDialog.calcTitle", { label: "LBL2" }, "LBL2"],
      ["wageDialog.usefulTimeHint", { date: "DATE1", minutes: 987 }, "987"],
    ];
    check(interp.every(([k, o, needle]) => { const v = t(k, o); return v.includes(needle) && !v.includes("{{"); }), `${lang}: interpolationها کار می‌کنند (${interp.length} کلید)`);
    check(t("wageDialog.usefulTimeHint", { date: "DATE1", minutes: 987 }).includes("DATE1"), `${lang}: تاریخ در پیام زمان مفید می‌آید`);
    check(new Set(["calculate", "history", "edit"].map((k) => t(`wageDialog.${k}`))).size === 3, `${lang}: سه دکمهٔ هر آیتم متمایزند`);
    check(t("wageDialog.saving") !== t("wageDialog.saveCalc"), `${lang}: «در حال ثبت» و «ثبت محاسبه» متمایزند`);
    if (lang !== "fa") {
      const same = definedKeys.filter((k) => t(k) === fa(k));
      check(same.length === 0, `${lang}: هیچ کلیدی عیناً فارسی نیست${same.length ? " (" + same.join(",") + ")" : ""}`);
    }
    if (LATIN_ONLY.has(lang)) {
      check(definedKeys.every((k) => !PERSIAN_ARABIC_RE.test(t(k))), `${lang}: هیچ حرف فارسی/عربی در ترجمه‌ها نیست`);
    }
  }

  console.log("\n— رندر SSR");
  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان (رندر): ${lang}`);

    const mainHtml = renderMain("data");
    const mainT = toText(mainHtml);
    check(mainT.length > 200, `${lang}: دیالوگ اصلی رندر شد (${mainT.length} نویسه)`);
    check(!/wageDialog\.|common\.(close|delete|cancel)/.test(mainHtml) && !mainT.includes("{{"), `${lang}: کلید خام/placeholder نشت نکرده`);
    check(mainT.includes(t("wageDialog.title", { name: "FIRST-N LAST-N" })), `${lang}: عنوان با نام نیرو`);
    check(mainT.includes(t("wageDialog.jobLine", { job: "JOBNAME-X" })), `${lang}: خط شغل`);
    check(mainT.includes(t("wageDialog.addItem")), `${lang}: دکمهٔ افزودن آیتم`);
    check(countOf(mainHtml, `aria-label="${t("common.close")}"`) === 1, `${lang}: aria-label بستن ترجمه شده`);
    check(mainT.includes(t("wageDialog.methodLine", { method: "METHOD-NAME-A" })), `${lang}: خط روش پرداخت با نام روش (داده)`);
    check(mainT.includes(t("wageDialog.methodLine", { method: t("wageDialog.unknownMethod") })), `${lang}: روش حذف‌شده «نامشخص» نشان داده می‌شود`);
    check(countOf(mainT, t("wageDialog.inactive")) === 1, `${lang}: برچسب «غیرفعال» فقط برای آیتم غیرفعال`);
    for (const k of ["history", "edit"]) {
      check(countOf(mainHtml, `>${t(`wageDialog.${k}`)}<`) === 2, `${lang}: دکمهٔ «${k}» برای هر دو آیتم`);
    }
    check(countOf(mainHtml, `>${t("wageDialog.calculate")}<`) === 2 && countOf(mainHtml, `>${t("common.delete")}<`) === 2, `${lang}: دکمه‌های «محاسبه» و «حذف» برای هر دو آیتم`);
    check(countOf(mainT, "ASSIGN-ACTIVE") === 1 && countOf(mainT, "ASSIGN-INACTIVE") === 1, `${lang}: عنوان آیتم‌ها (داده) دست‌نخورده`);
    check(!mainT.includes(t("wageDialog.emptyTitle")), `${lang}: وقتی آیتم هست پیام «خالی» نیست`);

    const emptyT = toText(renderMain("empty"));
    check(emptyT.includes(t("wageDialog.emptyTitle")) && emptyT.includes(t("wageDialog.emptyDesc")), `${lang}: بدون آیتم: عنوان/توضیح خالی`);
    check(!emptyT.includes(t("wageDialog.calculate")) && !emptyT.includes(t("wageDialog.inactive")), `${lang}: بدون آیتم: دکمهٔ آیتم رندر نمی‌شود`);

    const pmHtml = renderRun("perMinute");
    const pmT = toText(pmHtml);
    check(pmT.includes(t("wageDialog.calcTitle", { label: "ASSIGN-ACTIVE" })), `${lang}: عنوان دیالوگ محاسبه`);
    check(countOf(pmHtml, `aria-label="${t("common.close")}"`) === 1, `${lang}: aria-label بستن در دیالوگ محاسبه`);
    check(pmT.includes(t("wageDialog.usefulTimeHint", { date: toJalaliDisplay(TODAY), minutes: 123 })), `${lang}: روش دقیقه‌ای: پیام زمان مفید واقعی (با تاریخ و دقیقه)`);
    check(pmT.includes(t("wageDialog.dateLabel")) && pmT.includes(t("wageDialog.noteLabel")), `${lang}: برچسب‌های تاریخ و یادداشت`);
    check(pmT.includes("VAR-MIN (UNIT-MIN)"), `${lang}: برچسب متغیر فرمول (داده) دست‌نخورده`);
    check(pmT.includes(t("wageDialog.computedAmount")) && pmT.includes(t("wageDialog.viewExplanation")), `${lang}: کادر مبلغ و دکمهٔ «نحوهٔ محاسبه»`);
    check(pmT.includes(t("wageDialog.saveCalc")) && pmT.includes(t("common.cancel")) && !pmT.includes(t("wageDialog.saving")), `${lang}: دکمه‌های ثبت و انصراف (حالت عادی)`);

    const errHtml = renderRun("error");
    const errT = toText(errHtml);
    check(!errT.includes(t("wageDialog.usefulTimeHint", { date: toJalaliDisplay(TODAY), minutes: 123 })), `${lang}: روش غیر دقیقه‌ای: پیام زمان مفید نیست`);
    check(errT.includes("PREVIEW-ERR") && !errT.includes(t("wageDialog.computedAmount")) && !errT.includes(t("wageDialog.viewExplanation")), `${lang}: پیش‌نمایش دارای خطا: خطا نشان داده می‌شود و کادر مبلغ نه`);

    if (lang !== "fa") {
      check(!mainT.includes(i18n.getFixedT("fa")("wageDialog.addItem")) && !pmT.includes(i18n.getFixedT("fa")("wageDialog.saveCalc")), `${lang}: صفحه عیناً فارسی نیست`);
    }
    if (LATIN_ONLY.has(lang)) {
      for (const [name, txt] of [["main", mainT], ["empty", emptyT], ["perMinute", pmT], ["error", errT]] as const) {
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
