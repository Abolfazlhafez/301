import { useEffect, useRef } from "react";
import { settingsApi } from "../api/settingsApi";
import { futureActivitiesApi } from "../api/futureActivitiesApi";
import { notificationsApi } from "../api/notificationsApi";

/**
 * در هر بار باز شدن اپ، یک‌بار همه‌ی نوتیفیکیشن‌های یادآوری فعالیت‌های آینده
 * را با وضعیت فعلی پایگاه‌داده هماهنگ می‌کند (مثلاً پس از Restore بکاپ یا
 * تغییراتی که در نشست قبلی اعمال شده). اگر یادآوری در تنظیمات غیرفعال باشد،
 * یا روی پلتفرم غیر بومی (مرورگر) اجرا شود، بی‌صدا کاری انجام نمی‌دهد.
 */
export function useActivityNotifications(): void {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      try {
        const settings = await settingsApi.get();
        if (!settings.activityNotificationsEnabled) return;
        const openActivities = await futureActivitiesApi.listAll({ scope: "all", includeCompleted: false });
        await notificationsApi.resyncAll(openActivities);
      } catch {
        // یادآوری نوتیفیکیشن یک قابلیت کمکی است؛ شکست آن نباید بالا آمدن اپ را مختل کند.
      }
    })();
  }, []);
}
