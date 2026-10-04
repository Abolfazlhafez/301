import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import TodayIcon from "@mui/icons-material/Today";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import PaymentsIcon from "@mui/icons-material/Payments";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FreeBreakfastIcon from "@mui/icons-material/FreeBreakfast";
import SecurityIcon from "@mui/icons-material/Security";
import { workersApi } from "../../shared/api/workersApi";
import { reportsApi } from "../../shared/api/dashboardApi";
import { extractErrorMessage } from "../../shared/api/client";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { StatCard } from "../../shared/components/StatCard";
import { formatCurrency, formatMinutesToText } from "../../shared/utils/format";
import { usePdfExport } from "../../shared/hooks/usePdfExport";
import { getTodayIso, getWeekStartIso, addDaysIso, toJalaliShort, getWeekdayLabel } from "../../shared/utils/jalaliDate";
import { WorkerAvatar } from "../../widgets/worker-form/WorkerAvatar";

const REPORT_ELEMENT_ID = "weekly-worker-report-printable";

/**
 * قالب «گزارش هفتگی نیرو» — خلاصهٔ حضور/عملکرد/دستمزد یک نیرو در یک هفتهٔ
 * مشخص (شنبه تا جمعه برای تقویم شمسی). دقیقاً از همان سرویس عمومی بازهٔ
 * دلخواه (`reportsApi.monthlyForWorker`، که با وجود نامش هر بازهٔ from/to
 * را می‌پذیرد، نه فقط یک ماه کامل) استفاده می‌کند که در MonthlyReportSection
 * هم استفاده شده — یعنی هیچ منطق محاسباتیِ جدید یا موازی اضافه نمی‌شود؛
 * تنها چیزی که این کامپوننت اضافه می‌کند «قفل‌کردن» بازه به دقیقاً یک هفته
 * و ناوبری هفته‌به‌هفته است. این عمداً یک زیر-بخش مستقل کنار «روزانه» و
 * «ماهانه» است (نه بازنویسی آن دو)، تا با ساختار موجود صفحهٔ گزارش‌ها هماهنگ بماند.
 */
