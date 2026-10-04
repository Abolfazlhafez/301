/**
 * محافظ رگرسیون برای باگ واقعی پیدا‌شده در نوار ناوبری پایین (AppLayout.tsx):
 * موقعیت pill لغزنده با offsetLeft/offsetWidth خودِ دکمهٔ فعال محاسبه
 * می‌شد (یک مقدار فیزیکی واقعی روی صفحه، که در RTL هم درست است و نیازی
 * به آینه‌شدن ندارد)، اما این مقدار مستقیماً در یک ملک left/right داخل
 * sx قرار می‌گرفت. چون sx از طریق Emotion + stylis-plugin-rtl رندر
 * می‌شود، و آن پلاگین left↔right را برای زبان‌های راست‌چین خودکار آینه
 * می‌کند، مقدار فیزیکیِ از‌قبل‌درست دوباره آینه می‌شد و pill در فارسی/
 * عربی/اردو (در هر دو حالت روشن و تاریک، چون این تبدیل مستقل از mode
 * است) در موقعیت اشتباه می‌نشست.
 *
 * راه‌حل کلی: هر left/right داخل sx که از یک اندازه‌گیری فیزیکی خام DOM
 * (offsetLeft/offsetTop/getBoundingClientRect) مشتق شده، باید به‌جای sx
 * از طریق پراپ style (اینلاین، خارج از مسیر stylis) اعمال شود.
 *
 * این اسکریپت این الگوی خاص را به یک محافظ دائمی تبدیل می‌کند: هر فایلی
 * که از offsetLeft/offsetTop/getBoundingClientRect برای اندازه‌گیری
 * فیزیکی استفاده می‌کند، نباید همان مقدار مشتق‌شده را داخل یک بلوک sx در
 * ملک left یا right قرار دهد.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../..");

const PHYSICAL_MEASUREMENT_PATTERN = /offsetLeft|offsetTop|getBoundingClientRect/;

// خودِ بلوک sx={{ ... }} را تا اولین }} استخراج می‌کند — تا بررسی left/right
// محدود به همان شیء sx بماند و به پراپ‌های بعدی (مثل یک style={{...}}
// مجاور که راه‌حل درست است) سرریز نکند. برای sx های تودرتوی غیرمعمول این
// حد ساده کافی نیست، اما با سبک واقعی این پروژه (بلوک‌های sx نسبتاً کم‌عمق) هم‌خوان است.
const SX_BLOCK_PATTERN = /sx=\{\{([\s\S]{0,400}?)\}\}/g;

// «left: <متغیر/عبارت>» یا «right: <متغیر/عبارت>» — فقط وقتی مقدار با
// حرف/زیرخط شروع شود (یعنی یک شناسه/عبارت جاوااسکریپتی است، نه یک عدد
// ثابت بی‌خطر مثل left: 0).
const PHYSICAL_LEFT_RIGHT_KEY = /\b(left|right):\s*[a-zA-Z_]/;

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) listSourceFiles(full, acc);
    else if (/\.tsx$/.test(entry)) acc.push(full);
  }
  return acc;
}

function main() {
  console.log("=".repeat(70));
  console.log("محافظ رگرسیون: مقدار فیزیکی DOM نباید داخل sx به left/right بخورد");
  console.log("=".repeat(70));

  const offenders: string[] = [];

  for (const file of listSourceFiles(SRC_DIR)) {
    const content = readFileSync(file, "utf-8");
    if (!PHYSICAL_MEASUREMENT_PATTERN.test(content)) continue;

    const sxBlocks = [...content.matchAll(SX_BLOCK_PATTERN)].map((m) => m[1]);
    if (sxBlocks.some((block) => PHYSICAL_LEFT_RIGHT_KEY.test(block))) {
      offenders.push(file.replace(SRC_DIR, "src"));
    }
  }

  if (offenders.length === 0) {
    console.log(
      "  ✅ هیچ فایلی مقدار فیزیکی DOM‌محور را داخل sx به left/right نمی‌دهد (استایل چنین مقادیری باید همیشه اینلاین/style باشد، نه sx)."
    );
  } else {
    for (const f of offenders) {
      console.log(`  ❌ ${f}: مقدار مشتق از offsetLeft/offsetTop/getBoundingClientRect داخل sx به left یا right داده شده`);
    }
  }

  console.log("=".repeat(70));
  if (offenders.length > 0) {
    throw new Error(
      "مقدار فیزیکی DOM داخل sx به left/right داده شده — در RTL توسط stylis-plugin-rtl دوباره آینه می‌شود و موقعیت را خراب می‌کند. از style (اینلاین) استفاده کن."
    );
  }
}

main();
