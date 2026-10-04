import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export type AppLifecycleState = "active" | "background";

interface UseAppLifecycleOptions {
  /** وقتی برنامه از پس‌زمینه به پیش‌زمینه برمی‌گردد (کاربر دوباره اپ را باز می‌بیند). */
  onResume?: () => void;
  /** وقتی برنامه به پس‌زمینه می‌رود (کاربر دکمهٔ Home را زده یا به اپ دیگری سوییچ کرده). */
  onPause?: () => void;
}

/**
 * لایهٔ مرکزی و یکپارچهٔ مدیریت Lifecycle برنامه — پلی بین Android واقعی و
 * مرورگر معمولی.
 *
 * روی اندروید (Capacitor.isNativePlatform()) از پلاگین بومی @capacitor/app
 * استفاده می‌شود که رویدادهای واقعی سیستم‌عامل (appStateChange) را دریافت
 * می‌کند — این دقیقاً شامل تمام حالت‌هایی است که پرامپت اصلی خواسته بود:
 * رفتن به Background، برگشتن به Foreground، و توقف/ادامهٔ برنامه.
 *
 * روی وب (برای توسعه/پیش‌نمایش)، از رویداد استاندارد visibilitychange
 * مرورگر استفاده می‌شود که رفتار مشابهی (تعویض تب/ویندوز) می‌دهد.
 *
 * این هوک صرفاً *گزارش* رویدادها را می‌دهد؛ منطق واقعی «چه کاری باید در
 * پاسخ به آن انجام شود» (مثل ذخیرهٔ پیش‌نویس فرم یا اجرای بکاپ خودکار)
 * در خودِ کامپوننت/هوک مصرف‌کننده تعریف می‌شود — این جداسازی باعث می‌شود
 * منطق Lifecycle در یک‌جا متمرکز بماند اما سیاست واکنش در هر بخش برنامه
 * مستقل و قابل تنظیم باشد.
 */
export function useAppLifecycle({ onResume, onPause }: UseAppLifecycleOptions): void {
  // با ref نگه‌داشتن callbackها، از re-subscribe شدن listener در هر رندر
  // (وقتی onResume/onPause یک تابع inline تازه در هر رندر باشند) جلوگیری
  // می‌کنیم — چون subscribe/unsubscribe واقعی پلاگین بومی هزینهٔ غیرصفر دارد.
  const onResumeRef = useRef(onResume);
  const onPauseRef = useRef(onPause);
  onResumeRef.current = onResume;
  onPauseRef.current = onPause;

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const listenerPromise = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) onResumeRef.current?.();
        else onPauseRef.current?.();
      });
      return () => {
        listenerPromise.then((listener) => listener.remove());
      };
    }

    // fallback وب: visibilitychange رفتار مشابهی (مخفی/نمایان شدن صفحه) می‌دهد.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") onResumeRef.current?.();
      else onPauseRef.current?.();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
}
