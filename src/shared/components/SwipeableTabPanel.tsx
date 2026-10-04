import { ReactNode, TouchEvent, useRef } from "react";
import { Box } from "@mui/material";

interface SwipeableTabPanelProps {
  /** ایندکس تب فعال فعلی. */
  activeIndex: number;
  /** تعداد کل تب‌ها (برای جلوگیری از سوایپ خارج از محدوده). */
  count: number;
  /** با سوایپ معتبر، ایندکس جدید را اعلام می‌کند (دقیقاً مثل کلیک روی خود Tab). */
  onChangeIndex: (index: number) => void;
  /** فقط محتوای تب فعال — بر خلاف پیاده‌سازی‌های رایج سوایپ، بقیهٔ تب‌ها mount نمی‌شوند. */
  children: ReactNode;
}

const SWIPE_THRESHOLD_PX = 60;
const VERTICAL_INTENT_RATIO = 1.2;

/**
 * سوایپ افقی سبک برای جابه‌جایی بین تب‌ها (تجربهٔ مشابه Telegram)، بدون
 * کتابخانهٔ خارجی. عمداً *فقط* محتوای تب فعال را mount نگه می‌دارد — برخلاف
 * پیاده‌سازی‌های معمول سوایپ (که برای پیش‌نمایش لغزشی، همهٔ تب‌ها را هم‌زمان
 * mount می‌کنند)، چون در این اپ برخی تب‌ها (مثل دفتر حساب) عناصر
 * position:fixed دارند (دکمهٔ شناور افزودن) که در صورت mount ماندن در پس‌زمینه
 * روی محتوای تب‌های دیگر می‌افتند. در ازای این تصمیم، انیمیشن یک محو/لغزش
 * سبک هنگام تعویض تب اجرا می‌شود (نه پیش‌نمایش زندهٔ تب همسایه حین کشیدن
 * انگشت)، که هم سریع و سبک است و هم هیچ خطر تداخل با ساختار فعلی ندارد.
 */
export function SwipeableTabPanel({ activeIndex, count, onChangeIndex, children }: SwipeableTabPanelProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.abs(dy) > Math.abs(dx) * VERTICAL_INTENT_RATIO) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;

    // نکتهٔ مهم: stopPropagation فقط وقتی صدا زده می‌شود که این سوایپ واقعاً
    // یک تغییر تب همین‌جا ایجاد کند — نه هر سوایپ افقی معتبری. قبلاً بدون قید
    // صدا زده می‌شد، یعنی وقتی این کامپوننت تودرتو استفاده شده (مثلاً زیرتب‌های
    // «لوازم» داخل صفحهٔ «منابع») و کاربر روی اولین/آخرین زیرتب داخلی سوایپی می‌زد
    // که برای خودِ این کامپوننت بی‌اثر بود (چون از قبل در ابتدا/انتهای بازه‌اش
    // بود)، همان سوایپ بی‌اثر جلوی رسیدنش به کانتینر بیرونی را هم می‌گرفت و کل
    // ژست قورت می‌شد — دقیقاً همان باگی که سوایپ را در حالت تودرتو بی‌اثر می‌کرد.
    // با جابه‌جایی stopPropagation به داخل هر شاخه، وقتی خودِ این تب کاری
    // نمی‌کند، سوایپ آزاد است تا به کانتینر بیرونی برسد و آن یکی جابه‌جا شود.
    // نکتهٔ مهم دربارهٔ جهت سوایپ در RTL: قرارداد رایج پلتفرم (مثلاً ViewPager
    // اندروید در لوکال‌های RTL) این است که سوایپ به «راست» به جلو/تب بعدی
    // می‌رود و سوایپ به «چپ» به عقب/تب قبلی — دقیقاً برعکسِ قرارداد LTR (که در
    // آن سوایپ به چپ یعنی جلو). نسخهٔ قبلی این تابع بدون توجه به RTL بودن اپ،
    // همان قرارداد LTR را پیاده کرده بود (سوایپ چپ = تب بعدی)، که برای
    // کاربر فارسی‌زبان دقیقاً برعکس حس می‌شد. اینجا این دو شرط عمداً برعکسِ
    // نسخهٔ قبلی نوشته شده‌اند.
    if (dx > 0 && activeIndex < count - 1) {
      // سوایپ به راست → تب بعدی
      e.stopPropagation();
      onChangeIndex(activeIndex + 1);
    } else if (dx < 0 && activeIndex > 0) {
      // سوایپ به چپ → تب قبلی
      e.stopPropagation();
      onChangeIndex(activeIndex - 1);
    }
  }

  return (
    <Box onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} sx={{ width: "100%" }}>
      <Box
        key={activeIndex}
        sx={{
          animation: "karegahyar-tab-fade-in 180ms ease-out",
          "@keyframes karegahyar-tab-fade-in": {
            from: { opacity: 0, transform: "translateY(4px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
