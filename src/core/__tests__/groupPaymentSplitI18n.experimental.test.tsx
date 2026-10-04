/**
 * تست i18n GroupPaymentSplitCalculator (ماشین‌حساب تقسیم پرداخت جمعی) در زبان‌های فعال (fa و en):
 *  - رندر واقعی SSR با اعضای واقعی (هم حالت اختلاف صفر، هم اختلاف غیرصفر) و داخل AddGroupPaymentDialog؛
 *  - پسوند مبلغ از واحد پول فعلی اپ می‌آید (نه «تومان» ثابت)؛
 *  - متن یادداشت ذخیره‌شده (buildNoteText) و متن دکمهٔ «بستن» وابسته به رویدادند ⇒ پوشش ایستا؛
 *  - خروجی فارسی با رفتار قبلی یکی است؛ کل فایل (بدون کامنت) حرف فارسی/عربی هاردکد ندارد.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { GroupPaymentSplitCalculator } from "../../widgets/worker-groups/GroupPaymentSplitCalculator";
import { AddGroupPaymentDialog } from "../../widgets/worker-groups/GroupPaymentsDialog";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { CURRENCIES, ENABLED_LANGUAGES, getCurrencyInfo, getLanguageInfo } from "../../shared/i18n/languages";
import { PREF_KEYS, setPref } from "../../shared/storage/appPreferences";
import { formatCurrency } from "../../shared/utils/format";

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
function placeholders(s: string): string {
  return (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(",");
}

const LANGS: string[] = [...ENABLED_LANGUAGES];
const PERSIAN_ARABIC_RE = /[\u0600-\u06FF]/;
const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });
const members = [
  { id: "w1", name: "MEM-ONE" },
  { id: "w2", name: "MEM-TWO" },
  { id: "w3", name: "MEM-THREE" },
];

function renderCalc(total: number): string {
  return renderToString(
    createElement(ThemeProvider, { theme }, createElement(GroupPaymentSplitCalculator, { members, totalAmount: total, onApplyToNote: () => {} }))
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
        createElement(ToastProvider, null, createElement(AddGroupPaymentDialog, { open: true, groupId: "g1", members, onClose: () => {} }))
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

  const src = readFileSync(new URL("../../widgets/worker-groups/GroupPaymentSplitCalculator.tsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const faBundle = (i18n.getResourceBundle("fa", "common") as { groupPaymentSplit: Record<string, unknown> }).groupPaymentSplit;
  const definedKeys = Object.keys(faBundle).map((k) => `groupPaymentSplit.${k}`);
  const usedKeys = new Set([...code.matchAll(/"(groupPaymentSplit\.[\w.]+)"/g)].map((m) => m[1]));

  console.log("\n— پوشش ایستا");
  check(definedKeys.length === 7, `تعداد کلیدها (${definedKeys.length})`);
  check(definedKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای نیست");
  check([...usedKeys].every((k) => definedKeys.includes(k)), "هر کلید استفاده‌شده در کد تعریف شده است");
  check(!PERSIAN_ARABIC_RE.test(code), "هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده");
  check(/expanded \? t\("groupPaymentSplit\.close"\) : t\("groupPaymentSplit\.open"\)/.test(code), "دکمهٔ باز/بستن (بستن فقط بعد از کلیک) از i18n می‌آید");
  check(/\$\{t\("groupPaymentSplit\.noteHeader"\)\}\\n\$\{lines\.join\("\\n"\)\}/.test(code), "سرِ متن یادداشت ذخیره‌شده از i18n می‌آید و خطوط اعضا بعد از آن");
  check(/\$\{m\.name\}: \$\{formatCurrency\(shares\.get\(m\.id\) \?\? 0\)\}/.test(code), "هر خط یادداشت «نام: مبلغ» است (نام عضو دست‌نخورده)");
  check(/<InputAdornment position="end">\{currencySymbol\}<\/InputAdornment>/.test(code) && /getCurrencyInfo\(currency\)\.symbol/.test(code), "پسوند مبلغ از واحد پول فعلی اپ می‌آید");
  check(/t\("groupPaymentSplit\.diffZero", \{ total: formatCurrency\(totalAmount\) \}\)/.test(code) && /t\("groupPaymentSplit\.diffNonZero", \{ diff: formatCurrency\(diff\) \}\)/.test(code), "پیام اختلاف دو جملهٔ کامل با placeholder است");

  console.log("\n— ثبات خروجی فارسی (رفتار قبلی)");
  {
    const fa = i18n.getFixedT("fa");
    check(fa("groupPaymentSplit.open") === "کمک به تقسیم بین اعضا (اختیاری)" && fa("groupPaymentSplit.close") === "بستن ماشین‌حساب تقسیم", "fa: دکمهٔ باز/بستن همان قبلی");
    check(fa("groupPaymentSplit.noteHeader") === "تقسیم پیشنهادی بین اعضا:", "fa: سرِ متن یادداشت همان قبلی");
    check(fa("groupPaymentSplit.apply") === "افزودن این تقسیم به یادداشت پرداخت", "fa: دکمهٔ افزودن به یادداشت همان قبلی");
    check(fa("groupPaymentSplit.diffZero", { total: "T" }) === "جمع تقسیم‌شده برابر مبلغ کل (T) است." && fa("groupPaymentSplit.diffNonZero", { diff: "D" }) === "اختلاف با مبلغ کل: D (به‌خاطر رند شدن مبالغ مساوی، طبیعی است).", "fa: پیام‌های اختلاف همان قبلی");
    check(fa("groupPaymentSplit.help") === "این فقط یک ماشین‌حساب کمکی برای تقسیم عادلانهٔ مبلغ بین اعضاست — جایی در حساب فردی کسی ثبت نمی‌شود، مگر این‌که با دکمهٔ پایین آن را به یادداشت همین پرداخت اضافه کنید. به‌صورت پیش‌فرض مساوی تقسیم می‌شود؛ مبلغ هرکس را می‌توانید دستی عوض کنید.", "fa: متن راهنما همان قبلی (بایت‌به‌بایت، با یک‌خط‌شدن شکست خطوط JSX)");
  }

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان (ایستا): ${lang}`);
    check(definedKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${definedKeys.length} کلید موجود است`);
    check(definedKeys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    check(t("groupPaymentSplit.diffZero", { total: "TOT1" }).includes("TOT1") && t("groupPaymentSplit.diffNonZero", { diff: "DIF1" }).includes("DIF1"), `${lang}: interpolationها کار می‌کنند`);
    check(t("groupPaymentSplit.open") !== t("groupPaymentSplit.close"), `${lang}: «باز» و «بستن» متمایزند`);
    if (lang !== "fa") {
      const same = definedKeys.filter((k) => t(k) === fa(k));
      check(same.length === 0, `${lang}: هیچ کلیدی عیناً فارسی نیست`);
      check(definedKeys.every((k) => !PERSIAN_ARABIC_RE.test(t(k))), `${lang}: هیچ حرف فارسی/عربی در ترجمه‌ها نیست`);
    }
  }

  console.log("\n— رندر SSR");
  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    const defCur = getLanguageInfo(lang).defaultCurrency;
    setPref(PREF_KEYS.currency, defCur);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    const symbol = getCurrencyInfo(defCur).symbol;
    console.log(`\n— زبان (رندر): ${lang}`);

    // مجموع 900 بین ۳ نفر ⇒ ۳۰۰ هر کدام ⇒ اختلاف صفر
    const zeroHtml = renderCalc(900);
    const zeroT = toText(zeroHtml);
    check(!/groupPaymentSplit\./.test(zeroHtml) && !zeroT.includes("{{"), `${lang}: کلید خام/placeholder نشت نکرده`);
    check(zeroT.includes(t("groupPaymentSplit.open")) && !zeroT.includes(t("groupPaymentSplit.close")), `${lang}: دکمه در حالت بسته «باز کردن» را نشان می‌دهد`);
    check(zeroT.includes(t("groupPaymentSplit.help")), `${lang}: متن راهنما`);
    check(zeroT.includes(t("groupPaymentSplit.apply")), `${lang}: دکمهٔ افزودن به یادداشت`);
    check(zeroT.includes(t("groupPaymentSplit.diffZero", { total: formatCurrency(900) })) && !zeroT.includes(t("groupPaymentSplit.diffNonZero", { diff: formatCurrency(0) })), `${lang}: اختلاف صفر ⇒ پیام «برابر مبلغ کل»`);
    check(["MEM-ONE", "MEM-TWO", "MEM-THREE"].every((n) => zeroT.includes(n)), `${lang}: نام همهٔ اعضا (داده) دست‌نخورده`);
    check(zeroHtml.split(`>${symbol}<`).length - 1 === 3, `${lang}: پسوند واحد پول (${symbol}) برای هر سه عضو`);

    // مجموع 1000 بین ۳ نفر ⇒ ۳۳۳ هر کدام ⇒ اختلاف ۱
    const diffT = toText(renderCalc(1000));
    check(diffT.includes(t("groupPaymentSplit.diffNonZero", { diff: formatCurrency(1) })) && !diffT.includes(t("groupPaymentSplit.diffZero", { total: formatCurrency(1000) })), `${lang}: اختلاف ۱ ⇒ پیام «اختلاف با مبلغ کل»`);

    // داخل فرم پرداخت جدید با اعضای واقعی
    const addT = toText(renderAdd());
    check(addT.includes(t("groupPaymentSplit.open")) && addT.includes("MEM-ONE"), `${lang}: ماشین‌حساب داخل فرم پرداخت جدید با اعضای واقعی رندر می‌شود`);

    // پسوند باید از واحد پول فعلی پیروی کند، نه «تومان» ثابت.
    setPref(PREF_KEYS.currency, "SAR");
    const sarHtml = renderCalc(900);
    check(sarHtml.split(`>${CURRENCIES.SAR.symbol}<`).length - 1 === 3 && !sarHtml.includes(`>${CURRENCIES.IRT.symbol}<`), `${lang}: با واحد پول SAR پسوند SAR است و «تومان» ثابت نیست`);
    setPref(PREF_KEYS.currency, defCur);

    if (lang !== "fa") {
      check(!zeroT.includes(i18n.getFixedT("fa")("groupPaymentSplit.open")) && !zeroT.includes(i18n.getFixedT("fa")("groupPaymentSplit.apply")), `${lang}: ماشین‌حساب عیناً فارسی نیست`);
      let stripped: string = zeroT + " " + diffT;
      for (const c of Object.values(CURRENCIES)) stripped = stripped.split(c.symbol).join(" ");
      const m = stripped.match(PERSIAN_ARABIC_RE);
      if (m) console.log("    متن فارسی باقی‌مانده:", stripped.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 80));
      check(!m, `${lang}: هیچ حرف فارسی/عربی هاردکد در رندر نیست (به‌جز نماد واحد پول)`);
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
