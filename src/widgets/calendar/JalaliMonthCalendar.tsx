import { Box, Paper, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import { DailyWorkerReport } from "../../entities/Report";
import { formatCurrency, formatNumber } from "../../shared/utils/format";

interface JalaliMonthCalendarProps {
  year: number;
  month: number; // 0-indexed (فروردین=0)
  daysInMonth: number;
  startWeekdayIndex: number; // 0=شنبه ... 6=جمعه، روزی که تاریخ ۱ ماه در آن قرار می‌گیرد
  dailyReports: Map<string, DailyWorkerReport>; // کلید: تاریخ ISO میلادی همان روز
  dateForDay: (day: number) => string; // تبدیل روز شمسی به تاریخ ISO میلادی
}

const WEEKDAY_LABELS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/**
 * گرید تقویم ماهانه شمسی. هر خانه یک روز از ماه را نشان می‌دهد:
 * سبز = حضور داشته، خاکستری = بدون رکورد حضور (غایب یا هنوز ثبت نشده).
 * با نگه‌داشتن/کلیک روی هر روز، جزئیات ساعت ورود/خروج و حقوق آن روز نمایش داده می‌شود.
 */
export function JalaliMonthCalendar({
  daysInMonth,
  startWeekdayIndex,
  dailyReports,
  dateForDay,
}: JalaliMonthCalendarProps) {
  const theme = useTheme();

  const cells: (number | null)[] = [
    ...Array(startWeekdayIndex).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" sx={{ mb: 0.5 }}>
        {WEEKDAY_LABELS.map((label) => (
          <Box key={label} sx={{ flex: 1, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {label}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
        {cells.map((day, idx) => {
          if (day === null) return <Box key={`empty-${idx}`} />;

          const isoDate = dateForDay(day);
          const report = dailyReports.get(isoDate);
          const present = !!report?.checkIn;

          const tooltipContent = report ? (
            <Box sx={{ p: 0.5, textAlign: "right" }}>
              <Typography variant="caption" display="block">
                ورود: {report.checkIn || "—"} | خروج: {report.checkOut || "—"}
              </Typography>
              <Typography variant="caption" display="block">
                ساعت مفید: {formatNumber(Math.round((report.usefulMinutes / 60) * 10) / 10)}
              </Typography>
              <Typography variant="caption" display="block" fontWeight={700}>
                حقوق: {formatCurrency(report.payableSalary)}
              </Typography>
              {report.guardDuty.shiftsCount > 0 && (
                <Typography variant="caption" display="block" fontWeight={700} sx={{ color: "#D4B0FF" }}>
                  نگهبانی: {formatCurrency(report.guardDuty.payableSalary)}
                </Typography>
              )}
            </Box>
          ) : (
            "بدون رکورد حضور"
          );

          return (
            <Tooltip key={day} title={tooltipContent} arrow>
              <Box
                sx={{
                  aspectRatio: "1",
                  borderRadius: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "default",
                  bgcolor: present ? `${theme.palette.success.main}22` : theme.palette.action.hover,
                  border: `1px solid ${present ? theme.palette.success.main : theme.palette.divider}`,
                }}
              >
                <Typography variant="caption" fontWeight={700}>
                  {formatNumber(day)}
                </Typography>
                {present && (
                  <Typography variant="caption" sx={{ fontSize: "0.6rem" }} color="success.main">
                    {report!.checkIn}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      <Stack direction="row" spacing={2} mt={1.5} justifyContent="center">
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: 0.5,
              bgcolor: `${theme.palette.success.main}22`,
              border: `1px solid ${theme.palette.success.main}`,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            حاضر
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: 0.5,
              bgcolor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            بدون رکورد
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
