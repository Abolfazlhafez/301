/**
 * تست انتقال تنظیمات از localStorage به @capacitor/preferences:
 *  - مهاجرت کپی‌وتطبیق‌شده و حذف از localStorage؛
 *  - Preferences بر localStorage اولویت دارد؛
 *  - getPref بعد از bootstrap همگام است؛ setPref پایدار می‌شود؛
 *  - محافظ: هیچ فایل غیرتستی به‌جز appPreferences.ts مستقیم از localStorage نمی‌خواند/نمی‌نویسد.
 */
const store = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
(globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage };
(globalThis as { localStorage?: unknown }).localStorage = fakeLocalStorage;

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Preferences } from "@capacitor/preferences";
import {
  PREF_KEYS,
  __resetAppPreferencesForTest,
  bootstrapAppPreferences,
  flushPrefWrites,
  getPref,
  setPref,
} from "../../shared/storage/appPreferences";

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

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

async function main() {
  // 1) مهاجرت
  store.set(PREF_KEYS.themeMode, "dark");
  store.set(PREF_KEYS.language, "en");
  await bootstrapAppPreferences();
  check(getPref(PREF_KEYS.themeMode) === "dark", "مقدار تم بعد از bootstrap همگام خوانده می‌شود");
  check(getPref(PREF_KEYS.language) === "en", "مقدار زبان بعد از bootstrap همگام خوانده می‌شود");
  check((await Preferences.get({ key: PREF_KEYS.themeMode })).value === "dark", "تم در Preferences نوشته شد");
  check(fakeLocalStorage.getItem(PREF_KEYS.themeMode) === null, "تم بعد از تطبیق از localStorage حذف شد");
  check(getPref(PREF_KEYS.currency) === null, "کلید ناموجود null است");

  // 2) setPref پایدار می‌شود
  setPref(PREF_KEYS.currency, "USD");
  check(getPref(PREF_KEYS.currency) === "USD", "setPref همان لحظه در cache دیده می‌شود");
  await flushPrefWrites();
  check((await Preferences.get({ key: PREF_KEYS.currency })).value === "USD", "setPref در Preferences پایدار شد");

  // 3) راه‌اندازی دوباره (شبیه بستن/باز کردن اپ): Preferences بر localStorage قدیمی اولویت دارد
  __resetAppPreferencesForTest();
  store.set(PREF_KEYS.currency, "EUR");
  await bootstrapAppPreferences();
  check(getPref(PREF_KEYS.currency) === "USD", "Preferences بر localStorage اولویت دارد");
  check(getPref(PREF_KEYS.themeMode) === "dark", "تم بعد از راه‌اندازی دوباره حفظ شد");

  // 4) محافظ رگرسیون
  const offenders: string[] = [];
  for (const f of walk("src")) {
    if (f.endsWith("appPreferences.ts")) continue;
    if (/localStorage\.(getItem|setItem|removeItem)/.test(readFileSync(f, "utf8"))) offenders.push(f);
  }
  check(offenders.length === 0, `استفادهٔ مستقیم از localStorage خارج از appPreferences.ts نیست ${offenders.join(", ")}`);

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));
  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
}

main().catch((err) => {
  console.error("خطای اجرای تست:", err);
  process.exit(1);
});
