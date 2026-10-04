/**
 * تست رندر AutoBackupCard در هر ۸ زبان (رندر سمت سرور با دادهٔ seed‌شده در کش react-query):
 *  - هیچ کلید ترجمهٔ خام (settings.autoBackup.*) در خروجی نشت نمی‌کند؛
 *  - متن‌های اصلی کارت با ترجمهٔ همان زبان نمایش داده می‌شوند؛
 *  - در زبان‌های لاتین/سیریلیک هیچ متن فارسی هاردکد باقی نمی‌ماند؛
 *  - شاخهٔ غیر-نیتیو (مرورگر) هم پیام مخصوص خودش را نشان می‌دهد.
 * منطق بکاپ/بازیابی خودش در تست‌های backup-* پوشش داده شده است.
 */
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import i18n from "../../shared/i18n";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { AutoBackupCard } from "../../widgets/auto-backup/AutoBackupCard";
import { ENABLED_LANGUAGES } from "../../shared/i18n/languages";

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

function renderCard(native: boolean): string {
  (Capacitor as unknown as { isNativePlatform: () => boolean }).isNativePlatform = () => native;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["settings"], {
    autoBackupEnabled: true,
    autoBackupIntervalHours: 24,
    autoBackupMaxVersions: 7,
    lastAutoBackupAt: new Date().toISOString(),
  });
  qc.setQueryData(["auto-backups"], [
    { fileName: "a.json", createdAt: new Date().toISOString(), sizeBytes: 500 },
    { fileName: "b.json", createdAt: new Date(Date.now() - 86400000).toISOString(), sizeBytes: 3 * 1024 * 1024 },
  ]);
  return toText(
    renderToString(
      createElement(QueryClientProvider, { client: qc }, createElement(ToastProvider, null, createElement(AutoBackupCard)))
    )
  );
}

async function main() {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان: ${lang}`);

    const native = renderCard(true);
    check(!/settings\.autoBackup\./.test(native), `${lang}: کلید خام نشت نکرده`);
    check(native.includes(t("settings.autoBackup.title")), `${lang}: عنوان کارت ترجمه شده`);
    check(native.includes(t("settings.autoBackup.whereTitle")), `${lang}: عنوان «کجا ذخیره می‌شود» ترجمه شده`);
    check(native.includes(t("settings.autoBackup.enableLabel")), `${lang}: برچسب سوئیچ ترجمه شده`);
    check(native.includes(t("settings.autoBackup.interval24h")), `${lang}: گزینهٔ فاصله ترجمه شده`);
    check(native.includes(t("settings.autoBackup.runNow")), `${lang}: دکمهٔ ساخت بکاپ ترجمه شده`);
    check(native.includes(t("settings.autoBackup.savedListTitle")), `${lang}: عنوان فهرست ترجمه شده`);
    check(native.includes(t("settings.autoBackup.newest")), `${lang}: چیپ «جدیدترین» ترجمه شده`);
    check(native.includes(t("settings.autoBackup.footerNote")), `${lang}: یادداشت پایانی ترجمه شده`);
    check(!native.includes("{{"), `${lang}: placeholder جایگزین‌نشده نمانده`);
    check(!native.includes("<strong>"), `${lang}: تگ خام strong نشت نکرده`);
    check(native.includes("Android/data/ir.karegahyar.app/files/KaregahYar/backups"), `${lang}: مسیر پوشهٔ بکاپ حفظ شده`);
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      check(!PERSIAN_ARABIC_RE.test(native), `${lang}: هیچ حرف فارسی/عربی هاردکد در خروجی نیست`);
    }

    const web = renderCard(false);
    check(web.includes(t("settings.autoBackup.webOnly")), `${lang}: پیام مرورگر (غیر-نیتیو) ترجمه شده`);
    check(!web.includes(t("settings.autoBackup.runNow")), `${lang}: در مرورگر دکمهٔ بکاپ نیتیو نمایش داده نمی‌شود`);
  }

  // اندازه‌ها: واحد از ترجمهٔ همان زبان می‌آید.
  await i18n.changeLanguage("en");
  const en = renderCard(true);
  check(en.includes("500 bytes"), "en: اندازهٔ ۵۰۰ بایت با واحد انگلیسی");
  check(en.includes("3.0 MB"), "en: اندازهٔ ۳ مگابایت با واحد انگلیسی");
  await i18n.changeLanguage("fa");
  const fa = renderCard(true);
  check(fa.includes("بایت") && fa.includes("مگابایت"), "fa: واحدهای اندازه فارسی هستند");

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
