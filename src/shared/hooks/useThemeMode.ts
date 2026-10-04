import { useCallback, useEffect, useMemo, useState } from "react";
import { PREF_KEYS, getPref, setPref } from "../storage/appPreferences";

/**
 * حالت ذخیره‌شده در تنظیمات کاربر: روشن، تاریک، یا خودکار (پیرو سیستم).
 * "system" یعنی همیشه از تنظیم روشن/تاریک گوشی پیروی می‌کند و با تغییر آن
 * (مثلاً فعال شدن خودکار حالت شب در گوشی هنگام غروب) بی‌درنگ به‌روز می‌شود.
 */
export type ThemeModePreference = "light" | "dark" | "system";
/** حالت واقعی که برای رندر تم به کار می‌رود (همیشه یکی از این دو). */
export type ResolvedThemeMode = "light" | "dark";

const STORAGE_KEY = PREF_KEYS.themeMode;
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function getSystemPrefersDark(): boolean {
  return window.matchMedia?.(DARK_MEDIA_QUERY).matches ?? false;
}

function getInitialPreference(): ThemeModePreference {
  const stored = getPref(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  // برای نصب‌های قبلی این نسخه که هنوز مقدار ذخیره‌شده ندارند، پیش‌فرض را
  // روی «خودکار» می‌گذاریم تا از همان ابتدا با تنظیم گوشی هماهنگ باشد.
  return "system";
}

/**
 * هوک مدیریت حالت تم (روشن/تاریک/خودکار) با ذخیره‌سازی در Preferences بومی (cache شده پیش از رندر اول).
 * وقتی حالت «خودکار» انتخاب شده باشد، تغییرات زنده‌ی prefers-color-scheme
 * سیستم (مثلاً فعال‌سازی خودکار حالت شب گوشی) بلافاصله در اپ اعمال می‌شود.
 */
export function useThemeMode() {
  const [preference, setPreference] = useState<ThemeModePreference>(getInitialPreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(getSystemPrefersDark);

  useEffect(() => {
    setPref(STORAGE_KEY, preference);
  }, [preference]);

  // فقط وقتی لازم است (حالت «خودکار») به تغییرات زنده‌ی سیستم گوش می‌دهیم.
  useEffect(() => {
    if (preference !== "system" || !window.matchMedia) return;
    const mql = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mql.addEventListener("change", handleChange);
    setSystemPrefersDark(mql.matches);
    return () => mql.removeEventListener("change", handleChange);
  }, [preference]);

  const mode: ResolvedThemeMode = useMemo(() => {
    if (preference === "system") return systemPrefersDark ? "dark" : "light";
    return preference;
  }, [preference, systemPrefersDark]);

  /** چرخش بین سه حالت: روشن → تاریک → خودکار → روشن... */
  const cycleMode = useCallback(() => {
    setPreference((prev) => (prev === "light" ? "dark" : prev === "dark" ? "system" : "light"));
  }, []);

  return { mode, preference, setPreference, cycleMode };
}
