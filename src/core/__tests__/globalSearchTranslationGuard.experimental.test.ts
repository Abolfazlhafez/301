/**
 * محافظ رگرسیون برای بخشی از مورد ۱۰ فهرست کارها: «ترجمهٔ کامل در تمام
 * صفحات». این تست کل برنامه را پوشش نمی‌دهد (مقیاس واقعی آن کار — طبق
 * بررسی انجام‌شده — بیش از ۳۸ فایل دیگر با رشته‌های فارسی هاردکد قابل‌توجه
 * است، از جمله AttendancePage، CashbookSection، WorkerAccountSection،
 * WorkReportBuilderDialog و غیره؛ ترجمهٔ کامل آن‌ها نیازمند یک نشست
 * اختصاصی و طولانی‌تر است). این محافظ فقط دو فایلی را که در همین نشست
 * به‌طور کامل ترجمه‌پذیر شدند (`GlobalSearchDialog.tsx` و
 * `globalSearchFilter.ts`) نگه می‌دارد تا در آینده دوباره متن فارسی
 * هاردکد به آن‌ها اضافه نشود.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../..");

const GUARDED_FILES = [
  join(SRC_DIR, "widgets/search/GlobalSearchDialog.tsx"),
  join(SRC_DIR, "widgets/search/globalSearchFilter.ts"),
];

// حروف فارسی/عربی رایج در بازهٔ یونیکد؛ فقط برای تشخیص رشتهٔ متنی
// هاردکد به‌کار می‌رود، نه برای تست کیفیت ترجمه.
const PERSIAN_STRING_LITERAL = /"[\u0600-\u06FF][^"]*"|'[\u0600-\u06FF][^']*'/g;

function main() {
  console.log("=".repeat(70));
  console.log("محافظ رگرسیون: بدون رشتهٔ فارسی هاردکد در دیالوگ جستجوی سراسری");
  console.log("=".repeat(70));

  let checks = 0;
  let failures = 0;

  for (const file of GUARDED_FILES) {
    let content = readFileSync(file, "utf-8");
    const relative = file.replace(SRC_DIR, "src");

    // بلوک DEFAULT_LABELS در globalSearchFilter.ts آگاهانه و مستند فارسی
    // است (فقط fallback برای فراخوانی‌های قدیمی/تست‌هایی که labels را پاس
    // نمی‌دهند؛ خودِ UI واقعی همیشه labels ترجمه‌شده را پاس می‌دهد) — این
    // تست فقط باید مطمئن شود کد UI/منطق اصلی به فارسیِ هاردکد برنگشته،
    // نه این fallback مستند و عمدی.
    content = content.replace(/const DEFAULT_LABELS[\s\S]*?\n};\n/, "");

    const matches = content.match(PERSIAN_STRING_LITERAL) ?? [];
    checks++;
    if (matches.length === 0) {
      console.log(`  ✅ ${relative}: بدون رشتهٔ فارسی هاردکد`);
    } else {
      failures++;
      console.log(`  ❌ ${relative}: ${matches.length} رشتهٔ فارسی هاردکد پیدا شد: ${matches.slice(0, 5).join(", ")}`);
    }
  }

  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${checks - failures} موفق، ${failures} ناموفق از مجموع ${checks} بررسی`);
  console.log("=".repeat(70));

  if (failures > 0) {
    throw new Error("متن فارسی هاردکد دوباره به دیالوگ جستجوی سراسری برگشته است.");
  }
}

main();
