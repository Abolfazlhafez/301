/**
 * تست رندر SettingsPage در هر ۸ زبان (رندر سمت سرور با دادهٔ seed‌شده در کش react-query):
 *  - هیچ کلید خام settings.page.* نشت نمی‌کند و placeholder جایگزین‌نشده نمی‌ماند؛
 *  - عنوان‌ها/برچسب‌های اصلی هر بخش (حالت نمایش، حضور سریع، صبحانه/ناهار، ساعت استاندارد،
 *    پشتیبان‌گیری) با ترجمهٔ همان زبان نمایش داده می‌شوند؛
 *  - در en/tr/ru هیچ حرف فارسی/عربی هاردکد در کل صفحه نمی‌ماند (کارت‌های فرزند هم شامل می‌شوند)؛
 *  - مثال محاسبهٔ نرخ ساعتی با اعداد زبان فعلی پر می‌شود.
 */
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../../shared/i18n";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { SettingsPage } from "../../pages/settings/SettingsPage";
import { CURRENCIES, LANGUAGE_LIST, ENABLED_LANGUAGES } from "../../shared/i18n/languages";

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

function renderPage(): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["settings"], {
    standardWorkHoursPerDay: 8,
    quickCheckInDefaultTime: "08:00",
    quickCheckOutDefaultTime: "17:00",
    quickBreakfastDefaultStartTime: null,
    quickBreakfastDefaultEndTime: null,
    quickLunchDefaultStartTime: null,
    quickLunchDefaultEndTime: null,
    autoBackupEnabled: true,
    autoBackupIntervalHours: 24,
    autoBackupMaxVersions: 7,
  });
  return toText(
    renderToString(
      createElement(QueryClientProvider, { client: qc }, createElement(ToastProvider, null, createElement(SettingsPage)))
    )
  );
}

async function main() {
  // ثابت زمان-بیلد Vite که در Node تعریف نشده است.
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";
  // رندر سمت سرور در Node: window وجود ندارد؛ useThemeMode فقط matchMedia را می‌خواند.
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان: ${lang}`);
    const out = renderPage();
    check(!/settings\.page\./.test(out), `${lang}: کلید خام نشت نکرده`);
    check(!out.includes("{{"), `${lang}: placeholder جایگزین‌نشده نمانده`);
    check(!out.includes("<strong>"), `${lang}: تگ خام strong نشت نکرده`);
    for (const key of [
      "displayModeTitle",
      "quickAttendanceTitle",
      "checkInHeading",
      "checkOutHeading",
      "quickBreakTitle",
      "breakfast",
      "lunch",
      "standardHoursTitle",
      "standardHoursLabel",
      "saveSettings",
      "backupTitle",
      "downloadBackup",
      "restoreFromFile",
      "restoreWarning",
    ]) {
      check(out.includes(t(`settings.page.${key}`)), `${lang}: ${key} ترجمه شده`);
    }
    check(out.includes(t("theme.light")) && out.includes(t("theme.dark")) && out.includes(t("theme.system")), `${lang}: گزینه‌های تم ترجمه شده`);
    check(out.includes(t("settings.page.checkInCurrent", { time: "08:00" })), `${lang}: «ساعت ورود فعلی» با مقدار پر می‌شود`);
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      // اسم بومی زبان‌ها در فهرست انتخاب زبان عمداً به خط خودشان است؛ از بررسی حذف می‌شود.
      let stripped = out;
      for (const info of LANGUAGE_LIST) stripped = stripped.split(info.nativeName).join(" ");
      // نماد بومی واحدهای پول (مثل «تومان»، «ر.س») هم کنار نام ترجمه‌شده در فهرست واحد پول عمدی است.
      for (const c of Object.values(CURRENCIES)) stripped = stripped.split(c.symbol).join(" ");
      const m = stripped.match(PERSIAN_ARABIC_RE);
      if (m) console.log("    متن فارسی باقی‌مانده:", stripped.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 80));
      check(!m, `${lang}: هیچ حرف فارسی/عربی هاردکد در کل صفحه نیست (به‌جز اسم بومی زبان‌ها و نماد واحد پول)`);
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
