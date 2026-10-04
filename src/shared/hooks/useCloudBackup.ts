import { useEffect, useRef } from "react";
import { cloudBackupService } from "../../core/services/cloudBackupService";
import { useAppLifecycle } from "./useAppLifecycle";

/**
 * درست مثل useAutoBackup (بکاپ محلی)، اما برای بکاپ ابری اختیاری روی
 * Supabase شخصی کاربر. در هر بار باز شدن اپ و هر بار برگشت از پس‌زمینه،
 * بررسی می‌کند آیا زمان بکاپ ابری بعدی فرا رسیده یا نه — اگر بکاپ ابری
 * خاموش باشد یا تنظیمات ناقص باشد، cloudBackupService.runCloudBackupIfDue
 * خودش بی‌صدا و فوراً برمی‌گردد (نگاه کن به کامنت آن تابع).
 *
 * این هوک کاملاً مستقل از useAutoBackup است — هر دو می‌توانند هم‌زمان و
 * بدون تداخل با هم فعال باشند (یکی بکاپ محلی می‌گیرد، دیگری همان محتوای
 * رمزنگاری‌شده را در Supabase هم آینه می‌کند).
 */
export function useCloudBackup(): void {
  const hasRun = useRef(false);

  function checkAndRunIfDue() {
    cloudBackupService.runCloudBackupIfDue().catch(() => {
      // این متد خودش هرگز نباید throw کند (نگاه کن به پیاده‌سازی)، ولی
      // برای اطمینان کامل این catch هم این‌جا نگه داشته می‌شود.
    });
  }

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    checkAndRunIfDue();
  }, []);

  useAppLifecycle({ onResume: checkAndRunIfDue });
}
