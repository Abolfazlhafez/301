/**
 * تست i18n فرم فعالیت آینده (FutureActivityFormDialog) در هر ۸ زبان:
 *  - رندر سمت سرور حالت «افزودن» (بدون DOM؛ effectها اجرا نمی‌شوند، پس بخش تکرار/حالت ویرایش رندر نمی‌شود):
 *    کلید خام نشت نکند، placeholder جایگزین‌نشده نماند، برچسب‌ها ترجمهٔ همان زبان باشند،
 *    در en/tr/ru حرف فارسی/عربی هاردکد نماند (به‌جز نماد بومی واحد پول).
 *  - پوشش ایستا برای شاخه‌هایی که رندر نمی‌شوند: همهٔ کلیدهای futureActivities.form.* در کد استفاده شده‌اند،
 *    در ۸ زبان هستند، placeholderهایشان با fa یکی است و interpolation واقعاً جایگزین می‌شود.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { FutureActivityFormDialog } from "../../widgets/future-activities/FutureActivityFormDialog";
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
// Portal در رندر سمت سرور چیزی نمی‌سازد؛ با disablePortal محتوای دیالوگ مستقیم رندر می‌شود.
const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });

function renderDialog(): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["workers", { isActive: true }], []);
  return toText(
    renderToString(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ThemeProvider,
          { theme },
          createElement(FutureActivityFormDialog, { open: true, onClose() {}, onSubmit() {} })
        )
      )
    )
  );
}

function renderDialogHtml(): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["workers", { isActive: true }], []);
  return renderToString(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        ThemeProvider,
        { theme },
        createElement(FutureActivityFormDialog, { open: true, onClose() {}, onSubmit() {} })
      )
    )
  ).replace(/&#x27;|&#39;/g, "'");
}

function placeholders(s: string): string {
  return (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(",");
}

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  const src = readFileSync(new URL("../../widgets/future-activities/FutureActivityFormDialog.tsx", import.meta.url), "utf8");
  const usedKeys = new Set([...src.matchAll(/"(futureActivities\.form\.\w+)"/g)].map((m) => m[1]));
  const faForm = (i18n.getResourceBundle("fa", "common") as { futureActivities: { form: Record<string, string> } }).futureActivities.form;
  const definedKeys = Object.keys(faForm).map((k) => `futureActivities.form.${k}`);

  console.log("\n— پوشش ایستا");
  check(usedKeys.size > 0, `کد حداقل یک کلید futureActivities.form.* استفاده می‌کند (${usedKeys.size})`);
  check(definedKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای در futureActivities.form نیست");
  check([...usedKeys].every((k) => definedKeys.includes(k)), "هر کلید استفاده‌شده در کد تعریف شده است");
  const srcNoComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  check(!PERSIAN_ARABIC_RE.test(srcNoComments), "هیچ حرف فارسی/عربی هاردکد در کد (غیرکامنت) نمانده");
  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const missing = definedKeys.filter((k) => !i18n.exists(k, { lng: lang, fallbackLng: [] }));
    check(missing.length === 0, `${lang}: همهٔ ${definedKeys.length} کلید موجود است`);
    const badPh = definedKeys.filter((k) => placeholders(t(k)) !== placeholders(i18n.getFixedT("fa")(k)));
    check(badPh.length === 0, `${lang}: placeholderها با fa یکی است`);
    check(t("futureActivities.form.occurrences", { max: "60" }).includes("60") && !t("futureActivities.form.occurrences", { max: "60" }).includes("{{"), `${lang}: occurrences مقدار max را می‌گیرد`);
    check(t("futureActivities.form.errOccurrences", { min: "1", max: "60" }).includes("60") && t("futureActivities.form.errOccurrences", { min: "1", max: "60" }).includes("1"), `${lang}: errOccurrences مقدار min/max را می‌گیرد`);
    for (const key of ["summaryDaily", "summaryWeekly", "summaryMonthly"]) {
      const v = t(`futureActivities.form.${key}`, { times: "TT", interval: "II" });
      check(v.includes("TT") && v.includes("II") && !v.includes("{{"), `${lang}: ${key} مقدار times/interval را می‌گیرد`);
    }
    check(new Set(["summaryDaily", "summaryWeekly", "summaryMonthly"].map((key) => t(`futureActivities.form.${key}`, { times: "T", interval: "I" }))).size === 3, `${lang}: سه جملهٔ خلاصهٔ تکرار متمایزند`);
  }

  console.log("\n— رندر حالت افزودن");
  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان: ${lang}`);
    const out = renderDialog();
    check(out.length > 200, `${lang}: دیالوگ رندر شد`);
    check(!/futureActivities\.form\./.test(out), `${lang}: کلید خام نشت نکرده`);
    check(!out.includes("{{"), `${lang}: placeholder جایگزین‌نشده نمانده`);
    for (const key of ["titleCreate", "titleField", "description", "dateDone", "multiDay", "time", "worker", "priority", "recurring", "submitCreate"]) {
      check(out.includes(t(`futureActivities.form.${key}`)), `${lang}: ${key} ترجمه شده`);
    }
    check(renderDialogHtml().includes(`placeholder="${t("futureActivities.form.titlePlaceholder")}"`), `${lang}: placeholder عنوان (صفت HTML) ترجمه شده`);
    check(out.includes(t("common.cancel")), `${lang}: دکمهٔ انصراف از common.cancel`);
    check(["low", "medium", "high"].every((p) => out.includes(t(`futureActivities.priority${p[0].toUpperCase()}${p.slice(1)}`))), `${lang}: گزینه‌های اولویت ترجمه شده`);
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      let stripped = out;
      for (const c of Object.values(CURRENCIES)) stripped = stripped.split(c.symbol).join(" ");
      const m = stripped.match(PERSIAN_ARABIC_RE);
      if (m) console.log("    متن فارسی باقی‌مانده:", stripped.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 80));
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
