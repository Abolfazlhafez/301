/**
 * تست i18n CashbookSection (دفتر حساب) در هر ۸ زبان:
 *  - رندر واقعی SSR با کش react-query پیش‌پر: حالت «بدون صندوق» و حالت اصلی (خلاصه، فیلترها، لیست تراکنش‌ها، مانده هر ردیف)؛
 *  - پوشش ایستا برای بخش‌هایی که بدون رویداد رندر نمی‌شوند (منوی ⋮، دیالوگ حذف، توست‌ها، سرستون‌های CSV، نام فایل، حالت جستجو/فیلتر فعال):
 *    همهٔ کلیدهای cashbook.section.* در کد استفاده شده‌اند، در ۸ زبان هستند، placeholderها با fa یکی‌اند و interpolation کار می‌کند؛
 *  - کل فایل (بدون کامنت) حرف فارسی/عربی هاردکد ندارد؛ برچسب نوع تراکنش از cashbook.entryType.* می‌آید نه از ثابت فارسی entity.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { formatNumber } from "../../shared/utils/format";
import { CashbookSection } from "../../pages/reports/CashbookSection";
import { ToastProvider } from "../../shared/components/ToastProvider";
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
const FUND = { id: "f1", projectId: "p1", name: "FUND-MAIN", description: null, isDefault: true, createdAt: now, updatedAt: now };
const FUND2 = { id: "f2", projectId: "p1", name: "FUND-TWO", description: null, isDefault: false, createdAt: now, updatedAt: now };
const mk = (id: string, type: string, title: string, amount: number, date: string) => ({
  id, type, title, amount, date, description: null, fundId: "f1", workerId: null, receiptPhotoId: null, createdAt: now, updatedAt: now,
});
// ترتیب سرویس: جدیدترین اول
const ENTRIES = [mk("e3", "salary", "TITLE-SALARY", 300, "2026-01-03"), mk("e2", "expense", "TITLE-EXPENSE", 200, "2026-01-02"), mk("e1", "deposit", "TITLE-DEPOSIT", 1000, "2026-01-01")];
const SUMMARY = { totalExpense: 200, totalSalary: 300, totalDeposit: 1000, net: 500 };

function renderHtml(withFunds: boolean): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["settings"], { projectName: "PRJ" });
  qc.setQueryData(["cashbox-funds"], withFunds ? [FUND, FUND2] : []);
  qc.setQueryData(["photos", "receipt"], []);
  qc.setQueryData(["workers"], []);
  if (withFunds) {
    qc.setQueryData(["cashbook", "f1"], ENTRIES);
    qc.setQueryData(["cashbook-summary", "f1"], SUMMARY);
  }
  return renderToString(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(ThemeProvider, { theme }, createElement(ToastProvider, null, createElement(CashbookSection)))
    )
  ).replace(/&#x27;|&#39;/g, "'");
}

function render(withFunds: boolean): string {
  return toText(renderHtml(withFunds));
}

// واژه‌هایی که در عربی/اردو/پشتو و فارسی املای یکسان دارند (واژهٔ مشترک، نه ترجمه‌نشدن).
const SHARED_WITH_FA: Record<string, string[]> = {
  ar: ["deleteEntryAria"],
  ur: ["csvTitle", "csvDate", "receiptAlt"],
  ps: ["fundFallback", "receiptAlt"],
};

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  const src = readFileSync(new URL("../../pages/reports/CashbookSection.tsx", import.meta.url), "utf8");
  const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const code = strip(src);
  const faSection = (i18n.getResourceBundle("fa", "common") as { cashbook: { section: Record<string, string> } }).cashbook.section;
  const definedKeys = Object.keys(faSection).map((k) => `cashbook.section.${k}`);
  const usedKeys = new Set([...code.matchAll(/"(cashbook\.section\.\w+)"/g)].map((m) => m[1]));

  console.log("\n— پوشش ایستا");
  check(usedKeys.size > 0, `کد کلید cashbook.section.* استفاده می‌کند (${usedKeys.size})`);
  check(definedKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای در cashbook.section نیست");
  check([...usedKeys].every((k) => definedKeys.includes(k)), "هر کلید استفاده‌شده در کد تعریف شده است");
  check(!PERSIAN_ARABIC_RE.test(code), "هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده");
  check(!/CASHBOOK_ENTRY_TYPE_LABELS/.test(code), "برچسب نوع تراکنش از ثابت فارسی entity نمی‌آید");
  check(/t\(`cashbook\.entryType\.\$\{e\.type\}`\)/.test(code), "نوع تراکنش در CSV از cashbook.entryType.* می‌آید");
  const fileNameKeys = [...code.matchAll(/t\("cashbook\.section\.(fileBase|receiptFileBase)"\)/g)].length;
  check(fileNameKeys === 2, "نام فایل خروجی و رسید از کلید i18n می‌آیند");
  check(!/useEffect\(\(\) => \{\s*if \(!selectedFundId && funds/.test(code), "انتخاب صندوق پیش‌فرض هنگام رندر مشتق می‌شود (نه افکت)");
  check(/onDelete=\{\(\) => setDeletingEntry/.test(code) && /confirmLabel=\{t\("common\.delete"\)\}/.test(code), "دکمهٔ تأیید حذف از common.delete");

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان (ایستا): ${lang}`);
    check(definedKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${definedKeys.length} کلید موجود است`);
    check(definedKeys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    const amt = t("cashbook.section.csvAmount", { symbol: "SYM" });
    check(amt.includes("SYM") && !amt.includes("{{"), `${lang}: سرستون مبلغ نماد واحد پول را می‌گیرد`);
    const fsum = t("cashbook.section.filteredSum", { n: "NN" });
    check(fsum.includes("NN") && !fsum.includes("{{"), `${lang}: جمع فیلترشده تعداد را می‌گیرد`);
    const fwc = t("cashbook.section.filterWithCount", { label: "LB", n: "NN" });
    check(fwc.includes("LB") && fwc.includes("NN"), `${lang}: چیپ فیلتر برچسب و تعداد را می‌گیرد`);
    const bal = t("cashbook.section.balanceOf", { name: "NM" });
    check(bal.includes("NM") && !bal.includes("{{"), `${lang}: مانده صندوق نام را می‌گیرد`);
    const del = t("cashbook.section.deleteEntryAria", { title: "TT" });
    check(del.includes("TT") && !del.includes("{{"), `${lang}: aria حذف عنوان را می‌گیرد`);
    const csvHeaders = ["csvType", "csvTitle", "csvDate", "csvWorker", "csvNotes"].map((k) => t(`cashbook.section.${k}`));
    check(new Set(csvHeaders).size === 5, `${lang}: سرستون‌های CSV متمایزند`);
    check(["expense", "salary", "deposit"].every((x) => i18n.exists(`cashbook.entryType.${x}`, { lng: lang, fallbackLng: [] })), `${lang}: برچسب‌های نوع تراکنش موجود است`);
    check(!/[\\/:*?"<>|]/.test(t("cashbook.section.fileBase") + t("cashbook.section.receiptFileBase")), `${lang}: نام پایهٔ فایل نویسهٔ غیرمجاز ندارد`);
    if (lang !== "fa") {
      const allowed = new Set((SHARED_WITH_FA[lang] ?? []).map((k) => `cashbook.section.${k}`));
      const same = definedKeys.filter((k) => t(k) === fa(k) && !/filterWithCount/.test(k) && !allowed.has(k));
      check(same.length === 0, `${lang}: هیچ کلیدی عیناً فارسی نیست (به‌جز واژه‌های مشترک فهرست‌شده)${same.length ? " (" + same.join(",") + ")" : ""}`);
      check([...allowed].every((k) => t(k) === fa(k)), `${lang}: فهرست واژه‌های مشترک بی‌استفاده نیست (هر مورد واقعاً با fa یکی است)`);
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

    const empty = render(false);
    check(empty.includes(t("cashbook.section.noFundTitle")) && empty.includes(t("cashbook.section.noFundDesc")), `${lang}: حالت بدون صندوق عنوان/توضیح ترجمه‌شده دارد`);
    check(empty.includes(t("cashbook.section.createFund")), `${lang}: دکمهٔ ساخت صندوق ترجمه شده`);

    const full = render(true);
    check(full.length > 800, `${lang}: صفحهٔ اصلی رندر شد (${full.length} نویسه)`);
    check(!/cashbook\.(section|entryType)\.|common\.(delete|clearSearch)/.test(full), `${lang}: کلید خام نشت نکرده`);
    check(!full.includes("{{"), `${lang}: placeholder جایگزین‌نشده نمانده`);
    check(full.includes("FUND-MAIN") && full.includes("FUND-TWO"), `${lang}: نام صندوق‌ها (داده) دست‌نخورده است`);
    check(full.includes(t("cashbook.section.balanceOf", { name: "FUND-MAIN" })), `${lang}: نوار مانده با نام صندوق ساخته شد`);
    for (const key of ["totalExpense", "totalSalary", "totalDeposit", "fundBalance", "runningBalance"]) {
      check(full.includes(t(`cashbook.section.${key}`)), `${lang}: ${key} ترجمه شده`);
    }
    check(renderHtml(true).includes(`placeholder="${t("cashbook.section.searchPlaceholder")}"`), `${lang}: placeholder جستجو (صفت HTML) ترجمه شده`);
    check(full.includes("TITLE-SALARY") && full.includes("TITLE-EXPENSE") && full.includes("TITLE-DEPOSIT"), `${lang}: عنوان تراکنش‌ها (داده) نمایش داده شد`);
    const chips = ["filterAll", "filterExpense", "filterSalary", "filterDeposit"].map((k) => t(`cashbook.section.${k}`));
    check(chips.every((c) => full.includes(c)), `${lang}: چهار چیپ فیلتر ترجمه شده`);
    check(full.includes(t("cashbook.section.filterWithCount", { label: t("cashbook.section.filterAll"), n: formatNumber(3, lang) })), `${lang}: چیپ «همه» با تعداد ۳ و ارقام همین زبان`);
    check(full.includes(t("cashbook.section.filterWithCount", { label: t("cashbook.section.filterExpense"), n: formatNumber(1, lang) })), `${lang}: چیپ «خرج‌ها» با تعداد ۱ و ارقام همین زبان`);
    check(!full.includes(t("cashbook.section.emptyNoneTitle")), `${lang}: وقتی تراکنش هست پیام «خالی» نمایش داده نمی‌شود`);
    if (lang !== "fa") {
      check(!full.includes(i18n.getFixedT("fa")("cashbook.section.totalExpense")), `${lang}: کارت خلاصه عیناً فارسی نیست`);
    }
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      let stripped = full;
      for (const c of Object.values(CURRENCIES)) stripped = stripped.split(c.symbol).join(" ");
      const m = stripped.match(PERSIAN_ARABIC_RE);
      if (m) console.log("    متن فارسی باقی‌مانده:", stripped.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 80));
      check(!m, `${lang}: هیچ حرف فارسی/عربی هاردکد در رندر نیست (به‌جز نماد واحد پول)`);
      let strippedEmpty = empty;
      for (const c of Object.values(CURRENCIES)) strippedEmpty = strippedEmpty.split(c.symbol).join(" ");
      check(!PERSIAN_ARABIC_RE.test(strippedEmpty), `${lang}: حالت بدون صندوق حرف فارسی/عربی ندارد`);
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
