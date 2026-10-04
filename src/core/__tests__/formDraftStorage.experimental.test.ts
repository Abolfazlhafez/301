/**
 * تست تجربی واقعی ماژول formDraftStorage.ts — با خودِ پلاگین واقعی
 * @capacitor/preferences (نه یک mock دستی)، از طریق fallback حالت وب آن
 * (localStorage)، که با یک window/localStorage حداقلی در Node فعال می‌شود.
 *
 * چرا این shim به‌جای mock کامل پلاگین: پلاگین @capacitor/preferences در
 * نبود window با خطای صریح شکست می‌خورد (بررسی‌شده)؛ بعد از افزودن یک
 * window.localStorage حداقلی، خودِ کد واقعی پلاگین (نه بازنویسی من) اجرا
 * می‌شود — یعنی این تست واقعاً منطق serialize/parse/set/get/remove پلاگین
 * را هم پوشش می‌دهد، نه فقط توابع خودم.
 */

// --- راه‌اندازی window.localStorage حداقلی، قبل از import کردن پلاگین ---
const localStorageBackingStore = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => (localStorageBackingStore.has(k) ? localStorageBackingStore.get(k)! : null),
    setItem: (k: string, v: string) => localStorageBackingStore.set(k, String(v)),
    removeItem: (k: string) => localStorageBackingStore.delete(k),
  },
};

import { saveDraft, loadDraft, clearDraft, DRAFT_MAX_AGE_MS } from "../../shared/hooks/formDraftStorage";

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, testName: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}`);
    console.log(`     انتظار: ${JSON.stringify(expected)}`);
    console.log(`     دریافت: ${JSON.stringify(actual)}`);
  }
}

interface SampleFormData {
  title: string;
  amount: string;
}

async function main() {
  console.log("=".repeat(70));
  console.log("تست ۱: ذخیره و بازخوانی یک پیش‌نویس واقعی (با پلاگین واقعی @capacitor/preferences)");
  console.log("=".repeat(70));

  const sample: SampleFormData = { title: "خرید سیمان — پیش‌نویس", amount: "4500000" };
  await saveDraft("cashbook-entry-new", sample);
  const loaded = await loadDraft<SampleFormData>("cashbook-entry-new");
  assertEqual(loaded, sample, "پیش‌نویس ذخیره‌شده دقیقاً همان مقدار اصلی را برمی‌گرداند");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۲: پاک کردن پیش‌نویس واقعاً آن را حذف می‌کند");
  console.log("=".repeat(70));

  await clearDraft("cashbook-entry-new");
  const afterClear = await loadDraft<SampleFormData>("cashbook-entry-new");
  assertEqual(afterClear, null, "بعد از clearDraft، خواندن دوباره null برمی‌گرداند");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۳: پیش‌نویس‌های مختلف با کلیدهای متفاوت با هم تداخل ندارند");
  console.log("=".repeat(70));

  await saveDraft("form-a", { title: "فرم اول", amount: "100" });
  await saveDraft("form-b", { title: "فرم دوم", amount: "200" });
  const loadedA = await loadDraft<SampleFormData>("form-a");
  const loadedB = await loadDraft<SampleFormData>("form-b");
  assertEqual(loadedA?.title, "فرم اول", "پیش‌نویس form-a صحیح است");
  assertEqual(loadedB?.title, "فرم دوم", "پیش‌نویس form-b صحیح است و با form-a قاطی نشده");
  await clearDraft("form-a");
  await clearDraft("form-b");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۴: پیش‌نویس منقضی‌شده (بیش از ۲۴ ساعت) نادیده گرفته و پاک می‌شود");
  console.log("=".repeat(70));

  // به‌جای صبر کردن ۲۴ ساعت واقعی، مستقیماً یک StoredDraft با savedAt قدیمی
  // را با همان فرمتی که خودِ ماژول تولید می‌کند، در Preferences می‌نویسیم.
  const { Preferences } = await import("@capacitor/preferences");
  const oldTimestamp = new Date(Date.now() - DRAFT_MAX_AGE_MS - 60_000).toISOString(); // یک دقیقه بیشتر از سقف مجاز
  await Preferences.set({
    key: "form-draft:expired-form",
    value: JSON.stringify({ savedAt: oldTimestamp, data: { title: "قدیمی", amount: "999" } }),
  });
  const expiredResult = await loadDraft<SampleFormData>("expired-form");
  assertEqual(expiredResult, null, "پیش‌نویس منقضی‌شده هنگام خواندن null برمی‌گرداند (نه دادهٔ قدیمی)");

  const afterExpiredRead = await Preferences.get({ key: "form-draft:expired-form" });
  assertEqual(afterExpiredRead.value, null, "پیش‌نویس منقضی‌شده در همان لحظهٔ تشخیص، از Storage هم پاک شد");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۵: پیش‌نویس نزدیک به مرز (کمی کمتر از ۲۴ ساعت) هنوز معتبر است");
  console.log("=".repeat(70));

  const almostExpiredTimestamp = new Date(Date.now() - DRAFT_MAX_AGE_MS + 60_000).toISOString(); // یک دقیقه کمتر از سقف
  await Preferences.set({
    key: "form-draft:almost-expired-form",
    value: JSON.stringify({ savedAt: almostExpiredTimestamp, data: { title: "تازه به مرز رسیده", amount: "1" } }),
  });
  const almostExpiredResult = await loadDraft<SampleFormData>("almost-expired-form");
  assertEqual(
    almostExpiredResult?.title,
    "تازه به مرز رسیده",
    "پیش‌نویسی که هنوز کمی داخل بازهٔ مجاز است، به‌درستی بازیابی می‌شود (مرز دقیق است)"
  );
  await clearDraft("almost-expired-form");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۶: خواندن یک کلید که هرگز ذخیره نشده، بدون خطا null می‌دهد");
  console.log("=".repeat(70));

  const neverSaved = await loadDraft<SampleFormData>("never-saved-key-xyz");
  assertEqual(neverSaved, null, "کلید ذخیره‌نشده، null برمی‌گرداند (نه throw)");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۷: داده خراب/غیرقابل‌پارس در Storage باعث throw نمی‌شود، فقط null می‌دهد");
  console.log("=".repeat(70));

  await Preferences.set({ key: "form-draft:corrupted", value: "این یک JSON معتبر نیست {{{" });
  let threw = false;
  let corruptedResult: unknown;
  try {
    corruptedResult = await loadDraft("corrupted");
  } catch {
    threw = true;
  }
  assertEqual(threw, false, "داده خراب باعث پرتاب خطا نمی‌شود");
  assertEqual(corruptedResult, null, "داده خراب به‌جای throw، مقدار null برمی‌گرداند");

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));

  if (failed > 0) {
    throw new Error(`${failed} بررسی ناموفق بود.`);
  }
}

main().catch((err) => {
  console.error("خطای اجرای تست:", err);
  throw err;
});
