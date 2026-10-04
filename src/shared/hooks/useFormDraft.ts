import { useCallback, useEffect, useRef } from "react";
import { useAppLifecycle } from "./useAppLifecycle";
import { saveDraft, loadDraft as loadDraftFromStorage, clearDraft as clearDraftFromStorage } from "./formDraftStorage";

interface UseFormDraftOptions<T> {
  /**
   * کلید یکتای این فرم (مثلاً "cashbook-entry" یا "cashbook-entry-edit-{id}").
   * وقتی null باشد، هوک کاملاً غیرفعال است (مثلاً وقتی دیالوگ بسته است).
   */
  draftKey: string | null;
  /** مقدار فعلی فرم که باید در صورت رفتن اپ به پس‌زمینه ذخیره شود. */
  currentValue: T;
  /** آیا مقدار فعلی «قابل‌ذخیره» است؟ (مثلاً فرم کاملاً خالی را ذخیره نکن، فایده‌ای ندارد) */
  isDirty: boolean;
}

/**
 * لایهٔ نازک React روی shared/hooks/formDraftStorage.ts — منطق واقعی
 * ذخیره/خواندن/انقضا در آن ماژول (مستقل از React، مستقیماً قابل تست) است؛
 * این هوک فقط مسئول اتصال آن منطق به چرخهٔ حیات کامپوننت و برنامه است:
 * ذخیرهٔ خودکار وقتی برنامه به پس‌زمینه می‌رود (useAppLifecycle) یا خودِ
 * دیالوگ unmount می‌شود.
 *
 * این پاسخ مستقیم به الزام صریح پرامپت اصلی است: «اطلاعات ذخیره‌نشده
 * نباید صرفاً در حافظهٔ RAM یا State رابط کاربری باقی بمانند».
 */
export function useFormDraft<T>({ draftKey, currentValue, isDirty }: UseFormDraftOptions<T>) {
  // با ref نگه‌داشتن آخرین مقدار، از نیاز به re-subscribe شدن listener در
  // هر تغییر فرم جلوگیری می‌کنیم (که هزینهٔ غیرضروری داشت).
  const currentValueRef = useRef(currentValue);
  const isDirtyRef = useRef(isDirty);
  const draftKeyRef = useRef(draftKey);
  currentValueRef.current = currentValue;
  isDirtyRef.current = isDirty;
  draftKeyRef.current = draftKey;

  const saveDraftNow = useCallback(async () => {
    const key = draftKeyRef.current;
    if (!key || !isDirtyRef.current) return;
    await saveDraft(key, currentValueRef.current);
  }, []);

  useAppLifecycle({ onPause: () => void saveDraftNow() });

  // برای اطمینان بیشتر، هنگام unmount شدن خودِ دیالوگ (مثلاً کاربر دکمهٔ
  // برگشت سیستم را زده) هم پیش‌نویس ذخیره شود — نه فقط رفتن اپ به پس‌زمینه.
  useEffect(() => {
    return () => {
      void saveDraftNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDraft = useCallback(async (): Promise<T | null> => {
    const key = draftKeyRef.current;
    if (!key) return null;
    return loadDraftFromStorage<T>(key);
  }, []);

  const clearDraft = useCallback(async (key?: string | null) => {
    const targetKey = key ?? draftKeyRef.current;
    if (!targetKey) return;
    await clearDraftFromStorage(targetKey);
  }, []);

  return { loadDraft, clearDraft, saveDraftNow };
}
