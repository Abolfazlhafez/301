import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { IconTabBar } from "../../shared/components/IconTabBar";
import { DailyAndMonthlyReportSection } from "./DailyAndMonthlyReportSection";
import { CashbookSection } from "./CashbookSection";
import { SwipeableTabPanel } from "../../shared/components/SwipeableTabPanel";
import { resolveMovedTabRedirect, resolveTabIndex } from "./reportsPageTabs";

const TAB_COUNT = 2;

/**
 * صفحهٔ «گزارش‌ها»: گزارش روزانه/هفتگی/ماهانه + دفتر حساب.
 * «حقوق نیروها» و «حضور و غیاب» به «تیم و تجهیزات ← نیروها» رفته‌اند.
 */
export function ReportsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = resolveTabIndex(tabParam);
  const [tab, setTab] = useState(initialTab >= 0 ? initialTab : 0);

  useEffect(() => {
    const idx = resolveTabIndex(tabParam);
    if (idx >= 0) setTab(idx);
  }, [tabParam]);

  // لینک‌های قدیمی/بوکمارک‌شده به بخش‌هایی که به صفحهٔ دیگری رفته‌اند (مثل
  // «?tab=payroll-account») باید به مقصد جدیدشان بروند. این بررسی عمداً بعد از
  // همهٔ Hookها آمده تا ترتیب Hookها ثابت بماند.
  const movedTo = resolveMovedTabRedirect(tabParam);
  if (movedTo) {
    return <Navigate to={movedTo} replace />;
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h5" fontWeight={700}>
        {t("nav.reports")}
      </Typography>

      <IconTabBar
        value={tab}
        onChange={setTab}
        items={[
          { label: t("reports.tabs.dailyMonthly"), icon: <CalendarMonthOutlinedIcon />, activeIcon: <CalendarMonthIcon /> },
          { label: t("reports.tabs.cashbook"), icon: <ReceiptLongOutlinedIcon />, activeIcon: <ReceiptLongIcon /> },
        ]}
      />

      <SwipeableTabPanel activeIndex={tab} count={TAB_COUNT} onChangeIndex={setTab}>
        {tab === 0 && <DailyAndMonthlyReportSection />}
        {tab === 1 && <CashbookSection />}
      </SwipeableTabPanel>
    </Box>
  );
}
