import { Chip, Stack } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { useTranslation } from "react-i18next";

export type TimeRangeValue = "all" | "today" | "week" | "month" | "lastMonth";

/**
 * فیلتر بازهٔ زمانی مشترک (کل‌زمان‌ها/امروز/۷ روز اخیر/این ماه)، جدا از هر
 * منطق فیلتر دیگری (مثلاً نوع تراکنش) که ممکن است هم‌زمان روی همان صفحه
 * اعمال شود. این کامپوننت طبق گزارش بررسی پروژه (مورد ۷) به‌صورت مستقل و
 * قابل‌استفاده‌مجدد ساخته شده تا:
 *  - برچسب‌ها همیشه از i18n بیایند (نه رشتهٔ فارسی هاردکد)،
 *  - نقش/وضعیت دسترس‌پذیری (role/aria-selected) درست اعلام شود،
 *  - در موبایل به‌صورت اسکرول افقی جمع‌وجور نمایش داده شود، مستقل از جهت RTL/LTR.
 */
export function TimeRangeFilter({
  value,
  onChange,
  weekLabelKey = "week",
}: {
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
  /** برخی صفحات به‌جای «این هفته» دقیقاً «۷ روز اخیر» را محاسبه می‌کنند؛ کلید ترجمهٔ متفاوت را اینجا بده. */
  weekLabelKey?: "week" | "last7Days";
}) {
  const { t } = useTranslation();

  const options: { value: TimeRangeValue; labelKey: string }[] = [
    { value: "all", labelKey: "timeRange.all" },
    { value: "today", labelKey: "timeRange.today" },
    { value: "week", labelKey: `timeRange.${weekLabelKey}` },
    { value: "month", labelKey: "timeRange.month" },
    { value: "lastMonth", labelKey: "timeRange.lastMonth" },
  ];

  return (
    <Stack
      direction="row"
      spacing={1}
      role="tablist"
      aria-label={t("timeRange.ariaLabel")}
      sx={{
        overflowX: "auto",
        overflowY: "hidden",
        pb: 0.5,
        // اسکرول افقی جمع‌وجور در موبایل بدون نوار اسکرول زشت، مستقل از RTL/LTR.
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {options.map((opt) => (
        <Chip
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          size="small"
          icon={<CalendarMonthIcon fontSize="small" />}
          label={t(opt.labelKey)}
          onClick={() => onChange(opt.value)}
          color={value === opt.value ? "secondary" : "default"}
          variant={value === opt.value ? "filled" : "outlined"}
          sx={{ flexShrink: 0 }}
        />
      ))}
    </Stack>
  );
}
