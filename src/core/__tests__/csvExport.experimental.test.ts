/**
 * تست تجربی واقعی منطق escape کردن CSV (csvCell) و ساخت محتوای کامل فایل
 * (buildCsvContent) — این دقیقاً همان بخشی از shared/utils/exportCsv.ts
 * است که واقعاً منطق دارد (نه صرفاً فراخوانی Filesystem/Share)، و اشتباه
 * در آن می‌تواند باعث خراب‌شدن فایل CSV در اکسل شود (مثلاً وقتی یک نام
 * تجهیزات یا توضیح تراکنش حاوی ویرگول یا کوتیشن باشد).
 */

import { csvCell, buildCsvContent } from "../../shared/utils/exportCsv";

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

console.log("=".repeat(70));
console.log("تست ۱: مقادیر ساده (بدون کاراکتر خاص) دست‌نخورده می‌مانند");
console.log("=".repeat(70));
assertEqual(csvCell("بیل"), "بیل", "یک رشتهٔ فارسی ساده بدون تغییر برمی‌گردد");
assertEqual(csvCell(1500000), "1500000", "یک عدد به رشتهٔ ساده تبدیل می‌شود");
assertEqual(csvCell("عدد صفر"), "عدد صفر", "رشتهٔ حاوی فاصله (بدون ویرگول/کوتیشن) دست‌نخورده می‌ماند");

console.log();
console.log("=".repeat(70));
console.log("تست ۲: مقادیر حاوی ویرگول لاتین (,) باید داخل کوتیشن قرار بگیرند");
console.log("   (وگرنه اکسل این را به‌اشتباه دو ستون جدا تفسیر می‌کند)");
console.log("=".repeat(70));
assertEqual(csvCell("خرید سیمان, ماسه"), '"خرید سیمان, ماسه"', "ویرگول لاتین (,) trigger کوتیشن می‌شود");
assertEqual(
  csvCell("میکسر بتن، دستی"),
  "میکسر بتن، دستی",
  "ویرگول فارسی (،) از نظر یونیکد کاراکتر کاملاً متفاوتی است و فرمت CSV با آن جدا نمی‌شود — پس به‌درستی trigger کوتیشن نمی‌کند"
);

console.log();
console.log("=".repeat(70));
console.log("تست ۳: مقادیر حاوی کوتیشن دوتایی باید escape (هر \" به \"\") و کل مقدار کوتیشن شود");
console.log("=".repeat(70));
assertEqual(
  csvCell('لوازم "ویژه" کارگاه'),
  '"لوازم ""ویژه"" کارگاه"',
  "کوتیشن داخلی با دو کوتیشن escape و کل مقدار کوتیشن می‌شود"
);
assertEqual(
  csvCell('فرغون "سنگین"'),
  '"فرغون ""سنگین"""',
  "کوتیشنی که در انتهای رشته باشد هم درست escape می‌شود؛ کوتیشن بیرونی نهایی با کوتیشن‌های escape‌شدهٔ داخلی قاطی نمی‌شود"
);

console.log();
console.log("=".repeat(70));
console.log("تست ۴: مقادیر چندخطی (newline) باید کوتیشن شوند");
console.log("   (وگرنه ساختار ردیف‌های CSV به‌هم می‌ریزد)");
console.log("=".repeat(70));
assertEqual(csvCell("خط اول\nخط دوم"), '"خط اول\nخط دوم"', "newline باعث کوتیشن‌شدن کل مقدار می‌شود");

console.log();
console.log("=".repeat(70));
console.log("تست ۵: buildCsvContent — یک جدول واقعی لوازم کارگاه با مقادیر خطرناک");
console.log("=".repeat(70));
{
  const headers = ["نام لوازم", "توضیحات", "واحد", "موجودی کل"];
  const rows: (string | number)[][] = [
    ["بیل و کلنگ", "برای خاک‌برداری، حمل با احتیاط", "عدد", 12],
    ['فرغون "سنگین"', "شامل چرخ یدک", "دستگاه", 3],
    ["میکسر بتن, دستی", "", "دستگاه", 1],
  ];
  const content = buildCsvContent(headers, rows);

  assertEqual(content.startsWith("\uFEFF"), true, "محتوای تولیدشده با BOM شروع می‌شود (برای سازگاری با اکسل ویندوز)");

  const lines = content.slice(1).split("\r\n");
  assertEqual(lines.length, 4, "دقیقاً ۴ خط تولید شد: ۱ هدر + ۳ ردیف داده");
  assertEqual(lines[0], "نام لوازم,توضیحات,واحد,موجودی کل", "خط هدر دقیقاً درست ساخته شد");
  assertEqual(
    lines[1],
    "بیل و کلنگ,برای خاک‌برداری، حمل با احتیاط,عدد,12",
    "توضیح حاوی فقط ویرگول فارسی، بدون کوتیشن باقی ماند (چون فرمت CSV با آن جدا نمی‌شود)"
  );
  assertEqual(
    lines[2],
    '"فرغون ""سنگین""",شامل چرخ یدک,دستگاه,3',
    "ردیف حاوی کوتیشن داخلی، دقیقاً و کامل به‌درستی escape شد"
  );
  assertEqual(
    lines[3],
    '"میکسر بتن, دستی",,دستگاه,1',
    "ردیف حاوی ویرگول لاتین در ستون اول کوتیشن شد؛ ستون توضیحات خالی هم به‌درستی رشتهٔ خالی ماند (نه 'undefined')"
  );
}

console.log();
console.log("=".repeat(70));
console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
console.log("=".repeat(70));

if (failed > 0) {
  throw new Error(`${failed} بررسی ناموفق بود.`);
}
