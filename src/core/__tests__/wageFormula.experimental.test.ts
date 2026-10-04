/**
 * تست تجربی واقعی موتور فرمول دستمزد.
 *
 * این اسکریپت فقط Typecheck نیست — واقعاً evaluateWageFormula را روی چهار (در واقع پنج)
 * فرمول واقعی موجود در core/seedWageMethods.ts با مقادیر ورودی واقعی اجرا می‌کند،
 * نتیجهٔ عددی را با محاسبهٔ دستی مستقل مقایسه می‌کند، و ساختار گام‌به‌گام (steps) را
 * هم بررسی می‌کند تا مطمئن شویم برای «مشاهده نحوه محاسبه» قابل استفاده است.
 *
 * چهار شکل نمایندهٔ درخواست‌شده در پرامپت + یک مورد پنجم برای اطمینان بیشتر:
 *   1) meterMinusWaste              -> mul(deduct(v,v), v)         [تودرتوی binary(mul) با deduction]
 *   2) unitMinusBroken              -> mul(deduct(v,v), v)         [همان شکل با مقادیر متفاوت، تست مرز صفر]
 *   3) squareMeterWithHeightSurcharge -> mul(mul(v,v), v)          [binary تودرتوی binary، سه متغیره]
 *   4) meterWithHeightSurcharge     -> mul(mul(v,v), v)            [همان شکل، دیتای دیگر]
 *   5) countWithHeight              -> mul(mul(v,v), v)            [همان شکل، سه متغیر متفاوت — تست بازتولید ×N]
 *
 * همچنین یک تست مرزی برای خطای «تقسیم بر صفر» و یک تست برای اعتبارسنجی validateWageFormula
 * اضافه شده تا مسیرهای خطا هم (نه فقط مسیر موفق) به‌صورت واقعی اجرا شوند.
 */

import {
  evaluateWageFormula,
  validateWageFormula,
  formatWageFormula,
  wf,
  WageFormulaDefinition,
} from "../wageFormula";
import { BUILTIN_WAGE_METHODS, BUILTIN_WAGE_METHOD_IDS } from "../seedWageMethods";

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

function findSeed(id: string): WageFormulaDefinition {
  const found = BUILTIN_WAGE_METHODS.find((m) => m.id === id);
  if (!found) throw new Error(`Seed پیدا نشد: ${id}`);
  return found.formula;
}

console.log("=".repeat(70));
console.log("تست ۱: متراژ منهای پرت — مطابق مثال کاربر: ۲۰ متر دیوار منهای ۲ متر بریدگی");
console.log("=".repeat(70));
{
  const formula = findSeed(BUILTIN_WAGE_METHOD_IDS.meterMinusWaste);
  const result = evaluateWageFormula(formula, { length: 20, waste: 2, rate: 135000 });
  // محاسبه دستی مستقل: (20 - 2) * 135000 = 18 * 135000 = 2,430,000
  assertEqual(result.error, null, "بدون خطا اجرا شد");
  assertEqual(result.value, 2430000, "مقدار نهایی صحیح: (20-2)×135000 = 2,430,000");
  assertEqual(result.steps.length, 2, "دقیقاً ۲ گام ثبت شد (deduction سپس binary mul)");
  assertEqual(result.steps[0].value, 18, "گام اول: کسر پرت از طول = 18");
  assertEqual(result.steps[1].value, 2430000, "گام دوم: ضرب در نرخ = 2,430,000");
  console.log(`  فرمول خوانا: ${formatWageFormula(formula.root, Object.fromEntries(formula.variables.map((v) => [v.key, v.label])))}`);
}

