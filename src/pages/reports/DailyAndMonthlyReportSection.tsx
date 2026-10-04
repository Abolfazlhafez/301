import { useState } from "react";
import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useTranslation } from "react-i18next";
import { DailyReportSection } from "./DailyReportSection";
import { MonthlyReportSection } from "./MonthlyReportSection";
import { WeeklyWorkerReportSection } from "./WeeklyWorkerReportSection";

type SubView = "daily" | "weekly" | "monthly";

/**
 * ادغام «روزانه»، «هفتگی» و «ماهانه» زیر یک تب واحد در صفحهٔ مدیریت.
 *
 * این بخش‌ها قبلاً تب‌های کاملاً جدا بودند (یا دو تای اول بودند)؛ چون همه
 * دربارهٔ «گزارش حضور» در بازه‌های مختلفند (یک روز، یک هفته، یک بازهٔ دلخواه
 * ماهانه) اما منطق و دادهٔ هرکدام مستقل است، عمداً کد داخلی‌شان با هم قاطی
 * نشده — به‌جایش فقط یک سوییچ سبک بالای صفحه اضافه شده که در هر لحظه فقط
 * یکی از این سه را mount نگه می‌دارد. «هفتگی» (WeeklyWorkerReportSection)
 * خودش هیچ محاسبهٔ جدیدی ندارد — از همان سرویس `reportsApi.monthlyForWorker`
 * که «ماهانه» هم استفاده می‌کند بهره می‌برد، فقط بازه را به دقیقاً یک هفته
 * قفل می‌کند؛ یعنی صحتِ محاسباتش از قبل توسط تست‌های همان سرویس پوشش داده شده.
 */
export function DailyAndMonthlyReportSection() {
  const { t } = useTranslation();
  const [view, setView] = useState<SubView>("daily");

  function handleChange(_: unknown, newValue: SubView | null) {
    if (newValue) setView(newValue);
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={handleChange}
        size="small"
        fullWidth
        sx={{
          "& .MuiToggleButton-root": {
            borderRadius: 999,
            border: "none",
            fontWeight: 600,
            "&.Mui-selected": {
              bgcolor: "primary.main",
              color: "primary.contrastText",
              "&:hover": { bgcolor: "primary.dark" },
            },
          },
        }}
      >
        <ToggleButton value="daily">{t("reports.dailyAndMonthly.dailyToggle")}</ToggleButton>
        <ToggleButton value="weekly">{t("reports.dailyAndMonthly.weeklyToggle")}</ToggleButton>
        <ToggleButton value="monthly">{t("reports.dailyAndMonthly.monthlyToggle")}</ToggleButton>
      </ToggleButtonGroup>

      {view === "daily" && <DailyReportSection />}
      {view === "weekly" && <WeeklyWorkerReportSection />}
      {view === "monthly" && <MonthlyReportSection />}
    </Box>
  );
}