export function WeeklyWorkerReportSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  // «هفتهٔ بعد» یعنی حرکت به سمت آینده؛ در چیدمان RTL (فارسی و ...) این
  // بصری به‌سمت چپ است، در LTR به‌سمت راست — دقیقاً همان الگوی
  // ActivityGanttView برای شورون‌های ناوبری دوره‌ای.
  const NextWeekIcon = theme.direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;
  const PrevWeekIcon = theme.direction === "rtl" ? ChevronRightIcon : ChevronLeftIcon;

  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [weekReferenceDate, setWeekReferenceDate] = useState(getTodayIso());
  const { exportToPdf, isExporting } = usePdfExport();

  const from = getWeekStartIso(weekReferenceDate);
  const to = addDaysIso(from, 6);

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: () => workersApi.list(),
  });

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["weekly-worker-report", selectedWorkerId, from, to],
    queryFn: () => reportsApi.monthlyForWorker(selectedWorkerId, from, to),
    enabled: !!selectedWorkerId,
  });

  function goToPreviousWeek() {
    setWeekReferenceDate((prev) => addDaysIso(getWeekStartIso(prev), -1));
  }
  function goToNextWeek() {
    setWeekReferenceDate((prev) => addDaysIso(getWeekStartIso(prev), 7));
  }
  function goToCurrentWeek() {
    setWeekReferenceDate(getTodayIso());
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <TextField
        select
        label={t("reports.workerReport.selectWorkerLabel")}
        value={selectedWorkerId}
        onChange={(e) => setSelectedWorkerId(e.target.value)}
        disabled={workersLoading}
        size="small"
      >
        <MenuItem value="" disabled>
          {workersLoading ? t("common.loading") : t("reports.workerReport.selectWorkerPlaceholder")}
        </MenuItem>
        {workers?.map((w) => (
          <MenuItem key={w.id} value={w.id}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <WorkerAvatar
                avatarPhotoId={w.avatarPhotoId}
                initials={`${w.firstName.charAt(0)}${w.lastName.charAt(0)}`}
                size={22}
              />
              <span>
                {w.firstName} {w.lastName}
              </span>
            </Stack>
          </MenuItem>
        ))}
      </TextField>

      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <IconButton onClick={goToPreviousWeek} aria-label={t("reports.weekly.previousWeekAria") as string}>
          <PrevWeekIcon />
        </IconButton>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" fontWeight={700}>
            {toJalaliShort(from)} {t("reports.workerReport.toSeparator")} {toJalaliShort(to)}
          </Typography>
          <IconButton size="small" onClick={goToCurrentWeek} aria-label={t("reports.weekly.currentWeekAria") as string}>
            <TodayIcon fontSize="small" />
          </IconButton>
        </Stack>
        <IconButton onClick={goToNextWeek} aria-label={t("reports.weekly.nextWeekAria") as string}>
          <NextWeekIcon />
        </IconButton>
      </Stack>

      {!selectedWorkerId && (
        <EmptyState
          icon={<CalendarMonthIcon fontSize="inherit" />}
          title={t("reports.weekly.emptySelectTitle") as string}
          description={t("reports.weekly.emptySelectDescription") as string}
        />
      )}

      {selectedWorkerId && isLoading && <LoadingState />}
      {selectedWorkerId && isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {report && (
        <>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={() => exportToPdf(REPORT_ELEMENT_ID, `${t("reports.weekly.pdfFilenamePrefix")}-${report.workerFullName}.pdf`)}
            disabled={isExporting}
            sx={{ alignSelf: "flex-start" }}
          >
            {isExporting ? t("reports.workerReport.exportingPdf") : t("reports.workerReport.downloadPdf")}
          </Button>

          <Box id={REPORT_ELEMENT_ID} sx={{ bgcolor: "background.default", p: 1 }}>
            <Box display="flex" flexDirection="column" gap={2}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {report.workerFullName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {report.position} — {t("reports.weekly.weekLabel")} {toJalaliShort(from)} {t("reports.workerReport.toSeparator")} {toJalaliShort(to)}
                </Typography>
              </Box>

              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <StatCard
                    title={t("reports.workerReport.presentDaysTitle") as string}
                    value={t("reports.weekly.presentDaysValue", { count: report.presentDaysCount }) as string}
                    icon={<EventAvailableIcon />}
                    color="#2E7D32"
                  />
                </Grid>
                <Grid item xs={6}>
                  <StatCard
                    title={t("reports.workerReport.totalWorkHoursTitle") as string}
                    value={formatMinutesToText(report.totalAttendanceMinutes)}
                    icon={<AccessTimeIcon />}
                    color="#0288D1"
                  />
                </Grid>
                <Grid item xs={6}>
                  <StatCard
                    title={t("reports.workerReport.totalTimeLossTitle") as string}
                    value={formatMinutesToText(report.totalTimeLossMinutes)}
                    icon={<HourglassBottomIcon />}
                    color="#ED6C02"
                  />
                </Grid>
                <Grid item xs={6}>
                  <StatCard
                    title={t("reports.workerReport.totalBreakTitle") as string}
                    value={formatMinutesToText(report.totalBreakMinutes)}
                    icon={<FreeBreakfastIcon />}
                    color="#0288D1"
                  />
                </Grid>
                <Grid item xs={report.totalGuardDutyPayableSalary > 0 ? 6 : 12}>
                  <StatCard
                    title={t("reports.weekly.totalSalaryTitle") as string}
                    value={formatCurrency(report.totalPayableSalary)}
                    icon={<PaymentsIcon />}
                    color="#FF7A00"
                  />
                </Grid>
                {report.totalGuardDutyPayableSalary > 0 && (
                  <Grid item xs={6}>
                    <StatCard
                      title={t("reports.workerReport.guardDutySalaryTitle", { count: report.totalGuardDutyShiftsCount }) as string}
                      value={formatCurrency(report.totalGuardDutyPayableSalary)}
                      icon={<SecurityIcon />}
                      color="#7B4FA0"
                    />
                  </Grid>
                )}
              </Grid>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} mb={1}>
                    {t("reports.weekly.dailyDetailsTitle")}
                  </Typography>
                  {report.dailyBreakdown.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      {t("reports.weekly.noRecordsInRange")}
                    </Typography>
                  )}
                  <Stack divider={<Divider />} spacing={1}>
                    {report.dailyBreakdown.map((day) => (
                      <Stack key={day.date} direction="row" justifyContent="space-between" py={0.5}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {getWeekdayLabel(day.date)} {toJalaliShort(day.date)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {day.checkIn || "—"} {t("reports.workerReport.toSeparator")} {day.checkOut || "—"} | {t("reports.workerReport.usefulTimeLabel")}: {formatMinutesToText(day.usefulMinutes)}
                          </Typography>
                        </Box>
                        <Box textAlign="left">
                          <Typography variant="body2" fontWeight={700} color="primary.main">
                            {formatCurrency(day.payableSalary)}
                          </Typography>
                          {day.guardDuty.shiftsCount > 0 && (
                            <Typography variant="caption" fontWeight={700} sx={{ color: "#7B4FA0" }}>
                              + {formatCurrency(day.guardDuty.payableSalary)} {t("reports.workerReport.guardDutySuffix")}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
