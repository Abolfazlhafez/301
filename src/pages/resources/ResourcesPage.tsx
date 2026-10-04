import { Box, Typography } from "@mui/material";
import { useEffect, useRef, useState, TouchEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import GroupsIcon from "@mui/icons-material/Groups";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import ConstructionIcon from "@mui/icons-material/Construction";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import { IconTabBar } from "../../shared/components/IconTabBar";
import { TeamHub } from "../workers/TeamHub";
import { EquipmentPage } from "../equipment/EquipmentPage";
import { resolveResourcesRedirect, resolveResourcesTabIndex } from "./resourcesPageTabs";

const TAB_COUNT = 2;
const SWIPE_THRESHOLD_PX = 60;
const VERTICAL_INTENT_RATIO = 1.2;

/**
 * صفحه «تیم و تجهیزات»: دو زیرتب — «نیروها» (فهرست نیروها + حضور و غیاب +
 * حقوق، یکپارچه در TeamHub) و «تجهیزات».
 *
 * - «دفتر حساب» به صفحهٔ «گزارش‌ها» منتقل شد؛ لینک قدیمی ?tab=cashbook همین‌جا
 *   به آن‌جا ریدایرکت می‌شود.
 * - «حضور و غیاب» و «حقوق نیروها» حالا نمای داخلی «نیروها» هستند (?view=…)؛
 *   مقادیر قدیمی ?tab=attendance روی همان نما می‌نشینند.
 */
export function ResourcesPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = resolveResourcesTabIndex(tabParam);
  const [tab, setTab] = useState(initialTab >= 0 ? initialTab : 0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const idx = resolveResourcesTabIndex(tabParam);
    if (idx >= 0) setTab(idx);
  }, [tabParam]);

  // سوایپ افقی بین دو زیرتب. فقط وقتی واقعاً تب عوض می‌شود stopPropagation
  // زده می‌شود تا ژست بی‌اثر به کانتینر بیرونی (نوار ناوبری پایین) برسد.
  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (!touchStart.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.abs(dy) > Math.abs(dx) * VERTICAL_INTENT_RATIO) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;

    if (dx < 0 && tab < TAB_COUNT - 1) {
      e.stopPropagation();
      setTab(tab + 1);
    } else if (dx > 0 && tab > 0) {
      e.stopPropagation();
      setTab(tab - 1);
    }
  }

  // بعد از همهٔ Hookها تا ترتیب Hookها ثابت بماند.
  const movedTo = resolveResourcesRedirect(tabParam);
  if (movedTo) {
    return <Navigate to={movedTo} replace />;
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h5" fontWeight={700}>
        {t("resources.title")}
      </Typography>

      <IconTabBar
        value={tab}
        onChange={setTab}
        items={[
          { label: t("resources.tabs.workers"), icon: <GroupsOutlinedIcon />, activeIcon: <GroupsIcon /> },
          { label: t("resources.tabs.equipment"), icon: <ConstructionOutlinedIcon />, activeIcon: <ConstructionIcon /> },
        ]}
      />

      {/* سوایپ افقی داخل نمای «حضور»/«حقوق» (تقویم، انتخابگر تاریخ) با سوایپ
          زیرتب‌ها تداخل ندارد چون فقط وقتی تب عوض می‌شود رویداد مصرف می‌شود. */}
      <Box onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <Box sx={{ display: tab === 0 ? "block" : "none" }}>
          <TeamHub />
        </Box>
        <Box sx={{ display: tab === 1 ? "block" : "none" }}>
          <EquipmentPage embedded />
        </Box>
      </Box>
    </Box>
  );
}
