import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import EventNoteIcon from "@mui/icons-material/EventNote";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import { IconTabBar } from "../../shared/components/IconTabBar";
import { WorkLogPage } from "../work-log/WorkLogPage";
import { FutureActivitiesPage } from "../future-activities/FutureActivitiesPage";
import { SwipeableTabPanel } from "../../shared/components/SwipeableTabPanel";

const TAB_COUNT = 2;

// مقدار پارامتر ?tab= در URL برای دسترسی مستقیم به یک زیرتب خاص (مثلاً از
// کارت‌های داشبورد) — چون این اپ از HashRouter استفاده می‌کند و ممکن است در
// هر لحظه با بستن/بازکردن اپ از نو بارگذاری شود، از URL (نه location.state
// که با رفرش از بین می‌رود) برای این هدف استفاده می‌شود.
const TAB_PARAM_VALUES = ["work-log", "upcoming"] as const;

/**
 * صفحهٔ «فعالیت‌ها»: ادغام دو بخش قبلاً جدا («گزارش کار» روزانه و «کارهای
 * آینده») در یک مقصد واحد با دو زیرتب، دقیقاً با همان الگوی صفحهٔ «منابع»
 * (Tabs + SwipeableTabPanel). قبلاً این دو در نوار پایین و بالای صفحه دو
 * ورودی جدا داشتند که هم باعث شلوغی ناوبری می‌شد و هم دسترسی به «گزارش کار»
 * را (که یک ورودی ثابت و همیشه در دسترس نداشت) نامشخص می‌کرد؛ این ادغام هم
 * ناوبری را ساده‌تر می‌کند و هم یک نقطهٔ ورود واحد و همیشه-قابل‌دسترس برای
 * هر دو نوع فعالیت فراهم می‌کند.
 *
 * هر دو زیرتب دکمهٔ شناور (FAB) خودشان را دارند؛ چون SwipeableTabPanel فقط
 * تب فعال را mount نگه می‌دارد (نه هر دو هم‌زمان)، تداخل FABها با هم پیش
 * نمی‌آید.
 */
export function ActivitiesPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = TAB_PARAM_VALUES.indexOf(tabParam as (typeof TAB_PARAM_VALUES)[number]);
  const [tab, setTab] = useState(initialTab >= 0 ? initialTab : 0);

  // اگر کاربر از داشبورد دوباره به /activities?tab=... لینک بزند در حالی
  // که همین صفحه از قبل (با یک زیرتب دیگر) mount است، React معمولاً همان
  // نمونهٔ کامپوننت را دوباره استفاده می‌کند (چون مسیر و نوع کامپوننت یکسان
  // است)، پس مقداردهی اولیهٔ useState دیگر اجرا نمی‌شود و زیرتب عوض
  // نمی‌شد. این افکت با هر تغییر واقعی مقدار پارامتر tab (نه خودِ آبجکت
  // searchParams که هر بار رفرنس تازه دارد)، زیرتب را دوباره همگام می‌کند.
  useEffect(() => {
    const idx = TAB_PARAM_VALUES.indexOf(tabParam as (typeof TAB_PARAM_VALUES)[number]);
    if (idx >= 0) setTab(idx);
  }, [tabParam]);

  function handleChange(newValue: number) {
    setTab(newValue);
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h5" fontWeight={700}>
        {t("nav.activities")}
      </Typography>

      <IconTabBar
        value={tab}
        onChange={handleChange}
        items={[
          { label: t("activities.tabs.workLog"), icon: <AssignmentTurnedInOutlinedIcon />, activeIcon: <AssignmentTurnedInIcon /> },
          { label: t("activities.tabs.upcoming"), icon: <EventNoteOutlinedIcon />, activeIcon: <EventNoteIcon /> },
        ]}
      />

      <SwipeableTabPanel activeIndex={tab} count={TAB_COUNT} onChangeIndex={setTab}>
        {tab === 0 ? <WorkLogPage embedded /> : <FutureActivitiesPage embedded />}
      </SwipeableTabPanel>
    </Box>
  );
}
