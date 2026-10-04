/**
 * محافظ رگرسیون برای مورد ۳ فهرست کارها: «حذف بخش الکی حضور و غیاب از محتوای گزارش».
 *
 * ریشهٔ مشکل: در گزارش روزانه (هم نسخهٔ روی صفحه در
 * `pages/reports/DailyReportSection.tsx`، هم نسخهٔ خروجی PDF در
 * `widgets/daily-report/DailyReportWorkersPage.tsx`) یک بلوک کامل «وضعیت
 * حضور» (ساعت ورود، ساعت خروج، کل حضور، بج حاضر/غایب) نمایش داده می‌شد که
 * دقیقاً همان دادهٔ صفحهٔ اختصاصی «حضور و غیاب» (`pages/attendance`) بود —
 * یعنی تکراری و بی‌فایده در این گزارش خاص. این بلوک از هر دو فایل حذف شد؛
 * محاسبات دستمزد/زمان مفید/اتلاف‌وقت که به همان داده‌ها وابسته‌اند دست‌نخورده
 * ماندند (این محافظ کاری با آن‌ها ندارد، فقط با نمایش UI مربوط به این دو فایل).
 *
 * این تست فقط دو فایل مشخص (خروجی گزارش روزانه) را چک می‌کند، نه کل پروژه —
 * چون خودِ صفحهٔ حضور و غیاب و سرویس‌های دستمزد همچنان به‌درستی از این
 * فیلدها (checkIn/checkOut/totalAttendanceMinutes) استفاده می‌کنند و نباید
 * false-positive بدهد.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../..");

const GUARDED_FILES = [
  join(SRC_DIR, "pages/reports/DailyReportSection.tsx"),
  join(SRC_DIR, "widgets/daily-report/DailyReportWorkersPage.tsx"),
];

const FORBIDDEN_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "چیپ/متن «حاضر»", regex: /"حاضر"/ },
  { name: "چیپ/متن «غایب»", regex: /"غایب"/ },
  { name: "ردیف ساعت ورود (checkIn)", regex: /report\.checkIn/ },
  { name: "ردیف ساعت خروج (checkOut)", regex: /report\.checkOut/ },
  { name: "ردیف کل حضور (totalAttendanceMinutes)", regex: /totalAttendanceMinutes/ },
  { name: "برچسب متنی «وضعیت حضور»", regex: /وضعیت حضور/ },
];

function main() {
  console.log("=".repeat(70));
  console.log("محافظ رگرسیون: بخش حضور/غیاب نباید به گزارش روزانه برگردد");
  console.log("=".repeat(70));

  let failures = 0;
  let checks = 0;

  for (const file of GUARDED_FILES) {
    const content = readFileSync(file, "utf-8");
    const relative = file.replace(SRC_DIR, "src");
    for (const pattern of FORBIDDEN_PATTERNS) {
      checks++;
      if (pattern.regex.test(content)) {
        failures++;
        console.log(`  ❌ ${relative}: الگوی ممنوع «${pattern.name}» پیدا شد`);
      } else {
        console.log(`  ✅ ${relative}: بدون «${pattern.name}»`);
      }
    }
  }

  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${checks - failures} موفق، ${failures} ناموفق از مجموع ${checks} بررسی`);
  console.log("=".repeat(70));

  if (failures > 0) {
    throw new Error("محتوای حضور/غیاب دوباره به گزارش روزانه اضافه شده است.");
  }
}

main();
