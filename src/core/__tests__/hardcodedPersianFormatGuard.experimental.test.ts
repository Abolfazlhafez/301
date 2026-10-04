/**
 * محافظ رگرسیون برای مورد ۸ فهرست کارها: «رشته‌های ناقص/فرمت پول در ترجمه».
 *
 * ریشهٔ مشکل: چهار فایل UI (لیست تجهیزات، تخصیص تجهیزات، تقویم گزارش کار،
 * تقویم شمسی ماهانه) به‌جای تابع چندزبانهٔ `formatNumber` (که بر اساس زبان
 * فعلی برنامه، اعداد را با locale درست فرمت می‌کند)، از `formatNumberFa` /
 * `formatCurrencyFa` استفاده می‌کردند — که همیشه، مستقل از زبان انتخابی
 * کاربر، عدد را با ارقام فارسی و/یا واحد «تومان» نمایش می‌دهند. یعنی حتی
 * وقتی کاربر زبان را به انگلیسی/عربی/... عوض می‌کرد، این چند جای خاص باز
 * هم فارسی می‌ماندند.
 *
 * این محافظ کل src را اسکن می‌کند تا اگر در آینده جای دیگری (به‌جز خودِ
 * ماژول format.ts که این توابع را تعریف می‌کند، و کدهایی که آگاهانه به
 * فرمت فارسیِ‌ثابت نیاز دارند) دوباره از این دو تابع در یک کامپوننت UI
 * استفاده شود، بیلد fail شود.
 *
 * فایل‌هایی که مجازند از formatNumberFa/formatCurrencyFa استفاده کنند (چون
 * خودشان تعریف این توابع هستند یا آگاهانه فرمت فارسی می‌خواهند) در
 * ALLOWLIST مشخص شده‌اند.
 */
import { readFileSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../..");

// فقط مواردی مجازند که آگاهانه و مستند همیشه باید فارسی بمانند، نه
// کامپوننت‌های UI معمولی که باید با زبان انتخابی کاربر هماهنگ باشند.
const ALLOWLIST = new Set([
  "shared/utils/format.ts", // خودِ فایل تعریف‌کننده
  // متن آماده برای اشتراک‌گذاری سریع در واتس‌اپ/تلگرام؛ کل خروجی این تابع
  // (نه فقط مبلغ) عمداً و همیشه فارسی است، مستقل از زبان UI برنامه —
  // مستندش در همان فایل هست.
  "shared/utils/dailySummaryText.ts",
]);

function main() {
  console.log("=".repeat(70));
  console.log("محافظ رگرسیون: عدم استفاده از فرمت هاردکد فارسی در کامپوننت‌های UI");
  console.log("=".repeat(70));

  const grepOutput = execSync(
    `grep -rl "formatNumberFa\\|formatCurrencyFa" --include=*.tsx --include=*.ts "${SRC_DIR}" || true`,
    { encoding: "utf-8" }
  );
  const files = grepOutput
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !f.includes("__tests__"));

  let checks = 0;
  let failures = 0;

  for (const file of files) {
    const rel = relative(SRC_DIR, file);
    checks++;
    if (ALLOWLIST.has(rel)) {
      console.log(`  ✅ مجاز (تعریف تابع): ${rel}`);
      continue;
    }
    const content = readFileSync(file, "utf-8");
    const usesIt = /formatNumberFa|formatCurrencyFa/.test(content);
    if (usesIt) {
      failures++;
      console.log(`  ❌ استفادهٔ غیرمجاز از فرمت هاردکد فارسی: ${rel}`);
    }
  }

  if (checks === 0) {
    throw new Error("grep نتیجه‌ای برنگرداند — احتمالاً مسیر جستجو اشتباه است.");
  }

  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${checks - failures} موفق، ${failures} ناموفق از مجموع ${checks} بررسی`);
  console.log("=".repeat(70));

  if (failures > 0) {
    throw new Error("یک یا چند کامپوننت UI هنوز از فرمت هاردکد فارسی (مستقل از زبان) استفاده می‌کند.");
  }
}

main();
