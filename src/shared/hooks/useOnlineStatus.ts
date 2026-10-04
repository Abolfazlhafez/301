import { useEffect, useState } from "react";

/**
 * وضعیت اتصال اینترنت گوشی/مرورگر (navigator.onLine) را برمی‌گرداند و با
 * رویدادهای online/offline زنده به‌روز می‌شود.
 *
 * توجه: این برنامه کاملاً آفلاین است و هیچ عملکردی به اینترنت نیاز ندارد؛
 * این هوک صرفاً برای نمایش یک نشان اطمینان‌بخش به کاربر است («نیازی به
 * اینترنت نیست»), نه برای فعال/غیرفعال‌کردن هیچ قابلیتی در برنامه.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
