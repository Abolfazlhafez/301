import { CacheProvider } from "@emotion/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { getEmotionCacheForDir } from "./shared/theme/rtlCache";
import { createAppTheme } from "./shared/theme/theme";
import { useThemeMode } from "./shared/hooks/useThemeMode";
import { useLanguage } from "./shared/hooks/useLanguage";
import { useAutoBackup } from "./shared/hooks/useAutoBackup";
import { useCloudBackup } from "./shared/hooks/useCloudBackup";
import { useActivityNotifications } from "./shared/hooks/useActivityNotifications";
import { ToastProvider } from "./shared/components/ToastProvider";
import { AppLayout } from "./widgets/layout/AppLayout";
import { PageLoadingFallback } from "./shared/components/PageLoadingFallback";
import { AppEntrySplash } from "./shared/components/AppEntrySplash";
import { DatabaseGate } from "./shared/components/DatabaseGate";

// صفحات به‌جای import مستقیم به‌صورت lazy بارگذاری می‌شوند تا حجم باندل اصلی
// (که قبلاً نزدیک ۲ مگابایت بود و همیشه در همان اولین بار باز شدن اپ کامل
// دانلود/پردازش می‌شد) بین چند فایل جدا تقسیم شود. با این تغییر، هر صفحه
// فقط وقتی کاربر واقعاً به آن سر می‌زند بارگذاری می‌شود — یعنی باز شدن اولیهٔ
// اپ (که برای کاربری که هر روز صبح آن را باز می‌کند مهم‌ترین لحظه است)
// چیزهایی که فعلاً لازم نیستند (مثلاً کد صفحهٔ تنظیمات) را دانلود نمی‌کند.
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ResourcesPage = lazy(() => import("./pages/resources/ResourcesPage").then((m) => ({ default: m.ResourcesPage })));
const ActivitiesPage = lazy(() => import("./pages/activities/ActivitiesPage").then((m) => ({ default: m.ActivitiesPage })));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const WageSettingsPage = lazy(() =>
  import("./pages/wage-settings/WageSettingsPage").then((m) => ({ default: m.WageSettingsPage }))
);
const ProjectPage = lazy(() => import("./pages/project/ProjectPage").then((m) => ({ default: m.ProjectPage })));
const FloorNotebookPage = lazy(() =>
  import("./pages/project/FloorNotebookPage").then((m) => ({ default: m.FloorNotebookPage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      // کوئری‌های غیرفعال زودتر از RAM آزاد شوند (پیش‌فرض ۵ دقیقه برای گوشی‌های میان‌رده زیاد است).
      gcTime: 120_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** کارهای پس‌زمینه که به دیتابیس نیاز دارند؛ فقط بعد از باز شدن موفق دیتابیس mount می‌شود. */
function BackgroundTasks() {
  useAutoBackup();
  useCloudBackup();
  useActivityNotifications();
  return null;
}

export default function App() {
  const { mode } = useThemeMode();
  // useLanguage در همان اولین رندر هم document.documentElement.dir/lang را
  // تنظیم می‌کند و i18next را روی زبان ذخیره‌شده نگه می‌دارد؛ اینجا فقط
  // خروجی‌اش (جهت صفحه) برای انتخاب cache/تم مناسب لازم است.
  const { dir, language } = useLanguage();
  const theme = createAppTheme(mode, dir, language);

  return (
    <CacheProvider value={getEmotionCacheForDir(dir)}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
           <DatabaseGate>
            <BackgroundTasks />
            {/* لایهٔ اسپلش روی محتوای واقعی اپ (که همزمان زیرش mount و آماده
                می‌شود) قرار می‌گیرد؛ فقط در همان اولین باز شدن اپ در هر
                نشست دیده می‌شود، نه در جابه‌جایی بین صفحات. */}
            <AppEntrySplash mode={mode} />
            <HashRouter>
              <AppLayout>
                <Suspense fallback={<PageLoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/resources" element={<ResourcesPage />} />
                    <Route path="/activities" element={<ActivitiesPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/wage-settings" element={<WageSettingsPage />} />
                    <Route path="/project" element={<ProjectPage />} />
                    <Route path="/project/floors/:floorId" element={<FloorNotebookPage />} />
                    {/* مسیرهای قدیمی — برای سازگاری با میان‌برهای احتمالی ذخیره‌شدهٔ کاربر
                        (مثلاً میان‌بر PWA روی صفحهٔ اصلی گوشی) به مقصد ادغام‌شدهٔ جدید
                        هدایت می‌شوند، نه این‌که مستقیماً حذف شوند. */}
                    <Route path="/work-log" element={<Navigate to="/activities" replace />} />
                    <Route path="/future-activities" element={<Navigate to="/activities" replace />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            </HashRouter>
           </DatabaseGate>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}
