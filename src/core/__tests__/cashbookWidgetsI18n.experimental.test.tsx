/**
 * تست i18n ویجت‌های دفتر حساب (CashbookEntryFormDialog و CashbookReceiptCard) در هر ۸ زبان:
 *  - رندر واقعی SSR: فرم (حالت «ثبت جدید» با ۲ صندوق و یک پیش‌فرض) و کارت رسید (واریزی/خرج، با و بدون عکس و نیروی مرتبط)؛
 *  - جهت کارت رسید از زبان فعلی می‌آید (نه rtl ثابت)، و نام برند/فوتر از app.name همان زبان (فارسی: «کارگاه‌یار»)؛
 *  - پوشش ایستا برای شاخه‌های بدون رویداد (پیام‌های خطای اعتبارسنجی، حالت ویرایش/کپی، منوی نیرو در نوع «حقوق»، دکمهٔ رسید جدید):
 *    همهٔ کلیدهای cashbook.form.* و cashbook.receipt.* در کد استفاده شده‌اند، در ۸ زبان هستند و placeholderها با fa یکی‌اند؛
 *  - کل فایل‌ها (بدون کامنت) حرف فارسی/عربی هاردکد ندارند و از ثابت فارسی CASHBOOK_ENTRY_TYPE_LABELS استفاده نمی‌کنند.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { CashbookEntryFormDialog } from "../../widgets/cashbook-form/CashbookEntryFormDialog";
import { CashbookReceiptCard } from "../../widgets/cashbook/CashbookReceiptCard";
import { CURRENCIES, getLanguageInfo, ENABLED_LANGUAGES } from "../../shared/i18n/languages";
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
const entry = (type: string) => ({
  id: "abcdef1234567890", type, title: "ENTRY-TITLE", amount: 1000, date: "2026-01-02",
  description: "ENTRY-NOTES", fundId: "f1", workerId: null, receiptPhotoId: null, createdAt: now, updatedAt: now,
});

function renderForm(): string {
  return renderToString(
    createElement(
      ThemeProvider,
      { theme },
      createElement(CashbookEntryFormDialog, {
        open: true, workers: [], funds: [FUND, FUND2], defaultFundId: "f1", onClose: () => {}, onSubmit: () => {},
      } as never)
    )
  ).replace(/&#x27;|&#39;/g, "'");
}

function renderReceipt(type: string, opts: { withWorker: boolean; withImage: boolean; project?: string }): string {
  return renderToString(
    createElement(CashbookReceiptCard, {
      entry: entry(type) as never,
      workerName: opts.withWorker ? "WORKER-NAME" : null,
      projectName: opts.project,
      receiptImageUrl: opts.withImage ? "https://example.invalid/r.png" : null,
    })
  ).replace(/&#x27;|&#39;/g, "'");
}

// واژه‌هایی که در این زبان‌ها با فارسی املای یکسان دارند (واژهٔ مشترک، نه ترجمه‌نشدن).
const SHARED_WITH_FA: Record<string, string[]> = {
  ur: ["cashbook.form.titleLabel", "cashbook.form.dateLabel", "cashbook.form.receiptLabel", "cashbook.receipt.rowTitle", "cashbook.receipt.rowDate"],
  ps: ["cashbook.form.fundLabel"],
};

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const formCode = strip(readFileSync(new URL("../../widgets/cashbook-form/CashbookEntryFormDialog.tsx", import.meta.url), "utf8"));
  const receiptCode = strip(readFileSync(new URL("../../widgets/cashbook/CashbookReceiptCard.tsx", import.meta.url), "utf8"));
  const bundle = i18n.getResourceBundle("fa", "common") as { cashbook: { form: Record<string, string>; receipt: Record<string, string> } };
  const formKeys = Object.keys(bundle.cashbook.form).map((k) => `cashbook.form.${k}`);
  const receiptKeys = Object.keys(bundle.cashbook.receipt).map((k) => `cashbook.receipt.${k}`);
  const used = (code: string, ns: string) => new Set([...code.matchAll(new RegExp(`"(cashbook\\.${ns}\\.\\w+)"`, "g"))].map((m) => m[1]));
  const usedForm = used(formCode, "form");
  const usedReceipt = used(receiptCode, "receipt");

  console.log("\n— پوشش ایستا");
  check(formKeys.length === 25 && receiptKeys.length === 13, `تعداد کلیدها (${formKeys.length} فرم + ${receiptKeys.length} رسید)`);
  check(formKeys.every((k) => usedForm.has(k)), "هیچ کلید بلااستفاده‌ای در cashbook.form نیست");
  check([...usedForm].every((k) => formKeys.includes(k)), "هر کلید cashbook.form استفاده‌شده در کد تعریف شده است");
  check(receiptKeys.every((k) => usedReceipt.has(k)), "هیچ کلید بلااستفاده‌ای در cashbook.receipt نیست");
  check([...usedReceipt].every((k) => receiptKeys.includes(k)), "هر کلید cashbook.receipt استفاده‌شده در کد تعریف شده است");
  check(!PERSIAN_ARABIC_RE.test(formCode), "فرم: هیچ حرف فارسی/عربی هاردکد (به‌جز کامنت) نمانده");
  check(!PERSIAN_ARABIC_RE.test(receiptCode), "رسید: هیچ حرف فارسی/عربی هاردکد (به‌جز کامنت) نمانده");
  check(!/CASHBOOK_ENTRY_TYPE_LABELS/.test(formCode + receiptCode), "برچسب نوع تراکنش از ثابت فارسی entity نمی‌آید");
  check(/t\(`cashbook\.entryType\.\$\{o\.value\}`\)/.test(formCode), "فرم: برچسب دکمه‌های نوع از cashbook.entryType.*");
  check(/t\(`cashbook\.entryType\.\$\{entry\.type\}`\)/.test(receiptCode), "رسید: نوع تراکنش از cashbook.entryType.*");
  check(!/direction:\s*"rtl"/.test(receiptCode) && /direction:\s*dir/.test(receiptCode) && /getLanguageInfo\(i18n\.language/.test(receiptCode) && !/i18n\.dir\(/.test(receiptCode), "رسید: جهت از جدول زبان‌های پروژه می‌آید (نه rtl ثابت، نه i18n.dir() که برای ku غلط است)");
  check(/t\("common\.cancel"\)/.test(formCode) && /t\("common\.close"\)/.test(formCode), "فرم: انصراف/بستن از common.*");

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    const keys = [...formKeys, ...receiptKeys];
    console.log(`\n— زبان (ایستا): ${lang}`);
    check(keys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${keys.length} کلید موجود است`);
    check(keys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    const opt = t("cashbook.form.fundOptionDefault", { name: "NM" });
    check(opt.includes("NM") && !opt.includes("{{"), `${lang}: گزینهٔ صندوق پیش‌فرض نام را می‌گیرد`);
    const foot = t("cashbook.receipt.footer", { brand: "BR" });
    check(foot.includes("BR") && !foot.includes("{{"), `${lang}: فوتر رسید نام برند را می‌گیرد`);
    check(t("cashbook.receipt.brand") === (lang === "fa" ? "کارگاه‌یار" : t("app.name")), `${lang}: برند رسید ${lang === "fa" ? "«کارگاه‌یار»" : "همان app.name"} است`);
    const rowLabels = ["rowType", "rowTitle", "rowDate", "rowWorker", "rowNotes", "rowId"].map((k) => t(`cashbook.receipt.${k}`));
    check(new Set(rowLabels).size === 6, `${lang}: برچسب ردیف‌های رسید متمایزند`);
    const errs = ["errTitle", "errAmount", "errFund"].map((k) => t(`cashbook.form.${k}`));
    check(new Set(errs).size === 3, `${lang}: سه پیام خطای اعتبارسنجی متمایزند`);
    if (lang !== "fa") {
      const allowed = new Set((SHARED_WITH_FA[lang] ?? []).map((k) => k));
      const same = keys.filter((k) => t(k) === fa(k) && !allowed.has(k));
      check(same.length === 0, `${lang}: هیچ کلیدی عیناً فارسی نیست (به‌جز واژه‌های مشترک فهرست‌شده)${same.length ? " (" + same.join(",") + ")" : ""}`);
      check([...allowed].every((k) => t(k) === fa(k)), `${lang}: فهرست واژه‌های مشترک بی‌استفاده نیست`);
    }
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      check(keys.every((k) => !PERSIAN_ARABIC_RE.test(t(k))), `${lang}: هیچ حرف فارسی/عربی در ترجمه‌ها نیست`);
    }
  }

  console.log("\n— رندر SSR");
  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان (رندر): ${lang}`);

    const formHtml = renderForm();
    const form = toText(formHtml);
    check(form.length > 300, `${lang}: فرم رندر شد (${form.length} نویسه)`);
    check(!/cashbook\.(form|entryType)\.|common\.(cancel|close)/.test(formHtml), `${lang}: فرم: کلید خام نشت نکرده`);
    check(!form.includes("{{"), `${lang}: فرم: placeholder جایگزین‌نشده نمانده`);
    check(form.includes(t("cashbook.form.titleNew")), `${lang}: عنوان دیالوگ (ثبت جدید)`);
    for (const k of ["titleLabel", "fundLabel", "amountLabel", "dateLabel", "descLabel", "receiptLabel", "addReceipt", "submit"]) {
      check(form.includes(t(`cashbook.form.${k}`)), `${lang}: فرم: ${k} ترجمه شده`);
    }
    check(formHtml.includes(`placeholder="${t("cashbook.form.titlePlaceholder")}"`), `${lang}: placeholder عنوان (صفت HTML) ترجمه شده`);
    check(["expense", "salary", "deposit"].every((x) => form.includes(t(`cashbook.entryType.${x}`))), `${lang}: سه دکمهٔ نوع تراکنش ترجمه شده`);
    check(form.includes(t("common.cancel")), `${lang}: دکمهٔ انصراف از common.cancel`);
    check(formHtml.includes(`aria-label="${t("common.close")}"`), `${lang}: aria-label بستن از common.close`);
    check(!form.includes(t("cashbook.form.titleEdit")) || t("cashbook.form.titleEdit") === t("cashbook.form.titleNew"), `${lang}: عنوان «ویرایش» در حالت ثبت جدید نیست`);

    const dirAttr = getLanguageInfo(lang as never).dir;
    for (const type of ["deposit", "expense"]) {
      const html = renderReceipt(type, { withWorker: true, withImage: true });
      const rcpt = toText(html);
      check(!/cashbook\.(receipt|entryType)\./.test(html) && !rcpt.includes("{{"), `${lang}/${type}: رسید: کلید خام/placeholder نشت نکرده`);
      check(rcpt.includes(t("cashbook.receipt.title")), `${lang}/${type}: عنوان رسید`);
      check(rcpt.includes(t(type === "deposit" ? "cashbook.receipt.amountDeposit" : "cashbook.receipt.amountPaid")), `${lang}/${type}: برچسب مبلغ`);
      check(!rcpt.includes(t(type === "deposit" ? "cashbook.receipt.amountPaid" : "cashbook.receipt.amountDeposit")) || t("cashbook.receipt.amountPaid") === t("cashbook.receipt.amountDeposit"), `${lang}/${type}: برچسب مبلغ مخالف نیست`);
      for (const k of ["rowType", "rowTitle", "rowDate", "rowWorker", "rowNotes", "rowId", "photoLabel"]) {
        check(rcpt.includes(t(`cashbook.receipt.${k}`)), `${lang}/${type}: رسید: ${k}`);
      }
      check(rcpt.includes(t(`cashbook.entryType.${type}`)), `${lang}/${type}: نوع تراکنش ترجمه شده`);
      check(html.includes(`alt="${t("cashbook.receipt.photoAlt")}"`), `${lang}/${type}: alt عکس رسید`);
      check(rcpt.includes("ENTRY-TITLE") && rcpt.includes("ENTRY-NOTES") && rcpt.includes("WORKER-NAME") && rcpt.includes("ABCDEF12"), `${lang}/${type}: داده‌ها (عنوان/توضیح/نیرو/شناسه) دست‌نخورده`);
      check(new RegExp(`direction:\\s*${dirAttr}`).test(html), `${lang}/${type}: جهت کارت رسید ${dirAttr} است`);
      check(rcpt.includes(t("cashbook.receipt.footer", { brand: t("cashbook.receipt.brand") })), `${lang}/${type}: فوتر رسید با نام برند`);
      check(rcpt.includes(t("cashbook.receipt.brand")), `${lang}/${type}: بدون نام پروژه، نام برند در هدر`);
    }
    const bare = toText(renderReceipt("expense", { withWorker: false, withImage: false, project: "MY-PROJECT" }));
    check(bare.includes("MY-PROJECT") && !bare.includes(t("cashbook.receipt.rowWorker")) && !bare.includes(t("cashbook.receipt.photoLabel")), `${lang}: بدون نیرو/عکس این ردیف‌ها نیستند و نام پروژه جای برند می‌آید`);

    if (lang !== "fa") {
      check(!form.includes(i18n.getFixedT("fa")("cashbook.form.titleNew")), `${lang}: فرم عیناً فارسی نیست`);
    }
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      let all = form + " " + toText(renderReceipt("deposit", { withWorker: true, withImage: true }));
      for (const c of Object.values(CURRENCIES)) all = all.split(c.symbol).join(" ");
      const m = all.match(PERSIAN_ARABIC_RE);
      if (m) console.log("    متن فارسی باقی‌مانده:", all.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 80));
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
