/**
 * محافظ رگرسیون برای مورد ۶ گزارش بررسی پروژه: آیکون‌های ناوبری جهت‌دار
 * (فلش/شورون قبلی-بعدی، ماه قبل/بعد، drill-down) باید همیشه بر اساس
 * theme.direction انتخاب شوند، نه هاردکد — وگرنه در زبان‌های LTR (انگلیسی و
 * غیره) جهت بصری فلش‌ها برعکس می‌شود.
 *
 * این اسکریپت باگ واقعی پیدا‌شده (WorkLogPage، ActivityGanttView،
 * TodayWorkLogCard که ChevronLeft/RightIcon را بدون توجه به جهت هاردکد
 * کرده بودند) را به یک محافظ رگرسیون دائمی تبدیل می‌کند: هر فایلی که
 * ChevronLeftIcon/ChevronRightIcon/ArrowBackIcon/ArrowForwardIcon را
 * مستقیماً در JSX رندر کند (نه از یک متغیر مشتق‌شده از theme.direction)،
 * به‌عنوان مورد مشکوک گزارش می‌شود.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../..");

const DIRECTIONAL_ICONS = ["ChevronLeftIcon", "ChevronRightIcon", "ArrowBackIcon", "ArrowForwardIcon"];

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
  console.log("محافظ رگرسیون: آیکون‌های جهت‌دار باید از theme.direction مشتق شوند");
  console.log("=".repeat(70));

  const offenders: { file: string; icon: string }[] = [];

  for (const file of listSourceFiles(SRC_DIR)) {
    const content = readFileSync(file, "utf-8");
    for (const icon of DIRECTIONAL_ICONS) {
      // اگر این آیکون اصلاً در فایل import نشده، رد شو.
      if (!content.includes(`/${icon.replace("Icon", "")}"`) && !new RegExp(`\\b${icon}\\b`).test(content)) continue;

      // مستقیماً در JSX رندر شده (مثل <ChevronLeftIcon .../>)، بدون این‌که
      // در یک anonymous/derived component variable (مثل const X = ... ? A : B) ذخیره شده باشد؟
      const jsxDirectUse = new RegExp(`<${icon}\\b`, "g");
      const directMatches = [...content.matchAll(jsxDirectUse)];
      if (directMatches.length === 0) continue;

      // آیا همین فایل حاوی یک انتساب مشتق از theme.direction برای این آیکون است؟
      const hasDirectionDerivation = new RegExp(`direction\\s*===\\s*["']rtl["'][\\s\\S]{0,40}\\?[\\s\\S]{0,60}${icon}`).test(
        content
      );
      if (hasDirectionDerivation) continue;

      offenders.push({ file: file.replace(SRC_DIR, "src"), icon });
    }
  }

  if (offenders.length === 0) {
    console.log("  ✅ همه‌جا آیکون‌های جهت‌دار یا مشتق از theme.direction هستند یا اصلاً رندر مستقیم نشده‌اند.");
  } else {
    for (const o of offenders) console.log(`  ❌ ${o.file}: <${o.icon}> مستقیماً رندر شده، بدون اشتقاق از theme.direction`);
  }

  console.log("=".repeat(70));
  if (offenders.length > 0) {
    throw new Error("آیکون جهت‌دار بدون آگاهی از RTL/LTR پیدا شد.");
  }
}

main();