console.log();
console.log("=".repeat(70));
console.log("تست ۲: تعداد منهای خرابی — مطابق مثال کاربر: ۳۰ پله منهای ۵ پله خراب");
console.log("=".repeat(70));
{
  const formula = findSeed(BUILTIN_WAGE_METHOD_IDS.unitMinusBroken);
  const result = evaluateWageFormula(formula, { count: 30, broken: 5, rate: 50000 });
  // (30 - 5) * 50000 = 25 * 50000 = 1,250,000
  assertEqual(result.error, null, "بدون خطا اجرا شد");
  assertEqual(result.value, 1250000, "مقدار نهایی صحیح: (30-5)×50000 = 1,250,000");

  // تست مرزی: broken بزرگ‌تر از count نباید عدد منفی بدهد (Math.max(0, ...) در deduction)
  const edgeResult = evaluateWageFormula(formula, { count: 10, broken: 15, rate: 50000 });
  assertEqual(edgeResult.value, 0, "مرز: وقتی خرابی بیش از کل است، نتیجه منفی نمی‌شود (کف صفر)");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۳: مترمربع با ضریب ارتفاع — بنایی نما بالای ۳ متر، ۲۵٪ افزایش");
console.log("=".repeat(70));
{
  const formula = findSeed(BUILTIN_WAGE_METHOD_IDS.squareMeterWithHeightSurcharge);
  const result = evaluateWageFormula(formula, { area: 40, rate: 90000, heightFactor: 1.25 });
  // 40 * 90000 * 1.25 = 3,600,000 * 1.25 = 4,500,000
  assertEqual(result.error, null, "بدون خطا اجرا شد");
  assertEqual(result.value, 4500000, "مقدار نهایی صحیح: 40×90000×1.25 = 4,500,000");
  assertEqual(result.steps.length, 2, "دقیقاً ۲ گام binary تودرتو ثبت شد");

  // تست پیش‌فرض: ضریب ارتفاع پیش‌فرض 1 است وقتی کاربر مقداری وارد نکند
  const defaultResult = evaluateWageFormula(formula, { area: 40, rate: 90000 });
  assertEqual(defaultResult.value, 3600000, "وقتی heightFactor داده نشود، از defaultValue=1 استفاده می‌شود");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۴: متر طول با ضریب ارتفاع — نصب سنگ نما در طبقه بالا");
console.log("=".repeat(70));
{
  const formula = findSeed(BUILTIN_WAGE_METHOD_IDS.meterWithHeightSurcharge);
  const result = evaluateWageFormula(formula, { length: 12, rate: 150000, heightFactor: 1.2 });
  // 12 * 150000 * 1.2 = 1,800,000 * 1.2 = 2,160,000
  assertEqual(result.error, null, "بدون خطا اجرا شد");
  assertEqual(result.value, 2160000, "مقدار نهایی صحیح: 12×150000×1.2 = 2,160,000");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۵ (اضافه): تعداد ضرب‌در ارتفاع — نصب نرده در ارتفاع");
console.log("=".repeat(70));
{
  const formula = findSeed(BUILTIN_WAGE_METHOD_IDS.countWithHeight);
  const result = evaluateWageFormula(formula, { count: 8, height: 3.5, rate: 40000 });
  // 8 * 3.5 * 40000 = 28 * 40000 = 1,120,000
  assertEqual(result.error, null, "بدون خطا اجرا شد");
  assertEqual(result.value, 1120000, "مقدار نهایی صحیح: 8×3.5×40000 = 1,120,000");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۶ (مسیر خطا): تقسیم بر صفر باید error برگرداند نه throw کند");
console.log("=".repeat(70));
{
  const divFormula: WageFormulaDefinition = {
    id: "test-div",
    name: "تست تقسیم",
    description: "فقط برای تست",
    variables: [
      { key: "a", label: "الف", unit: "", defaultValue: 0 },
      { key: "b", label: "ب", unit: "", defaultValue: 0 },
    ],
    root: wf.div(wf.v("a"), wf.v("b")),
  };
  const result = evaluateWageFormula(divFormula, { a: 100, b: 0 });
  assertEqual(result.value, 0, "مقدار در حالت خطا صفر است");
  assertEqual(result.error !== null, true, "فیلد error پر شده است");
  assertEqual(result.error, "تقسیم بر صفر در فرمول رخ داده است.", "پیام خطا دقیق است");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۷ (اعتبارسنجی): validateWageFormula باید متغیر تعریف‌نشده را بگیرد");
console.log("=".repeat(70));
{
  const brokenFormula: WageFormulaDefinition = {
    id: "test-broken",
    name: "فرمول خراب",
    description: "متغیر y هرگز تعریف نشده",
    variables: [{ key: "x", label: "ایکس", unit: "", defaultValue: 0 }],
    root: wf.mul(wf.v("x"), wf.v("y")),
  };
  const errors = validateWageFormula(brokenFormula);
  assertEqual(errors.length > 0, true, "خطا شناسایی شد");
  assertEqual(errors[0].includes("y"), true, "پیام خطا متغیر مشکل‌دار (y) را نام می‌برد");

  // و یک فرمول سالم نباید هیچ خطایی بدهد
  const validErrors = validateWageFormula(findSeed(BUILTIN_WAGE_METHOD_IDS.meterMinusWaste));
  assertEqual(validErrors, [], "فرمول سالم (meterMinusWaste) هیچ خطای اعتبارسنجی ندارد");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۸ (رفت‌وبرگشت واقعی): هر ۹ فرمول Seed از JSON.stringify/parse عبور می‌کند");
console.log("   (دقیقاً شبیه‌سازی ذخیره در Dexie و خواندن دوباره) — نتیجه محاسبه و");
console.log("   فرمت خوانا باید قبل و بعد از رفت‌وبرگشت کاملاً یکسان بماند.");
console.log("=".repeat(70));
{
  // ورودی نمونه برای هر فرمول Seed بر اساس کلید متغیرهای واقعی‌اش، تا بشود
  // قبل/بعد رفت‌وبرگشت هر ۹ فرمول را (نه فقط ۵ تای بالا) یک‌جا محاسبه و مقایسه کرد.
  const sampleInputs: Record<string, Record<string, number>> = {
    [BUILTIN_WAGE_METHOD_IDS.daily]: { days: 5, dailyRate: 800000 },
    [BUILTIN_WAGE_METHOD_IDS.hourly]: { hours: 7, hourlyRate: 120000 },
    [BUILTIN_WAGE_METHOD_IDS.perMinute]: { minutes: 410, perMinuteRate: 2000 },
    [BUILTIN_WAGE_METHOD_IDS.perMeter]: { length: 15, rate: 100000 },
    [BUILTIN_WAGE_METHOD_IDS.meterMinusWaste]: { length: 20, waste: 2, rate: 135000 },
    [BUILTIN_WAGE_METHOD_IDS.unitMinusBroken]: { count: 30, broken: 5, rate: 50000 },
    [BUILTIN_WAGE_METHOD_IDS.squareMeterWithHeightSurcharge]: { area: 40, rate: 90000, heightFactor: 1.25 },
    [BUILTIN_WAGE_METHOD_IDS.meterWithHeightSurcharge]: { length: 12, rate: 150000, heightFactor: 1.2 },
    [BUILTIN_WAGE_METHOD_IDS.countWithHeight]: { count: 8, height: 3.5, rate: 40000 },
  };

  let roundTripOk = 0;
  for (const seed of BUILTIN_WAGE_METHODS) {
    const before = seed.formula;
    const inputs = sampleInputs[seed.id];
    if (!inputs) {
      console.log(`  ⚠️  رد شد (بدون نمونه ورودی تعریف‌شده): ${seed.id}`);
      continue;
    }

    const beforeResult = evaluateWageFormula(before, inputs);
    const labelsBefore = Object.fromEntries(before.variables.map((v) => [v.key, v.label]));
    const formattedBefore = formatWageFormula(before.root, labelsBefore);

    // --- رفت‌وبرگشت واقعی: دقیقاً شبیه chunk ذخیره/خواندن در Dexie ---
    const serialized = JSON.stringify(before);
    const after = JSON.parse(serialized) as WageFormulaDefinition;

    const afterResult = evaluateWageFormula(after, inputs);
    const labelsAfter = Object.fromEntries(after.variables.map((v) => [v.key, v.label]));
    const formattedAfter = formatWageFormula(after.root, labelsAfter);

    const valueMatches = beforeResult.value === afterResult.value;
    const stepsMatch = JSON.stringify(beforeResult.steps) === JSON.stringify(afterResult.steps);
    const formatMatches = formattedBefore === formattedAfter;
    const structureMatches = JSON.stringify(before) === JSON.stringify(after);

    const allOk = valueMatches && stepsMatch && formatMatches && structureMatches;
    if (allOk) {
      roundTripOk++;
      console.log(`  ✅ ${seed.formula.name} (${seed.id}): مقدار=${afterResult.value}, ساختار و گام‌ها بدون تغییر`);
    } else {
      console.log(`  ❌ ${seed.formula.name} (${seed.id}):`);
      if (!valueMatches) console.log(`     مقدار فرق کرد: قبل=${beforeResult.value} بعد=${afterResult.value}`);
      if (!stepsMatch) console.log(`     گام‌ها فرق کردند`);
      if (!formatMatches) console.log(`     فرمت خوانا فرق کرد: قبل="${formattedBefore}" بعد="${formattedAfter}"`);
      if (!structureMatches) console.log(`     ساختار JSON فرق کرد`);
    }
  }
  assertEqual(roundTripOk, Object.keys(sampleInputs).length, `تمام ${Object.keys(sampleInputs).length} فرمول Seed دارای ورودی نمونه، رفت‌وبرگشت صحیح داشتند`);
}

console.log();
console.log("=".repeat(70));
console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
console.log("=".repeat(70));

if (failed > 0) {
  // به‌جای process.exit(1): این فایل داخل src/ پروژه است و tsconfig.app.json
  // فقط types: ["vite/client"] دارد (بدون node)، چون کل src برای مرورگر/Capacitor
  // کامپایل می‌شود نه Node. throw کردن هم به همان اندازه exit code ناموفق را به
  // اجراکنندهٔ اسکریپت (tsx) منتقل می‌کند، بدون نیاز به @types/node در tsconfig اصلی.
  throw new Error(`${failed} بررسی از مجموع ${passed + failed} ناموفق بود — جزئیات در خروجی بالا.`);
}
