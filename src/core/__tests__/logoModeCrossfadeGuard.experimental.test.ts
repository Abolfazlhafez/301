/**
 * محافظ رگرسیون برای مورد ۳ گروه دوم: «یکسان‌سازی لوگوی روز/شب با یک
 * انیمیشن مشترک».
 *
 * ریشهٔ مشکل: نسخهٔ قبلی `KaregahYarLogoMark.tsx` با
 * `{isDark ? <...دارک/> : <...روشن/>}` دو svg کاملاً جدا (با idهای گرادینت
 * متفاوت وابسته به mode) رندر می‌کرد؛ یعنی با تغییر تم، React کل زیردرخت
 * را unmount/mount می‌کرد — یک پرش رنگی ناگهانی، نه یک ترنزیشن نرم. نسخهٔ
 * جدید هر دو رنگ‌بندی را هم‌زمان با idهای ثابت در DOM نگه می‌دارد و فقط
 * opacity بین آن‌ها را با CSS transition عوض می‌کند (crossfade واقعی).
 *
 * این تست دو چیز را چک می‌کند:
 *   ۱. دیگر هیچ رندر شرطی کامل (رشتهٔ الگوی `isDark ?` که یک عنصر JSX کامل
 *      را انتخاب کند) در فایل نیست.
 *   ۲. حداقل یک قانون `transition` واقعی روی opacity در فایل تعریف شده
 *      است (یعنی crossfade واقعاً پیاده شده، نه صرفاً حذف شرط).
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../..");
const TARGET_FILE = join(SRC_DIR, "shared/components/KaregahYarLogoMark.tsx");

function main() {
  console.log("=".repeat(70));
  console.log("محافظ رگرسیون: لوگو باید یک svg واحد با crossfade باشد، نه دو حالت جدا");
  console.log("=".repeat(70));

  const content = readFileSync(TARGET_FILE, "utf-8");
  let checks = 0;
  let failures = 0;

  // چک ۱: نباید دیگر رندر شرطی کامل به سبک «isDark ? <>...</> : <>...</>»
  // در سطح یک بلوک بزرگ (تعریف گرادینت‌ها) وجود داشته باشد.
  checks++;
  const hasConditionalFragmentBlock = /isDark\s*\?\s*\(\s*<>/.test(content);
  if (hasConditionalFragmentBlock) {
    failures++;
    console.log("  ❌ الگوی رندر شرطی کامل (isDark ? <>...) دوباره پیدا شد — یعنی به mount/unmount کامل برگشته.");
  } else {
    console.log("  ✅ رندر شرطی کامل (دو حالت جدا) در فایل نیست.");
  }

  // چک ۲: باید حداقل یک transition واقعی روی opacity برای crossfade وجود داشته باشد.
  checks++;
  const hasOpacityTransition = /crossfadeTransition|transition:\s*["']opacity/.test(content);
  if (!hasOpacityTransition) {
    failures++;
    console.log("  ❌ هیچ transition روی opacity پیدا نشد — crossfade نرم پیاده نشده است.");
  } else {
    console.log("  ✅ transition روی opacity برای محو-به-محوی نرم بین حالت‌ها وجود دارد.");
  }

  // چک ۳: idهای گرادینت باید ثابت (غیر وابسته به mode) باشند تا هر دو
  // هم‌زمان در DOM قابل دسترسی باشند؛ الگوی قدیمی `${uid}Bg` نباید برگردد.
  checks++;
  const hasDynamicGradientId = /\$\{uid\}/.test(content);
  if (hasDynamicGradientId) {
    failures++;
    console.log("  ❌ شناسهٔ گرادینت دوباره به mode وابسته شده (${uid}...) — crossfade ممکن نیست.");
  } else {
    console.log("  ✅ شناسه‌های گرادینت ثابت‌اند (هر دو رنگ‌بندی هم‌زمان در DOM موجودند).");
  }

  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${checks - failures} موفق، ${failures} ناموفق از مجموع ${checks} بررسی`);
  console.log("=".repeat(70));

  if (failures > 0) {
    throw new Error("لوگو دوباره به الگوی «دو حالت جدا بدون ترنزیشن» برگشته است.");
  }
}

main();
