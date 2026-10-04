/**
 * محافظ رگرسیون برای مورد ۹ گزارش بررسی پروژه: «باگ هنگام انتخاب متن».
 *
 * توضیح صادقانه: خودِ گزارش تصریح می‌کند که منشأ این باگ (CSS/overlay/focus
 * یا صرفاً رفتار مرورگر) بدون اجرای واقعی تعاملی (لمس/ماوس روی دستگاه واقعی)
 * قابل تأیید قطعی نیست. جست‌وجوی کامل کد نشان داد در حال حاضر هیچ‌جای
 * پروژه از userSelect:"none" یا pointerEvents:"none" روی رنگ متن/کارت‌های
 * نتیجهٔ جست‌وجو استفاده نمی‌کند — یعنی نمی‌شود یک «رفع» ساختگی برای باگی
 * نوشت که در کد فعلی رگرسیون‌پذیر نیست.
 *
 * کاری که واقعاً می‌شود و باید کرد: این محافظ رگرسیون را اضافه کردن، تا اگر
 * در آینده هرکسی (یا Claude) به‌اشتباه userSelect:"none" یا
 * pointerEvents:"none" را روی یک عنصر متنی/دیالوگ اضافه کرد — که دقیقاً
 * الگوی رایج ایجاد این دسته باگ‌هاست — بیلد فوراً fail شود، به‌جای این‌که
 * دوباره به‌صورت یک گزارش کاربر مبهم و دیرکشف برگردد.
 *
 * تأیید نهاییِ خودِ باگ (که آیا امروز روی یک مرورگر/دستگاه واقعی وجود دارد
 * یا نه) نیازمند اجرای واقعی اپ است و در این محیط ممکن نیست.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../..");

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) listSourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

const SUSPECT_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'userSelect: "none"', regex: /userSelect\s*:\s*["']none["']/ },
  { name: "user-select: none (raw CSS)", regex: /user-select\s*:\s*none/ },
];

// نکته: pointerEvents:"none" عمداً چک نمی‌شود — این یک تکنیک استاندارد و در
// این پروژه هم کاملاً درست برای لایه‌های تزئینی/گرادیان/غیرقابل‌کلیک (نه متن
// قابل‌انتخاب) استفاده شده (مثلاً افکت درخشش روی نوار امروز در Gantt، یا
// گرادیان روی گالری عکس)؛ چک‌کردن آن فقط هشدار کاذب تولید می‌کرد بدون این‌که
// به الگوی واقعی این باگ (غیرفعال‌شدن انتخاب متن) ربطی داشته باشد.

function main() {
  console.log("=".repeat(70));
  console.log("محافظ رگرسیون: انتخاب متن نباید در هیچ‌جای اپ غیرفعال شود");
  console.log("=".repeat(70));

  const offenders: { file: string; issue: string }[] = [];
  for (const file of listSourceFiles(SRC_DIR)) {
    const content = readFileSync(file, "utf-8");
    for (const pattern of SUSPECT_PATTERNS) {
      if (pattern.regex.test(content)) {
        offenders.push({ file: file.replace(SRC_DIR, "src"), issue: pattern.name });
      }
    }
  }

  if (offenders.length === 0) {
    console.log("  ✅ هیچ الگوی شناخته‌شدهٔ غیرفعال‌کنندهٔ انتخاب متن/رویدادهای اشاره‌گر پیدا نشد.");
    console.log(
      "\nتذکر: این فقط یعنی این کلاس خاص از علت‌های شناخته‌شده در کد فعلی وجود ندارد؛ خودِ" +
        "\nپدیدهٔ گزارش‌شده توسط کاربر باید روی یک دستگاه/مرورگر واقعی هم دوباره بررسی شود."
    );
  } else {
    for (const o of offenders) console.log(`  ❌ ${o.file}: ${o.issue}`);
  }

  console.log("=".repeat(70));
  if (offenders.length > 0) {
    throw new Error("الگوی مشکوک به غیرفعال‌کردن انتخاب متن/pointer-events پیدا شد.");
  }
}

main();
