/**
 * محافظ رگرسیون برای مورد ۵ فهرست کارها: «مرتب‌سازی چیدمان جمع هزینه‌های
 * ثبت‌شده در دفترحساب».
 *
 * ریشهٔ مشکل: در صفحهٔ دفترحساب (`pages/reports/CashbookSection.tsx`)، چند
 * جا مبلغ (خروجی formatCurrency) — و در یک مورد حتی با علامت +/- جدا از آن —
 * داخل یک Typography با جهت پیش‌فرض صفحه (که در حالت فارسی rtl است) رندر
 * می‌شد. وقتی واحد پول/رقم لاتین باشد (یا علامت +/- به‌صورت یک node متنی
 * جدا از عدد باشد)، الگوریتم bidi مرورگر می‌تواند ترتیب نمایش را به‌هم
 * بریزد. راه‌حل استانداردی که در بقیهٔ پروژه هم استفاده شده (مثلاً
 * `CalculationExplanationDialog`, `WageMethodsSection`) همین است: مقداری که
 * شامل عدد/فرمول است را با `dir="ltr"` رندر کن تا همیشه یک بلوک جهت‌دار
 * منسجم باشد.
 *
 * این تست فقط چک می‌کند که هر Typography حاوی فراخوانی مستقیم
 * formatCurrency در همین فایل، یک prop مجاور `dir="ltr"` هم دارد — تا اگر
 * در آینده مبلغ جدیدی بدون این محافظ اضافه شد، بیلد fail شود. تأیید نهایی
 * ظاهر واقعی روی صفحه نیازمند رندر واقعی (که در این محیط ممکن نیست) است.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../..");
const TARGET_FILE = join(SRC_DIR, "pages/reports/CashbookSection.tsx");

function main() {
  console.log("=".repeat(70));
  console.log("محافظ رگرسیون: جهت‌دهی صحیح مبلغ در ردیف‌های جمع دفترحساب");
  console.log("=".repeat(70));

  const content = readFileSync(TARGET_FILE, "utf-8");
  const lines = content.split("\n");

  let checks = 0;
  let failures = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("formatCurrency(")) continue;

    // به عقب برمی‌گردیم تا نزدیک‌ترین شروع تگ <Typography قبل از این خط را پیدا کنیم.
    let openTagStart = -1;
    for (let j = i; j >= 0 && j >= i - 15; j--) {
      if (lines[j].includes("<Typography")) {
        openTagStart = j;
        break;
      }
    }
    if (openTagStart === -1) continue; // این formatCurrency داخل Typography نیست (مثلاً کامنت یا جای دیگر).

    // متن کامل تگ باز <Typography ...> را (که می‌تواند چند خط باشد) جمع می‌کنیم.
    let openTagText = "";
    for (let j = openTagStart; j <= i; j++) {
      openTagText += lines[j] + "\n";
      if (lines[j].includes(">")) break;
    }

    checks++;
    const hasLtrGuard = /dir\s*=\s*["']ltr["']/.test(openTagText);
    const preview = openTagText.replace(/\s+/g, " ").trim().slice(0, 90);
    if (hasLtrGuard) {
      console.log(`  ✅ خط ${i + 1} — دارای dir="ltr": ${preview}...`);
    } else {
      failures++;
      console.log(`  ❌ خط ${i + 1} — بدون dir="ltr": ${preview}...`);
    }
  }

  if (checks === 0) {
    throw new Error("هیچ فراخوانی formatCurrency داخل یک تگ Typography در CashbookSection.tsx پیدا نشد — احتمالاً ساختار فایل عوض شده و این تست باید به‌روزرسانی شود.");
  }

  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${checks - failures} موفق، ${failures} ناموفق از مجموع ${checks} بررسی`);
  console.log("=".repeat(70));

  if (failures > 0) {
    throw new Error("یک یا چند مبلغ در دفترحساب بدون محافظ جهت‌دهی (dir=\"ltr\") رندر می‌شود.");
  }
}

main();
