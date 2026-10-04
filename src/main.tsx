import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { bootstrapAppPreferences, getPref, PREF_KEYS } from "./shared/storage/appPreferences";

async function start() {
  // تنظیمات (تم، زبان، واحد پول) باید پیش از import شدن i18n و App در حافظه باشند
  // تا همان اولین رندر مقدار درست را داشته باشد و پرش ظاهری رخ ندهد. به همین دلیل
  // این دو ماژول عمداً dynamic import می‌شوند (import استاتیک قبل از bootstrap اجرا می‌شد).
  await bootstrapAppPreferences();

  const { getLanguageInfo, normalizeLanguage } = await import("./shared/i18n/languages");
  const startLanguage = normalizeLanguage(getPref(PREF_KEYS.language));
  const info = getLanguageInfo(startLanguage);
  document.documentElement.dir = info.dir;
  document.documentElement.lang = startLanguage;

  await import("./shared/i18n");
  const { default: App } = await import("./App");

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  // نگه‌داری سبک پس از بالا آمدن UI (پاک‌سازی فایل‌های یتیم). ورود به برنامه را کند نمی‌کند.
  void import("./core/storage/startupMaintenance").then((m) => m.scheduleStartupMaintenance());
}

void start();
