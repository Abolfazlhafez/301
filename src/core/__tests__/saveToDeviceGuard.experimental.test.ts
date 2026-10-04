/**
 * محافظ رگرسیون برای مورد ۶ گروه دوم فهرست کارها: «افزودن دکمهٔ ذخیره در
 * گوشی کنار اشتراک‌گذاری».
 *
 * دو چیز را چک می‌کند:
 *   ۱. `saveBlobToDeviceStorage` باید از `Directory.Documents` (پوشهٔ
 *      عمومیِ قابل‌مشاهده با فایل‌منیجر) بنویسد، نه `Directory.Cache`
 *      (پوشهٔ موقت داخلی اپ که همان مشکل قبلی بود).
 *   ۲. هر سه صفحه‌ای که از `ExportMenuButton` استفاده می‌کنند
 *      (دفترحساب، حساب نیرو، خلاصهٔ حقوق ماهانه) باید واقعاً
 *      `onSaveImageToDevice`/`onSaveExcelToDevice` را پاس بدهند — چون
 *      خودِ `ExportMenuButton` این پراپ‌ها را اختیاری نگه داشته (برای
 *      سازگاری عقب‌رو)، به‌تنهایی معلوم نمی‌کند که همه‌جا واقعاً استفاده
 *      شده‌اند یا فراموش شده‌اند.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../..");

function main() {
  console.log("=".repeat(70));
  console.log("محافظ رگرسیون: دکمهٔ «ذخیره در گوشی» کنار اشتراک‌گذاری");
  console.log("=".repeat(70));

  let checks = 0;
  let failures = 0;

  // چک ۱: saveBlobToDeviceStorage باید Directory.Documents استفاده کند.
  const exportCardContent = readFileSync(join(SRC_DIR, "shared/utils/exportCard.ts"), "utf-8");
  const saveFnMatch = exportCardContent.match(
    /export async function saveBlobToDeviceStorage[\s\S]*?\n}/
  );
  checks++;
  if (saveFnMatch && /directory:\s*Directory\.Documents/.test(saveFnMatch[0])) {
    console.log("  ✅ saveBlobToDeviceStorage از Directory.Documents می‌نویسد (نه Cache)");
  } else {
    failures++;
    console.log("  ❌ saveBlobToDeviceStorage دیگر از Directory.Documents نمی‌نویسد");
  }

  // چک ۲: هر سه صفحهٔ مصرف‌کننده باید هر دو پراپ جدید را پاس بدهند.
  const CONSUMER_FILES = [
    "pages/reports/CashbookSection.tsx",
    "pages/reports/WorkerAccountSection.tsx",
    "pages/reports/MonthlyPayrollSummarySection.tsx",
  ];
  for (const rel of CONSUMER_FILES) {
    const content = readFileSync(join(SRC_DIR, rel), "utf-8");
    checks++;
    const hasBoth = /onSaveImageToDevice=\{/.test(content) && /onSaveExcelToDevice=\{/.test(content);
    if (hasBoth) {
      console.log(`  ✅ ${rel}: هر دو پراپ ذخیره در گوشی پاس داده شده`);
    } else {
      failures++;
      console.log(`  ❌ ${rel}: پراپ‌های ذخیره در گوشی به ExportMenuButton پاس داده نشده`);
    }
  }

  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${checks - failures} موفق، ${failures} ناموفق از مجموع ${checks} بررسی`);
  console.log("=".repeat(70));

  if (failures > 0) {
    throw new Error("قابلیت «ذخیره در گوشی» ناقص یا حذف شده است.");
  }
}

main();
