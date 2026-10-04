import { useEffect, useState } from "react";

/**
 * وقتی کاربر بیش از حد آستانه (پیش‌فرض ۳۲۰ پیکسل) در ناحیه اسکرول اصلی
 * برنامه (همان <main> در AppLayout) پایین رفته باشد true برمی‌گرداند.
 * برای نمایش دکمه شناور «بازگشت به بالا» در صفحاتی با لیست‌های بلند
 * (مثل نیروها یا گزارش‌ها) استفاده می‌شود.
 */
export function useScrollToTop(thresholdPx = 320) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // ناحیه‌ای که واقعاً اسکرول می‌شود <main> در AppLayout است، نه window
    // (چون کل صفحه با height: 100dvh/overflow:hidden ثابت نگه داشته شده است).
    const scrollEl = document.querySelector("main");
    if (!scrollEl) return;

    function handleScroll() {
      setVisible((scrollEl as HTMLElement).scrollTop > thresholdPx);
    }

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [thresholdPx]);

  function scrollToTop() {
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return { visible, scrollToTop };
}
