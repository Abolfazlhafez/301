/**
 * تست رندر StartupErrorScreen (رندر سمت سرور؛ effectها اجرا نمی‌شوند، پس فقط وضعیت اولیه بررسی می‌شود):
 *  - خطای عمومی: پیام عمومی + دکمهٔ تلاش دوباره + جزئیات خطا، بدون هیچ گزینهٔ بازیابی؛
 *  - خطای مهاجرت: پیام مخصوص مهاجرت (و در حال بارگذاری فهرست بکاپ)، نه پیام عمومی.
 * منطق بازیابی خودش در test:migration-recovery پوشش داده شده است.
 */
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import i18n from "../../shared/i18n";
import { StartupErrorScreen } from "../../shared/components/StartupErrorScreen";
import { LegacyMigrationError } from "../storage/migrateFromIndexedDb";

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
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

async function main() {
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));
  await i18n.changeLanguage("fa");
  const t = (key: string) => i18n.t(key);

  const generic = toText(renderToString(createElement(StartupErrorScreen, { error: new Error("boom-generic-123") })));
  check(generic.includes(t("startupError.title")), "عنوان صفحهٔ خطا نمایش داده می‌شود");
  check(generic.includes(t("startupError.genericBody")), "خطای عمومی: پیام عمومی نمایش داده می‌شود");
  check(!generic.includes(t("startupError.migrationBody")), "خطای عمومی: پیام مهاجرت نمایش داده نمی‌شود");
  check(generic.includes(t("common.retry")), "دکمهٔ تلاش دوباره وجود دارد");
  check(generic.includes("boom-generic-123"), "جزئیات خطا نمایش داده می‌شود");
  check(!generic.includes(t("startupError.restoreLatest")), "خطای عمومی: گزینهٔ بازیابی از بکاپ نیست");

  const migration = toText(renderToString(createElement(StartupErrorScreen, { error: new LegacyMigrationError("boom-migration-456") })));
  check(migration.includes(t("startupError.migrationBody")), "خطای مهاجرت: پیام مخصوص مهاجرت نمایش داده می‌شود");
  check(!migration.includes(t("startupError.genericBody")), "خطای مهاجرت: پیام عمومی نمایش داده نمی‌شود");
  check(migration.includes(t("common.retry")), "خطای مهاجرت: دکمهٔ تلاش دوباره وجود دارد");
  check(migration.includes("boom-migration-456"), "خطای مهاجرت: جزئیات خطا نمایش داده می‌شود");

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
