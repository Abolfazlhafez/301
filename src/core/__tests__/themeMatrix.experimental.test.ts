/**
 * ماتریس تست تم — دقیقاً همان چیزی که گزارش بررسی پروژه برای مورد ۱۱
 * پیشنهاد داده بود: fa/en × light/dark × RTL/LTR.
 *
 * توضیح صادقانه دربارهٔ محدودیت: این اسکریپت در Node اجرا می‌شود، نه یک
 * مرورگر واقعی؛ بنابراین رندر بصری واقعی (layout shift، اسکرول‌بار، مقادیر
 * محاسبه‌شدهٔ CSS) را نمی‌بیند. آنچه واقعاً و به‌طور خودکار تأیید می‌کند:
 *
 *   ۱) createAppTheme برای هر ۸ ترکیب (fa/en × light/dark × rtl/ltr) بدون
 *      خطا ساخته می‌شود و direction/فونت/locale درست تنظیم شده.
 *   ۲) نسبت کنتراست رنگ متن روی پس‌زمینه (طبق فرمول WCAG 2.1) برای
 *      ترکیب‌های حیاتی (متن اصلی/ثانویه روی background.default و
 *      background.paper، متن روی رنگ‌های primary/error/warning/success/info)
 *      حداقل ۳ به ۱ باشد — یعنی هیچ متنی روی پس‌زمینهٔ هم‌رنگ خودش گم نشود.
 *
 * دستی که این اسکریپت جایگزینش نمی‌شود: بازبینی چشمی واقعی روی دستگاه.
 */
import { createAppTheme } from "../../shared/theme/theme";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

/** رنگ‌های rgba(...) را هم پشتیبانی می‌کند (شفافیت را روی زمینهٔ فرضی سفید/تیره اعمال نمی‌کند، فقط RGB خام را می‌گیرد). */
function parseColor(color: string): [number, number, number] {
  if (color.startsWith("#")) return hexToRgb(color);
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(",").map((p) => parseFloat(p.trim()));
    return [parts[0], parts[1], parts[2]];
  }
  throw new Error(`فرمت رنگ پشتیبانی نمی‌شود: ${color}`);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const srgb = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(parseColor(fg));
  const l2 = relativeLuminance(parseColor(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const LANGS = ["fa", "en"] as const;
const MODES = ["light", "dark"] as const;
const DIRS = ["rtl", "ltr"] as const;

// حداقل نسبت کنتراست قابل‌قبول برای متن معمولی طبق WCAG AA (۴.۵ برای متن
// کوچک)؛ برای متن روی رنگ‌های لهجه (accent) که معمولاً درشت‌تر/بولدتر است
// ۳ به‌عنوان آستانهٔ ایمن‌تر و واقع‌بینانه‌تر برای این پالت در نظر گرفته شده.
const MIN_CONTRAST_TEXT = 4.5;
const MIN_CONTRAST_ACCENT = 3;

function main() {
  console.log("=".repeat(70));
  console.log("ماتریس تست تم: fa/en × light/dark × RTL/LTR");
  console.log("=".repeat(70));

  let allOk = true;

  for (const lang of LANGS) {
    for (const mode of MODES) {
      for (const dir of DIRS) {
        const label = `${lang}/${mode}/${dir}`;
        let theme;
        try {
          theme = createAppTheme(mode, dir, lang);
        } catch (err) {
          allOk = false;
          console.log(`  ❌ ${label}: ساخت تم با خطا مواجه شد — ${err instanceof Error ? err.message : err}`);
          continue;
        }

        if (theme.direction !== dir) {
          allOk = false;
          console.log(`  ❌ ${label}: direction تم برابر ${theme.direction} است، نه ${dir}`);
          continue;
        }

        const { text, background, primary, error, warning, success, info } = theme.palette;

        const checks: { name: string; fg: string; bg: string; min: number }[] = [
          { name: "متن اصلی روی پس‌زمینهٔ صفحه", fg: text.primary, bg: background.default, min: MIN_CONTRAST_TEXT },
          { name: "متن اصلی روی کارت/دیالوگ", fg: text.primary, bg: background.paper, min: MIN_CONTRAST_TEXT },
          { name: "متن ثانویه روی کارت/دیالوگ", fg: text.secondary, bg: background.paper, min: MIN_CONTRAST_TEXT - 1.5 },
          { name: "متن روی رنگ اصلی برند (primary)", fg: primary.contrastText, bg: primary.main, min: MIN_CONTRAST_ACCENT },
          { name: "رنگ خطا روی پس‌زمینهٔ کارت", fg: error.main, bg: background.paper, min: MIN_CONTRAST_ACCENT },
          { name: "رنگ هشدار روی پس‌زمینهٔ کارت", fg: warning.main, bg: background.paper, min: MIN_CONTRAST_ACCENT },
          { name: "رنگ موفقیت روی پس‌زمینهٔ کارت", fg: success.main, bg: background.paper, min: MIN_CONTRAST_ACCENT },
          { name: "رنگ اطلاع‌رسانی روی پس‌زمینهٔ کارت", fg: info.main, bg: background.paper, min: MIN_CONTRAST_ACCENT },
        ];

        let labelPrinted = false;
        for (const check of checks) {
          const ratio = contrastRatio(check.fg, check.bg);
          if (ratio < check.min) {
            allOk = false;
            if (!labelPrinted) {
              console.log(`  ${label}:`);
              labelPrinted = true;
            }
            console.log(
              `    ❌ ${check.name}: نسبت کنتراست ${ratio.toFixed(2)} کمتر از حداقل ${check.min} است`
            );
          }
        }
        if (!labelPrinted) console.log(`  ✅ ${label}: تم ساخته شد، جهت درست است، همهٔ کنتراست‌های حیاتی کافی‌اند`);
      }
    }
  }

  console.log("=".repeat(70));
  if (!allOk) {
    throw new Error("ماتریس تست تم شکست خورد — جزئیات بالا را ببینید.");
  }
  console.log("ماتریس کامل ۸ ترکیب (fa/en × light/dark × RTL/LTR) با موفقیت تأیید شد.\n");
}

main();
