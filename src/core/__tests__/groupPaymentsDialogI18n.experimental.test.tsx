/**
 * تست i18n GroupPaymentsDialog (پرداخت‌های جمعی اکیپ + فرم پرداخت جدید) در زبان‌های فعال (fa و en):
 *  - رندر واقعی SSR با کش react-query پیش‌پر: دیالوگ اصلی (با پرداخت‌ها / حالت خالی) و AddGroupPaymentDialog؛
 *  - برچسب «مبلغ کل اکیپ» نماد واحد پول فعلی اپ را می‌گیرد (نه «تومان» ثابت)؛
 *  - پوشش ایستا برای بخش‌های وابسته به رویداد (توست‌ها، ConfirmDialog بسته، متن «در حال ثبت»)؛
 *  - خروجی فارسی با رفتار قبلی یکی است؛ کل فایل (بدون کامنت) حرف فارسی/عربی هاردکد ندارد.
 *  توجه: GroupPaymentSplitCalculator (داخل فرم) در این تست رندر نمی‌شود (members خالی ⇒ null)؛ تست جدا: test:group-payment-split-i18n.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { AddGroupPaymentDialog, GroupPaymentsDialog } from "../../widgets/worker-groups/GroupPaymentsDialog";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { CURRENCIES, ENABLED_LANGUAGES, getCurrencyInfo, getLanguageInfo } from "../../shared/i18n/languages";
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

const group = { id: "g1", name: "GNAME-X", memberWorkerIds: ["w1", "w2"] } as never;
const payments = [
  { id: "p1", groupId: "g1", label: "PAY-ONE", date: "2026-01-05", totalAmount: 1500000, note: "NOTE-ONE" },
  { id: "p2", groupId: "g1", label: "PAY-TWO", date: "2026-01-06", totalAmount: 500000, note: null },
];

function renderMain(scenario: "data" | "empty"): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["group-wage-payments", "g1"], scenario === "data" ? payments : []);
  qc.setQueryData(["workers-for-groups"], []);
  return renderToString(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        ThemeProvider,
        { theme },
        createElement(ToastProvider, null, createElement(GroupPaymentsDialog, { open: true, group, onClose: () => {} }))
      )
    )
  ).replace(/&#x27;|&#39;/g, "'");
}

function renderAdd(): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToString(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        ThemeProvider,
        { theme },
        createElement(ToastProvider, null, createElement(AddGroupPaymentDialog, { open: true, groupId: "g1", members: [], onClose: () => {} }))
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

  const src = readFileSync(new URL("../../widgets/worker-groups/GroupPaymentsDialog.tsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const faBundle = (i18n.getResourceBundle("fa", "common") as { groupPayments: Record<string, unknown> }).groupPayments;
  const definedKeys = Object.keys(faBundle).map((k) => `groupPayments.${k}`);
  const usedKeys = new Set([...code.matchAll(/"(groupPayments\.[\w.]+)"/g)].map((m) => m[1]));

  console.log("\n— پوشش ایستا");
  check(definedKeys.length === 19, `تعداد کلیدها (${definedKeys.length})`);
  check(definedKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای در groupPayments نیست");
  check([...usedKeys].every((k) => definedKeys.includes(k)), "هر کلید استفاده‌شده در کد تعریف شده است");
  check(!PERSIAN_ARABIC_RE.test(code), "هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده");
  check(countOf(code, 't("common.close")') === 2 && /"common\.delete"/.test(code) && /"common\.cancel"/.test(code), "کلیدهای مشترک موجود (بستن×۲/حذف/انصراف) دوباره استفاده شده‌اند");
  check(/t\("groupPayments\.deleted"\)/.test(code) && /t\("groupPayments\.created"\)/.test(code), "هر دو توست از i18n می‌آیند");
  check(/t\("groupPayments\.deleteConfirm", \{\s*label: deletingPayment\.label,\s*amount: formatCurrency\(deletingPayment\.totalAmount\),?\s*\}\)/.test(code), "پیام تأیید حذف یک جملهٔ کامل با placeholder است");
  check(/t\("groupPayments\.deleteTitle"\)/.test(code) && /confirmLabel=\{t\("common\.delete"\)\}/.test(code), "ConfirmDialog (بسته در SSR) از i18n می‌آید");
  check(/createMutation\.isPending \? t\("groupPayments\.saving"\) : t\("groupPayments\.save"\)/.test(code), "متن دکمهٔ ثبت (عادی/در حال ثبت) از i18n می‌آید");
  check(/t\("groupPayments\.amountLabel", \{ symbol: currencySymbol \}\)/.test(code) && /getCurrencyInfo\(currency\)\.symbol/.test(code), "نماد واحد پول برچسب مبلغ از تنظیم فعلی اپ می‌آید");
  check(/t\("groupPayments\.subtitle", \{ n: group\.memberWorkerIds\.length, total: formatCurrency\(total\) \}\)/.test(code), "زیرعنوان (تعداد اعضا + جمع کل) یک جملهٔ کامل است");

  console.log("\n— ثبات خروجی فارسی (رفتار قبلی)");
  {
    const fa = i18n.getFixedT("fa");
    check(fa("groupPayments.title", { name: "N" }) === "پرداخت‌های جمعی اکیپ N" && fa("groupPayments.subtitle", { n: 3, total: "T" }) === "3 عضو — جمع کل پرداخت‌شده: T", "fa: عنوان و زیرعنوان همان قبلی");
    check(fa("groupPayments.intro") === "هر مبلغ زیر، مبلغ کل قابل‌پرداخت به کل اکیپ برای همان کار است — نه سرانهٔ هر عضو. تقسیم آن بین اعضا به عهدهٔ خودشان است.", "fa: متن راهنما همان قبلی");
    check(fa("groupPayments.addNew") === "ثبت پرداخت جمعی جدید" && fa("groupPayments.emptyTitle") === "هنوز پرداخت جمعی ثبت نشده" && fa("groupPayments.emptyDesc") === "با دکمهٔ بالا اولین پرداخت کلی این اکیپ را برای یک کار مشخص ثبت کنید.", "fa: دکمهٔ افزودن و حالت خالی همان قبلی");
    check(fa("groupPayments.deleteTitle") === "حذف پرداخت جمعی" && fa("groupPayments.deleteConfirm", { label: "L", amount: "A" }) === "آیا از حذف پرداخت «L» به مبلغ A مطمئن هستید؟ تراکنش مرتبط در دفتر حساب کلی هم حذف می‌شود.", "fa: متن ConfirmDialog همان قبلی");
    check(fa("groupPayments.deleted") === "پرداخت جمعی حذف شد." && fa("groupPayments.created") === "پرداخت جمعی ثبت شد.", "fa: متن توست‌ها همان قبلی");
    check(fa("groupPayments.formTitle") === "پرداخت جمعی جدید" && fa("groupPayments.labelField") === "بابت چه کاری" && fa("groupPayments.labelPlaceholder") === "مثلاً: گچ‌کاری طبقهٔ دوم", "fa: عنوان و فیلد «بابت» همان قبلی");
    check(fa("groupPayments.amountLabel", { symbol: CURRENCIES.IRT.symbol }) === "مبلغ کل اکیپ (تومان)", "fa: برچسب مبلغ با واحد پیش‌فرض (تومان) همان قبلی");
    check(fa("groupPayments.amountHelper") === "مبلغ کل برای کل اکیپ — سرانه نیست، خودشان بین خودشان تقسیم می‌کنند." && fa("groupPayments.dateLabel") === "تاریخ" && fa("groupPayments.noteLabel") === "یادداشت (اختیاری)", "fa: راهنمای مبلغ و برچسب‌های تاریخ/یادداشت همان قبلی");
    check(fa("groupPayments.saving") === "در حال ثبت..." && fa("groupPayments.save") === "ثبت پرداخت" && fa("common.delete") === "حذف", "fa: دکمه‌ها همان قبلی");
  }

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان (ایستا): ${lang}`);
    check(definedKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${definedKeys.length} کلید موجود است`);
    check(definedKeys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    const interp: [string, Record<string, string | number>, string][] = [
      ["groupPayments.title", { name: "NAME1" }, "NAME1"],
      ["groupPayments.subtitle", { n: 77, total: "TOT1" }, "TOT1"],
      ["groupPayments.deleteConfirm", { label: "LBL1", amount: "AMT1" }, "AMT1"],
      ["groupPayments.amountLabel", { symbol: "SYM1" }, "SYM1"],
    ];
    check(interp.every(([k, o, needle]) => { const v = t(k, o); return v.includes(needle) && !v.includes("{{"); }), `${lang}: interpolationها کار می‌کنند (${interp.length} کلید)`);
    check(t("groupPayments.subtitle", { n: 77, total: "TOT1" }).includes("77") && t("groupPayments.deleteConfirm", { label: "LBL1", amount: "AMT1" }).includes("LBL1"), `${lang}: تعداد اعضا و عنوان پرداخت در پیام‌ها می‌آید`);
    check(t("groupPayments.addNew") !== t("groupPayments.formTitle") || lang === "fa", `${lang}: دکمهٔ افزودن و عنوان فرم (در صورت نیاز) قابل‌تشخیص‌اند`);
    check(t("groupPayments.saving") !== t("groupPayments.save"), `${lang}: «در حال ثبت» و «ثبت پرداخت» متمایزند`);
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
    setPref(PREF_KEYS.currency, getLanguageInfo(lang).defaultCurrency);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان (رندر): ${lang}`);

    const mainHtml = renderMain("data");
    const mainT = toText(mainHtml);
    check(mainT.length > 200, `${lang}: دیالوگ اصلی رندر شد (${mainT.length} نویسه)`);
    check(!/groupPayments\.|common\.(close|delete|cancel)/.test(mainHtml) && !mainT.includes("{{"), `${lang}: کلید خام/placeholder نشت نکرده`);
    check(mainT.includes(t("groupPayments.title", { name: "GNAME-X" })), `${lang}: عنوان با نام اکیپ`);
    check(mainT.includes(t("groupPayments.subtitle", { n: 2, total: formatCurrency(2000000) })), `${lang}: زیرعنوان: تعداد اعضا و جمع کل پرداخت‌ها`);
    check(mainT.includes(t("groupPayments.intro")), `${lang}: متن راهنمای مبلغ کل اکیپ`);
    check(mainT.includes(t("groupPayments.addNew")), `${lang}: دکمهٔ ثبت پرداخت جدید`);
    check(countOf(mainHtml, `aria-label="${t("common.close")}"`) === 1, `${lang}: aria-label بستن ترجمه شده`);
    check(countOf(mainHtml, `>${t("common.delete")}<`) === 2, `${lang}: دکمهٔ «حذف» برای هر دو پرداخت`);
    check(countOf(mainT, "PAY-ONE") === 1 && countOf(mainT, "PAY-TWO") === 1 && mainT.includes("NOTE-ONE"), `${lang}: عنوان و یادداشت پرداخت‌ها (داده) دست‌نخورده`);
    check(mainT.includes(toJalaliDisplay("2026-01-05")) && mainT.includes(formatCurrency(1500000)), `${lang}: تاریخ و مبلغ هر ردیف`);
    check(!mainT.includes(t("groupPayments.emptyTitle")), `${lang}: وقتی پرداخت هست پیام «خالی» نیست`);

    const emptyT = toText(renderMain("empty"));
    check(emptyT.includes(t("groupPayments.emptyTitle")) && emptyT.includes(t("groupPayments.emptyDesc")), `${lang}: بدون پرداخت: عنوان/توضیح خالی`);
    check(!emptyT.includes(t("common.delete")), `${lang}: بدون پرداخت: دکمهٔ حذف رندر نمی‌شود`);
    check(emptyT.includes(t("groupPayments.subtitle", { n: 2, total: formatCurrency(0) })), `${lang}: بدون پرداخت: جمع کل صفر`);

    const addHtml = renderAdd();
    const addT = toText(addHtml);
    const symbol = getCurrencyInfo(getLanguageInfo(lang).defaultCurrency).symbol;
    check(addT.includes(t("groupPayments.formTitle")), `${lang}: عنوان فرم پرداخت جدید`);
    check(countOf(addHtml, `aria-label="${t("common.close")}"`) === 1, `${lang}: aria-label بستن در فرم`);
    check(addT.includes(t("groupPayments.labelField")) && addHtml.includes(`placeholder="${t("groupPayments.labelPlaceholder")}"`), `${lang}: فیلد «بابت چه کاری» و placeholder`);
    check(addT.includes(t("groupPayments.amountLabel", { symbol })), `${lang}: برچسب مبلغ با نماد واحد پول پیش‌فرض زبان (${symbol})`);
    check(addT.includes(t("groupPayments.amountHelper")), `${lang}: راهنمای مبلغ`);
    check(addT.includes(t("groupPayments.dateLabel")) && addT.includes(t("groupPayments.noteLabel")), `${lang}: برچسب‌های تاریخ و یادداشت`);
    check(addT.includes(t("groupPayments.save")) && addT.includes(t("common.cancel")) && !addT.includes(t("groupPayments.saving")), `${lang}: دکمه‌های ثبت و انصراف (حالت عادی)`);
    check(/<button[^>]*disabled[^>]*>[^<]*(<[^>]*>)*\s*[^<]*<\/button>/.test(addHtml) && addHtml.includes("Mui-disabled"), `${lang}: دکمهٔ ثبت با فرم خالی غیرفعال است`);

    // برچسب مبلغ باید از واحد پول فعلی پیروی کند، نه «تومان» ثابت.
    setPref(PREF_KEYS.currency, "SAR");
    const sarT = toText(renderAdd());
    check(sarT.includes(t("groupPayments.amountLabel", { symbol: CURRENCIES.SAR.symbol })) && (lang === "fa" || !sarT.includes(`(${CURRENCIES.IRT.symbol})`)), `${lang}: با واحد پول SAR برچسب مبلغ نماد SAR را نشان می‌دهد`);
    check(!sarT.includes(t("groupPayments.amountLabel", { symbol: CURRENCIES.IRT.symbol })), `${lang}: با واحد پول SAR «تومان» ثابت نیست`);
    setPref(PREF_KEYS.currency, getLanguageInfo(lang).defaultCurrency);

    if (lang !== "fa") {
      check(!mainT.includes(i18n.getFixedT("fa")("groupPayments.addNew")) && !addT.includes(i18n.getFixedT("fa")("groupPayments.save")), `${lang}: صفحه عیناً فارسی نیست`);
    }
    if (LATIN_ONLY.has(lang)) {
      for (const [name, txt] of [["main", mainT], ["empty", emptyT], ["add", addT]] as const) {
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
