import { Box, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { EquipmentInventorySection } from "./EquipmentInventorySection";
import { EquipmentAssignmentSection } from "./EquipmentAssignmentSection";
import { SwipeableTabPanel } from "../../shared/components/SwipeableTabPanel";

interface EquipmentPageProps {
  /** وقتی درون صفحه «منابع» به‌صورت زیرتب نمایش داده می‌شود، عنوان تکراری مخفی می‌گردد. */
  embedded?: boolean;
}

export function EquipmentPage({ embedded = false }: EquipmentPageProps = {}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {!embedded && (
        <Typography variant="h5" fontWeight={700}>
          {t("equipment.pageTitle")}
        </Typography>
      )}

      {/* این صفحه خودش از قبل یک زیرتب داخل تب «تجهیزات» صفحهٔ «منابع» است؛
          یک نوار Tabs تمام‌عرض دیگر درست زیرِ نوار Tabs بیرونی، دو منوی
          کامل را روی هم می‌چید. این‌جا به‌جای آن یک ToggleButtonGroup ساده
          (هم‌الگو با «روزانه/هفتگی/ماهانه» در گزارش‌ها) استفاده شده — از نظر
          کاربر یک سوییچ نمایش است، نه یک منوی ناوبری دوم. */}
      <ToggleButtonGroup
        value={tab}
        exclusive
        onChange={(_, v) => v !== null && setTab(v)}
        fullWidth
        size="small"
      >
        <ToggleButton value={0}>{t("equipment.inventoryTab")}</ToggleButton>
        <ToggleButton value={1}>{t("equipment.assignTab")}</ToggleButton>
      </ToggleButtonGroup>

      <SwipeableTabPanel activeIndex={tab} count={2} onChangeIndex={setTab}>
        {tab === 0 && <EquipmentInventorySection />}
        {tab === 1 && <EquipmentAssignmentSection />}
      </SwipeableTabPanel>
    </Box>
  );
}
