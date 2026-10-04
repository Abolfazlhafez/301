import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import CalculateIcon from "@mui/icons-material/Calculate";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import { IconTabBar } from "../../shared/components/IconTabBar";
import { JobTypesSection } from "./JobTypesSection";
import { WageMethodsSection } from "./WageMethodsSection";
import { SwipeableTabPanel } from "../../shared/components/SwipeableTabPanel";

const TAB_COUNT = 2;

/**
 * صفحهٔ «شغل‌ها و روش‌های محاسبهٔ دستمزد» — مدیریت کامل ۵۰ شغل پیش‌فرض (و
 * هر شغل سفارشی که کاربر اضافه کند) و روش‌های محاسبهٔ دستمزد (فرمول‌ها).
 * این دو مفهوم عمداً در دو زیرتب جدا مدیریت می‌شوند، چون یک روش محاسبه
 * می‌تواند بین چند شغل مشترک باشد (مثلاً «مترمربعی» هم برای گچ‌کار هم برای
 * کاشی‌کار) — یعنی رابطهٔ many-to-many، نه یک فرزند مستقیم زیر هر شغل.
 */
export function WageSettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  function handleChange(newValue: number) {
    setTab(newValue);
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h5" fontWeight={700}>
        {t("wageSettings.pageTitle")}
      </Typography>

      <IconTabBar
        value={tab}
        onChange={handleChange}
        items={[
          { label: t("wageSettings.jobsTab"), icon: <WorkOutlineOutlinedIcon />, activeIcon: <WorkOutlineIcon /> },
          { label: t("wageSettings.methodsTab"), icon: <CalculateOutlinedIcon />, activeIcon: <CalculateIcon /> },
        ]}
      />

      <SwipeableTabPanel activeIndex={tab} count={TAB_COUNT} onChangeIndex={setTab}>
        {tab === 0 ? <JobTypesSection /> : <WageMethodsSection />}
      </SwipeableTabPanel>
    </Box>
  );
}
