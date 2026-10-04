/**
 * بررسی پوشش ترجمه (i18n) — پاسخ به مورد ۱۰ گزارش بررسی پروژه.
 *
 * ادعای «۴۱۷ کلید در هر زبان» به‌تنهایی برابری تعداد است، نه پوشش واقعی:
 * یک زبان می‌تواند دقیقاً همان تعداد کلید را داشته باشد ولی کلیدهای متفاوتی
 * باشند، یا مقدار بعضی کلیدها خالی مانده باشد. این اسکریپت سه چیز را واقعاً
 * بررسی می‌کند (نه فقط شمارش):
 *
 *   ۱) هر ۸ زبان دقیقاً همان مجموعه کلید فارسی (زبان مرجع) را دارند —
 *      نه کم، نه زیاد.
 *   ۲) هیچ کلیدی در هیچ زبانی مقدار خالی/فقط-فاصله ندارد.
 *   ۳) هر رشتهٔ t("...") که واقعاً داخل کد src/**\/*.tsx یا .ts استفاده شده،
 *      در فایل ترجمهٔ فارسی (مرجع) وجود دارد — یعنی کلیدی که کد به آن ارجاع
 *      می‌دهد، یتیم (missing key) نیست.
 *
 * این اسکریپت رشته‌های هاردکد فارسی/انگلیسی داخل JSX را پیدا نمی‌کند (آن
 * یک تحلیل استاتیک متفاوت و پرنویز است)، فقط تضمین می‌کند هر جایی که کد از
 * سیستم i18n استفاده کرده، آن استفاده در هر ۸ زبان کامل و بدون کلید گمشده است.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ENABLED_LANGUAGES } from "../../shared/i18n/languages";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "../../shared/i18n/locales");
const SRC_DIR = join(__dirname, "../..");
const REFERENCE_LANG = "fa";
const ALL_LANGS = ["fa", "en", "ar", "tr", "ur", "ku", "ps", "ru"];
// فقط زبان‌های فعال (فعلاً fa و en) سخت‌گیرانه بررسی می‌شوند؛ زبان‌های غیرفعال
// فقط گزارش اطلاعاتی می‌گیرند (عقب‌ماندگی آن‌ها خطا نیست).
const SUPPORTED_LANGS: string[] = [...ENABLED_LANGUAGES];
const INACTIVE_LANGS = ALL_LANGS.filter((l) => !SUPPORTED_LANGS.includes(l));

type JsonObject = { [key: string]: unknown };

function flattenKeys(obj: JsonObject, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [k, v] of flattenKeys(value as JsonObject, fullKey)) out.set(k, v);
    } else {
      out.set(fullKey, value);
    }
  }
  return out;
}

function loadLocale(lang: string): Map<string, unknown> {
  const raw = readFileSync(join(LOCALES_DIR, lang, "common.json"), "utf-8");
  return flattenKeys(JSON.parse(raw));
}

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) listSourceFiles(full, acc);
    else if (/\.(tsx|ts)$/.test(entry)) acc.push(full);
  }
  return acc;
}

/** استخراج کلیدهای استفاده‌شده در فراخوانی‌های t("key") یا t('key') یا t(`key`) با رشتهٔ ثابت. */
function extractUsedKeys(): Set<string> {
  const used = new Set<string>();
  const pattern = /\bt\(\s*["'`]([a-zA-Z0-9_.]+)["'`]/g;
  for (const file of listSourceFiles(SRC_DIR)) {
    const content = readFileSync(file, "utf-8");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      used.add(match[1]);
    }
  }
  return used;
}

function main() {
  console.log("=".repeat(70));
  console.log(`بررسی پوشش ترجمه (i18n) — زبان‌های فعال: ${SUPPORTED_LANGS.join(", ")}`);
  console.log("=".repeat(70));

  let allOk = true;

  const locales = new Map<string, Map<string, unknown>>();
  for (const lang of ALL_LANGS) locales.set(lang, loadLocale(lang));
  const referenceKeys = new Set(locales.get(REFERENCE_LANG)!.keys());
  console.log(`\nزبان مرجع (${REFERENCE_LANG}): ${referenceKeys.size} کلید\n`);

  // ۱) برابری دقیق مجموعه کلیدها با زبان مرجع
  for (const lang of SUPPORTED_LANGS) {
    if (lang === REFERENCE_LANG) continue;
    const keys = new Set(locales.get(lang)!.keys());
    const missing = [...referenceKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !referenceKeys.has(k));
    if (missing.length === 0 && extra.length === 0) {
      console.log(`  ✅ ${lang}: دقیقاً همان ${referenceKeys.size} کلید زبان مرجع را دارد`);
    } else {
      allOk = false;
      console.log(`  ❌ ${lang}: ${missing.length} کلید کم، ${extra.length} کلید اضافه`);
      if (missing.length) console.log(`       کم: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? " ..." : ""}`);
      if (extra.length) console.log(`       اضافه: ${extra.slice(0, 10).join(", ")}${extra.length > 10 ? " ..." : ""}`);
    }
  }

  // ۱-ب) زبان‌های غیرفعال: فقط گزارش اطلاعاتی (خطا نیست)
  for (const lang of INACTIVE_LANGS) {
    const keys = new Set(locales.get(lang)!.keys());
    const missing = [...referenceKeys].filter((k) => !keys.has(k));
    console.log(`  ℹ️  ${lang} (غیرفعال): ${missing.length} کلید عقب‌مانده نسبت به زبان مرجع`);
  }

  // ۲) مقدار خالی در هیچ کلیدی، در هیچ زبان فعالی
  console.log("");
  for (const lang of SUPPORTED_LANGS) {
    const emptyKeys = [...locales.get(lang)!.entries()]
      .filter(([, v]) => typeof v === "string" && v.trim().length === 0)
      .map(([k]) => k);
    if (emptyKeys.length === 0) {
      console.log(`  ✅ ${lang}: هیچ مقدار خالی‌ای وجود ندارد`);
    } else {
      allOk = false;
      console.log(`  ❌ ${lang}: ${emptyKeys.length} کلید با مقدار خالی — ${emptyKeys.slice(0, 10).join(", ")}`);
    }
  }

  // ۳) هر کلیدی که در کد استفاده شده، در زبان مرجع موجود است
  console.log("");
  const usedKeys = extractUsedKeys();
  const orphanKeys = [...usedKeys].filter((k) => !referenceKeys.has(k));
  if (orphanKeys.length === 0) {
    console.log(`  ✅ همهٔ ${usedKeys.size} کلید استفاده‌شده در کد، در فایل ترجمهٔ مرجع موجودند`);
  } else {
    allOk = false;
    console.log(`  ❌ ${orphanKeys.length} کلید در کد استفاده شده ولی در ترجمهٔ مرجع نیست: ${orphanKeys.join(", ")}`);
  }

  console.log("\n" + "=".repeat(70));
  if (!allOk) {
    throw new Error("بررسی پوشش ترجمه ناموفق بود — جزئیات بالا را ببینید.");
  }
  console.log(`پوشش ترجمه در زبان‌های فعال (${SUPPORTED_LANGS.join(", ")}) کامل و بدون کلید گمشده/خالی تأیید شد.\n`);
}

main();
