import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { addMonths } from "date-fns-jalali";
import { photosApi } from "../../shared/api/photosApi";
import { PREF_KEYS, getPref, setPref } from "../../shared/storage/appPreferences";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { extractErrorMessage } from "../../shared/api/client";
import { getJalaliMonthCalendarParams, getMonthYearLabel, getTodayIso, toLocalIso } from "../../shared/utils/jalaliDate";
import { WorkLogCalendar, WorkLogDaySummary } from "../../widgets/work-log/WorkLogCalendar";
import { WorkLogDayEntries } from "../../widgets/work-log/WorkLogDayEntries";

// آخرین روزی که کاربر در «گزارش کار» انتخاب کرده بود، در همین حافظه محلی
// (Preferences) نگه داشته می‌شود تا با بستن/بازکردن اپ یا تغییر مسیر و
// بازگشت، کاربر دقیقاً به همان روز برگردد، نه همیشه به «امروز».
const LAST_SELECTED_DATE_KEY = PREF_KEYS.workLogLastDate;

function getInitialSelectedDate(): string {
  try {
    const stored = getPref(LAST_SELECTED_DATE_KEY);
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  } catch {
    // در صورت در دسترس نبودن ذخیره‌سازی، به امروز برمی‌گردیم.
  }
  return getTodayIso();
}

interface WorkLogPageProps {
  embedded?: boolean;
}

/**
 * صفحه «گزارش کار»: تقویم شمسی ماهانه که هر روز آن با عکس همان روز نمایش داده
 * می‌شود، به همراه گالری عکس و متن گزارش‌های ثبت‌شده برای روز انتخاب‌شده.
 * وقتی embedded=true باشد (یعنی داخل زیرتبِ صفحهٔ ادغام‌شدهٔ «فعالیت‌ها»
 * رندر شده)، عنوان و زیرعنوان تکراری صفحه نمایش داده نمی‌شوند، چون همان‌جا
 * قبلاً یک بار عنوان کلی صفحه نشان داده شده است.
 */
export function WorkLogPage({ embedded = false }: WorkLogPageProps = {}) {
  const { t } = useTranslation();
  const theme = useTheme();
  // در RTL «ماه قبل» بصری یعنی سمت راست (فلش راست) و «ماه بعد» یعنی سمت چپ؛
  // در LTR دقیقاً برعکس. قبلاً این دو آیکون بدون توجه به جهت زبان هاردکد
  // شده بودند (طبق مورد ۶ گزارش بررسی پروژه)، در حالی که همین الگو در
  // FloorNotebookPage/ProjectFloorsCard درست پیاده شده بود.
  const PrevMonthIcon = theme.direction === "rtl" ? ChevronRightIcon : ChevronLeftIcon;
  const NextMonthIcon = theme.direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;
  const [referenceDate, setReferenceDate] = useState(() => getInitialSelectedDate());
  const [selectedDate, setSelectedDate] = useState<string | null>(() => getInitialSelectedDate());

  useEffect(() => {
    if (!selectedDate) return;
    try {
      setPref(LAST_SELECTED_DATE_KEY, selectedDate);
    } catch {
      // ذخیره آخرین روز انتخابی صرفاً یک بهبود تجربه کاربری است؛ شکست آن بی‌اهمیت است.
    }
  }, [selectedDate]);

  const { year, month, daysInMonth, startWeekdayIndex, dateForDay } = useMemo(
    () => getJalaliMonthCalendarParams(referenceDate),
    [referenceDate],
  );

  const monthLabel = useMemo(() => getMonthYearLabel(referenceDate), [referenceDate]);

  const monthStart = useMemo(() => dateForDay(1), [dateForDay]);
  const monthEnd = useMemo(() => dateForDay(daysInMonth), [dateForDay, daysInMonth]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["photos", "site", "work-log", monthStart, monthEnd],
    queryFn: () => photosApi.list({ relatedType: "site", from: monthStart, to: monthEnd }),
  });

  const summaries = useMemo(() => {
    const map = new Map<string, WorkLogDaySummary>();
    (data ?? []).forEach((photo) => {
      const existing = map.get(photo.date);
      if (existing) {
        existing.count += 1;
        if (photo.caption) existing.hasNote = true;
      } else {
        map.set(photo.date, {
          count: 1,
          thumbnailFilename: photo.filename,
          hasNote: !!photo.caption,
        });
      }
    });
    return map;
  }, [data]);

  function goToPreviousMonth() {
    const prev = toLocalIso(addMonths(new Date(referenceDate), -1));
    setReferenceDate(prev);
  }

  function goToNextMonth() {
    const next = toLocalIso(addMonths(new Date(referenceDate), 1));
    setReferenceDate(next);
  }

  // فقط وقتی نشان داده می‌شود که کاربر از ماه جاری دور شده باشد — وگرنه یک
  // دکمهٔ همیشه‌نمایان که کاری نمی‌کند فقط شلوغی بی‌فایده است. مقایسه از
  // روی برچسب نمایشی ماه انجام می‌شود (نه year+month میلادی خام)، چون
  // ماه‌های شمسی روی مرز ماه‌های میلادی نمی‌افتند — مقایسهٔ مستقیم
  // year-month میلادی referenceDate با امروز، تشخیص «همان ماه شمسی» را
  // اشتباه می‌کرد.
  const todayIso = getTodayIso();
  const isViewingCurrentMonth = monthLabel === getMonthYearLabel(todayIso);

  function goToToday() {
    const today = getTodayIso();
    setReferenceDate(today);
    setSelectedDate(today);
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {!embedded && (
        <>
          <Typography variant="h5" fontWeight={700}>
            {t("workLog.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: -1.5 }}>
            {t("workLog.subtitle")}
          </Typography>
        </>
      )}

      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <IconButton onClick={goToPreviousMonth} aria-label={t("workLog.prevMonth") as string}>
          <PrevMonthIcon />
        </IconButton>
        <Stack alignItems="center" spacing={0.25}>
          <Typography variant="subtitle1" fontWeight={700}>
            {monthLabel}
          </Typography>
          {!isViewingCurrentMonth && (
            <Typography
              variant="caption"
              color="primary"
              fontWeight={700}
              onClick={goToToday}
              sx={{ cursor: "pointer" }}
            >
              {t("workLog.goToToday")}
            </Typography>
          )}
        </Stack>
        <IconButton onClick={goToNextMonth} aria-label={t("workLog.nextMonth") as string}>
          <NextMonthIcon />
        </IconButton>
      </Stack>

      {isLoading && <LoadingState message={t("workLog.loadingCalendar") as string} />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <WorkLogCalendar
          key={`${year}-${month}`}
          daysInMonth={daysInMonth}
          startWeekdayIndex={startWeekdayIndex}
          summaries={summaries}
          dateForDay={dateForDay}
          selectedDate={selectedDate}
          onSelectDay={setSelectedDate}
        />
      )}

      {selectedDate && <WorkLogDayEntries date={selectedDate} />}
    </Box>
  );
}
