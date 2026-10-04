import { Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { PhotoThumbImg } from "../../shared/components/PhotoThumbImg";
import { formatNumber } from "../../shared/utils/format";
import { getTodayIso } from "../../shared/utils/jalaliDate";

export interface WorkLogDaySummary {
  /** تعداد عکس‌های ثبت‌شده در این روز */
  count: number;
  /** فایل یک عکس نمونه از آن روز، برای نمایش تصویر کوچک در خانه تقویم */
  thumbnailFilename: string | null;
  /** آیا متن توضیحی هم برای این روز ثبت شده؟ */
  hasNote: boolean;
}

interface WorkLogCalendarProps {
  daysInMonth: number;
  startWeekdayIndex: number; // 0=شنبه ... 6=جمعه
  summaries: Map<string, WorkLogDaySummary>; // کلید: تاریخ ISO میلادی
  dateForDay: (day: number) => string;
  selectedDate: string | null;
  onSelectDay: (isoDate: string) => void;
}

const WEEKDAY_LABELS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/**
 * تقویم ماهانه شمسی برای «گزارش کار». هر خانه یک روز از ماه است؛ اگر برای آن روز
 * عکس یا توضیحی ثبت شده باشد، تصویر بندانگشتی همان روز به‌عنوان پس‌زمینه خانه نمایش
 * داده می‌شود تا با یک نگاه بشود دید در هر روز چه اتفاقی افتاده است.
 */
export function WorkLogCalendar({
  daysInMonth,
  startWeekdayIndex,
  summaries,
  dateForDay,
  selectedDate,
  onSelectDay,
}: WorkLogCalendarProps) {
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
          const summary = summaries.get(isoDate);
          const hasEntry = !!summary && (summary.count > 0 || summary.hasNote);
          const isSelected = isoDate === selectedDate;
          const isToday = isoDate === getTodayIso();

          return (
            <Box
              key={day}
              onClick={() => onSelectDay(isoDate)}
              sx={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: 1.5,
                overflow: "hidden",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                bgcolor: hasEntry ? "transparent" : theme.palette.action.hover,
                border: isSelected
                  ? `2px solid ${theme.palette.primary.main}`
                  : isToday
                    ? `1.5px dashed ${theme.palette.primary.main}`
                    : `1px solid ${theme.palette.divider}`,
                transition: "border-color 0.15s ease",
              }}
            >
              {summary?.thumbnailFilename && (
                <PhotoThumbImg
                  photo={{ filename: summary.thumbnailFilename }}
                  alt=""
                  sx={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              )}
              {hasEntry && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background: summary?.thumbnailFilename
                      ? "linear-gradient(to top, rgba(0,0,0,0.55), transparent 55%)"
                      : "none",
                  }}
                />
              )}
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                  position: "relative",
                  zIndex: 1,
                  color: summary?.thumbnailFilename ? "common.white" : "text.primary",
                  px: 0.25,
                  pb: 0.25,
                }}
              >
                {formatNumber(day)}
              </Typography>
              {hasEntry && !summary?.thumbnailFilename && (
                <PhotoCameraIcon
                  sx={{
                    position: "absolute",
                    top: 3,
                    left: 3,
                    fontSize: 13,
                    color: "primary.main",
                    opacity: 0.85,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      <Stack direction="row" spacing={2} mt={1.5} justifyContent="center" flexWrap="wrap">
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: 0.5,
              border: `1.5px dashed ${theme.palette.primary.main}`,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            امروز
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <PhotoCameraIcon sx={{ fontSize: 14, color: "primary.main" }} />
          <Typography variant="caption" color="text.secondary">
            گزارش ثبت‌شده
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
