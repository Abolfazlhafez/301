/**
 * تست i18n WorkerAccountSection (حساب نیرو) در هر ۸ زبان:
 *  - رندر واقعی SSR با کش react-query پیش‌پر (fixedWorkerId): مانده مثبت (با همهٔ ردیف‌های خلاصه و نگهبانی جدا)، مانده منفی (نگهبانی ادغام‌شده)، مانده صفر، و حالت «انتخاب نیرو»؛
 *  - پوشش ایستا برای بخش‌های وابسته به رویداد (دیالوگ تسویه، دو ConfirmDialog، توست‌ها، متن‌های ذخیره‌شده در دفتر حساب، سرستون‌ها و نام فایل خروجی):
 *    همهٔ کلیدهای workerAccount.* در کد استفاده شده‌اند، در ۸ زبان هستند، placeholderها با fa یکی‌اند و interpolation کار می‌کند؛
 *  - کل فایل (بدون کامنت) حرف فارسی/عربی هاردکد ندارد و از ثابت فارسی LEDGER_ENTRY_TYPE_LABELS استفاده نمی‌کند.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { WorkerAccountSection } from "../../pages/reports/WorkerAccountSection";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { CURRENCIES, ENABLED_LANGUAGES } from "../../shared/i18n/languages";
import { PREF_KEYS, setPref } from "../../shared/storage/appPreferences";
import { getTodayIso } from "../../shared/utils/jalaliDate";

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

const LANGS: string[] = [...ENABLED_LANGUAGES]; // فقط زبان‌های فعال (فعلاً fa و en)
const PERSIAN_ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_CYRILLIC_ONLY = new Set(["en", "tr", "ru"]);
const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });

function placeholders(s: string): string {
  return (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(",");
}

const now = "2026-01-01T00:00:00.000Z";
const TODAY = getTodayIso();
const WORKER = { id: "w1", projectId: "p1", firstName: "WFIRST", lastName: "WLAST", avatarPhotoId: null };
const mkEntry = (id: string, type: string, amount: number, description: string | null) => ({
  id, projectId: "p1", workerId: "w1", type, amount, date: "2026-01-02", description, createdAt: now, updatedAt: now,
});
const base = {
  workerId: "w1", workerFullName: "WFIRST WLAST", sinceDate: "2026-01-01", lastSettlementDate: "2025-12-01",
  totalEarned: 5000, totalGuardDutyEarned: 700, guardDutyMerged: false, totalAdvances: 1000, totalDeductions: 300, totalCredits: 200,
  balance: 3900, entries: [mkEntry("e1", "advance", 1000, "NOTE-ADV"), mkEntry("e2", "deduction", 300, null), mkEntry("e3", "credit", 200, null)],
};
const SCENARIOS = {
  positive: base,
  negative: { ...base, balance: -450, guardDutyMerged: true, lastSettlementDate: null, totalCredits: 0, entries: [mkEntry("e4", "settlement", 1, null)] },
  zero: { ...base, balance: 0, totalGuardDutyEarned: 0, totalAdvances: 0, totalDeductions: 0, totalCredits: 0, entries: [] },
};

function renderHtml(scenario: keyof typeof SCENARIOS | "picker"): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["workers"], [WORKER]);
  if (scenario !== "picker") qc.setQueryData(["worker-balance", "w1", TODAY], SCENARIOS[scenario]);
  return renderToString(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        ThemeProvider,
        { theme },
        createElement(ToastProvider, null, createElement(WorkerAccountSection, (scenario === "picker" ? {} : { fixedWorkerId: "w1" }) as never))
      )
    )
  ).replace(/&#x27;|&#39;/g, "'");
}

// واژه‌هایی که در این زبان‌ها با فارسی املای یکسان دارند (واژهٔ مشترک، نه ترجمه‌نشدن).
const SHARED_WITH_FA: Record<string, string[]> = {
  ar: ["workerAccount.fileBase"],
  ur: ["workerAccount.csvDate"],
  ps: ["workerAccount.deductions"],
};

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  const src = readFileSync(new URL("../../pages/reports/WorkerAccountSection.tsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const faBundle = (i18n.getResourceBundle("fa", "common") as { workerAccount: Record<string, unknown> }).workerAccount;
  const flat = (o: Record<string, unknown>, pre = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? flat(v as Record<string, unknown>, `${pre}${k}.`) : [`${pre}${k}`]));
  const definedKeys = flat(faBundle).map((k) => `workerAccount.${k}`);
  const staticUsed = new Set([...code.matchAll(/"(workerAccount\.[\w.]+)"/g)].map((m) => m[1]));
  const dynamicLedger = /t\(`workerAccount\.ledgerType\.\$\{e\.type\}`\)/.test(code) && /t\(`workerAccount\.ledgerType\.\$\{entry\.type\}`\)/.test(code);
  const ledgerKeys = definedKeys.filter((k) => k.startsWith("workerAccount.ledgerType."));
  const usedKeys = new Set([...staticUsed, ...(dynamicLedger ? ledgerKeys : [])]);

  console.log("\n— پوشش ایستا");
  check(definedKeys.length === 57, `تعداد کلیدها (${definedKeys.length})`);
  check(definedKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای در workerAccount نیست");
  check([...staticUsed].every((k) => definedKeys.includes(k)), "هر کلید استفاده‌شده در کد تعریف شده است");
  check(dynamicLedger, "نوع تراکنش (لیست و CSV) از workerAccount.ledgerType.* می‌آید");
  check(!PERSIAN_ARABIC_RE.test(code), "هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده");
  check(!/LEDGER_ENTRY_TYPE_LABELS/.test(code), "برچسب نوع تراکنش از ثابت فارسی entity نمی‌آید");
  check((code.match(/exportFileBase/g) ?? []).length >= 5 && !/`حساب|"حساب/.test(code), "نام فایل‌های خروجی (۴ مسیر) از یک پایهٔ i18n می‌آیند");
  check(!/const headers = \[/.test(code) && (code.match(/csvHeaders/g) ?? []).length >= 3, "سرستون‌های CSV از کلیدهای i18n و یک تعریف مشترک می‌آیند");
  check(/t\(balance\.balance > 0 \? "workerAccount\.settleDescPay" : "workerAccount\.settleDescReceive"/.test(code), "متن دیالوگ تسویه یک جملهٔ کامل است (نه چسباندن تکه‌ها)");
  check(/guardDutyMerged \? t\("workerAccount\.guardDutyMerged"\) : t\("workerAccount\.guardDutySeparate"\)/.test(code), "برچسب نگهبانی دو جملهٔ کامل است (نه چسباندن تکه‌ها)");
  check(/title:\s*\n?\s*settledBalance > 0\s*\n?\s*\? t\("workerAccount\.cbSettlePayTitle"/.test(code), "عنوان ذخیره‌شده در دفتر حساب هنگام تسویه از i18n می‌آید");
  check(/t\("workerAccount\.cbDeductionTitle"/.test(code) && /t\("workerAccount\.cbAdvanceTitle"/.test(code) && /t\("workerAccount\.cbAutoDesc"\)/.test(code) && /t\("workerAccount\.cbSettleDesc"\)/.test(code), "عنوان/توضیح خودکار دفتر حساب از i18n می‌آید");
  check(/confirmLabel=\{t\("common\.delete"\)\}/.test(code) && (code.match(/t\("common\.cancel"\)/g) ?? []).length >= 1, "حذف/انصراف از common.*");

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان (ایستا): ${lang}`);
    check(definedKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${definedKeys.length} کلید موجود است`);
    check(definedKeys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    const interp: [string, Record<string, string>, string][] = [
      ["workerAccount.balanceOf", { name: "NM" }, "NM"],
      ["workerAccount.earnedSince", { date: "DT" }, "DT"],
      ["workerAccount.lastSettlement", { date: "DT" }, "DT"],
      ["workerAccount.entryPrimary", { type: "TY", amount: "AM" }, "TY"],
      ["workerAccount.settleDescPay", { amount: "AM" }, "AM"],
      ["workerAccount.settleDescReceive", { amount: "AM" }, "AM"],
      ["workerAccount.deleteWorkerDesc", { name: "NM" }, "NM"],
      ["workerAccount.cbDeductionTitle", { name: "NM" }, "NM"],
      ["workerAccount.cbAdvanceTitle", { name: "NM" }, "NM"],
      ["workerAccount.cbSettlePayTitle", { name: "NM" }, "NM"],
      ["workerAccount.cbSettleReceiveTitle", { name: "NM" }, "NM"],
      ["workerAccount.csvAmount", { symbol: "SYM" }, "SYM"],
    ];
    check(interp.every(([k, o, needle]) => { const v = t(k, o); return v.includes(needle) && !v.includes("{{"); }), `${lang}: interpolationها کار می‌کنند (${interp.length} کلید)`);
    check(t("workerAccount.entryPrimary", { type: "TY", amount: "AM" }).includes("AM"), `${lang}: ردیف تراکنش مبلغ را می‌گیرد`);
    const types = ["advance", "deduction", "credit", "settlement"].map((k) => t(`workerAccount.ledgerType.${k}`));
    check(new Set(types).size === 4, `${lang}: چهار نوع تراکنش متمایزند`);
    const csv = ["csvType", "csvDate", "csvNotes"].map((k) => t(`workerAccount.${k}`));
    check(new Set(csv).size === 3, `${lang}: سرستون‌های CSV متمایزند`);
    check(!/[\\/:*?"<>|]/.test(t("workerAccount.fileBase")), `${lang}: نام پایهٔ فایل نویسهٔ غیرمجاز ندارد`);
    check(t("workerAccount.settleDescPay", { amount: "A" }) !== t("workerAccount.settleDescReceive", { amount: "A" }), `${lang}: دو جملهٔ تسویه (پرداخت/دریافت) متفاوت‌اند`);
    if (lang !== "fa") {
      const allowed = new Set((SHARED_WITH_FA[lang] ?? []).map((k) => k));
      const same = definedKeys.filter((k) => t(k) === fa(k) && !allowed.has(k) && !/entryPrimary/.test(k));
      check(same.length === 0, `${lang}: هیچ کلیدی عیناً فارسی نیست${same.length ? " (" + same.join(",") + ")" : ""}`);
      check([...allowed].every((k) => t(k) === fa(k)), `${lang}: فهرست واژه‌های مشترک بی‌استفاده نیست`);
    }
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      check(definedKeys.every((k) => !PERSIAN_ARABIC_RE.test(t(k))), `${lang}: هیچ حرف فارسی/عربی در ترجمه‌ها نیست`);
    }
  }

  console.log("\n— رندر SSR");
  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان (رندر): ${lang}`);

    const picker = toText(renderHtml("picker"));
    check(picker.includes(t("workerAccount.selectWorker")), `${lang}: حالت انتخاب نیرو: برچسب انتخاب`);
    check(picker.includes(t("workerAccount.emptyTitle")) && picker.includes(t("workerAccount.emptyDesc")), `${lang}: حالت انتخاب نیرو: عنوان/توضیح خالی`);

    const pos = renderHtml("positive");
    const posT = toText(pos);
    check(posT.length > 500, `${lang}: صفحهٔ اصلی رندر شد (${posT.length} نویسه)`);
    check(!/workerAccount\.|common\.(cancel|delete|loading)/.test(pos) && !posT.includes("{{"), `${lang}: کلید خام/placeholder نشت نکرده`);
    check(posT.includes(t("workerAccount.balanceOf", { name: "WFIRST WLAST" })), `${lang}: عنوان مانده با نام نیرو`);
    check(posT.includes(t("workerAccount.balanceOwedToWorker")), `${lang}: مانده مثبت: برچسب طلب نیرو`);
    check(posT.includes(t("workerAccount.guardDutySeparate")), `${lang}: نگهبانی جدا: جملهٔ «جدا از مانده»`);
    for (const k of ["credit", "advances", "deductions", "entriesTitle", "addEntry", "settle", "settleHint"]) {
      check(posT.includes(t(`workerAccount.${k}`)), `${lang}: ${k} ترجمه شده`);
    }
    check(posT.includes("NOTE-ADV"), `${lang}: توضیح تراکنش (داده) دست‌نخورده`);
    for (const k of ["advance", "deduction", "credit"]) {
      check(posT.includes(t(`workerAccount.ledgerType.${k}`)), `${lang}: نوع تراکنش ${k} در لیست ترجمه شده`);
    }
    check(posT.includes(t("workerAccount.lastSettlement", { date: "" }).trim().split(" ")[0]), `${lang}: «آخرین تسویه» نمایش داده شد`);
    check(!posT.includes(t("workerAccount.entriesEmpty")), `${lang}: وقتی تراکنش هست پیام «خالی» نیست`);

    const neg = toText(renderHtml("negative"));
    check(neg.includes(t("workerAccount.balanceWorkerOwes")), `${lang}: مانده منفی: برچسب بدهی نیرو`);
    check(neg.includes(t("workerAccount.guardDutyMerged")) && !neg.includes(t("workerAccount.guardDutySeparate")), `${lang}: نگهبانی ادغام‌شده: جملهٔ بدون «جدا»`);
    check(neg.includes(t("workerAccount.ledgerType.settlement")), `${lang}: نوع «تسویه» در لیست ترجمه شده`);
    check(!neg.includes(t("workerAccount.lastSettlement", { date: "" }).trim().split(" ")[0]) || t("workerAccount.lastSettlement", { date: "" }).trim().split(" ")[0] === t("workerAccount.ledgerType.settlement").split(" ")[0], `${lang}: بدون تسویهٔ قبلی، خط «آخرین تسویه» نیست`);

    const zero = toText(renderHtml("zero"));
    check(zero.includes(t("workerAccount.balanceSettled")), `${lang}: مانده صفر: برچسب تسویه‌شده`);
    check(zero.includes(t("workerAccount.entriesEmpty")), `${lang}: بدون تراکنش پیام «خالی»`);
    check(!zero.includes(t("workerAccount.settleHint")), `${lang}: مانده صفر: راهنمای تسویه نیست`);

    if (lang !== "fa") {
      check(!posT.includes(i18n.getFixedT("fa")("workerAccount.entriesTitle")), `${lang}: صفحه عیناً فارسی نیست`);
    }
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      for (const [name, txt] of [["picker", picker], ["positive", posT], ["negative", neg], ["zero", zero]] as const) {
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
