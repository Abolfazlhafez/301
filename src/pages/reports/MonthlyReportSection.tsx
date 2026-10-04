import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Box, Button, ButtonGroup, Card, CardContent, Divider, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ViewListIcon from "@mui/icons-material/ViewList";
import CalendarViewMonthIcon from "@mui/icons-material/CalendarViewMonth";
import { workersApi } from "../../shared/api/workersApi";
import { reportsApi } from "../../shared/api/dashboardApi";
import { extractErrorMessage } from "../../shared/api/client";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { StatCard } from "../../shared/components/StatCard";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { JalaliMonthCalendar } from "../../widgets/calendar/JalaliMonthCalendar";
import {
  getCurrentJalaliMonthRange,
  getJalaliMonthCalendarParams,
  toJalaliShort,
} from "../../shared/utils/jalaliDate";
import { DailyWorkerReport } from "../../entities/Report";
import { formatCurrency, formatMinutesToText } from "../../shared/utils/format";
import { usePdfExport } from "../../shared/hooks/usePdfExport";
import { MonthlyChart } from "../../widgets/charts/MonthlyChart";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import PaymentsIcon from "@mui/icons-material/Payments";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FreeBreakfastIcon from "@mui/icons-material/FreeBreakfast";
import SecurityIcon from "@mui/icons-material/Security";
import { WorkerAvatar } from "../../widgets/worker-form/WorkerAvatar";

const REPORT_ELEMENT_ID = "monthly-report-printable";

export function MonthlyReportSection() {
  const { t } = useTranslation();
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const defaultRange = getCurrentJalaliMonthRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const { exportToPdf, isExporting } = usePdfExport();

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
    queryKey: ["monthly-report", selectedWorkerId, from, to],
    queryFn: () => reportsApi.monthlyForWorker(selectedWorkerId, from, to),
    enabled: !!selectedWorkerId && !!from && !!to,
  });

  const calendarParams = useMemo(() => getJalaliMonthCalendarParams(from), [from]);

  const dailyReportsMap = useMemo(() => {
    const map = new Map<string, DailyWorkerReport>();
    report?.dailyBreakdown.forEach((d) => map.set(d.date, d));
    return map;
  }, [report]);

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

      <Stack direction="row" spacing={1.5}>
        <JalaliDatePicker label={t("reports.workerReport.fromDateLabel") as string} value={from} onChange={setFrom} size="small" />
        <JalaliDatePicker label={t("reports.workerReport.toDateLabel") as string} value={to} onChange={setTo} size="small" />
      </Stack>

      {!selectedWorkerId && (
        <EmptyState
          icon={<CalendarMonthIcon fontSize="inherit" />}
          title={t("reports.monthly.emptySelectTitle") as string}
          description={t("reports.monthly.emptySelectDescription") as string}
        />
      )}

      {selectedWorkerId && isLoading && <LoadingState />}
      {selectedWorkerId && isError && (
        <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />
      )}

      {report && (
        <>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={() =>
              exportToPdf(REPORT_ELEMENT_ID, `${t("reports.monthly.pdfFilenamePrefix")}-${report.workerFullName}.pdf`)
            }
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
                  {report.position} — {t("reports.monthly.rangeLabel")}: {toJalaliShort(from)} {t("reports.workerReport.toSeparator")} {toJalaliShort(to)}
                </Typography>
              </Box>

              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <StatCard
                    title={t("reports.workerReport.presentDaysTitle") as string}
                    value={t("reports.monthly.presentDaysValue", { count: report.presentDaysCount }) as string}
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
                    title={t("reports.monthly.totalSalaryTitle") as string}
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

              {report.dailyBreakdown.length > 0 && <MonthlyChart data={report.dailyBreakdown} />}

              <Stack direction="row" justifyContent="center">
                <ButtonGroup size="small">
                  <Button
                    variant={viewMode === "calendar" ? "contained" : "outlined"}
                    startIcon={<CalendarViewMonthIcon />}
                    onClick={() => setViewMode("calendar")}
                  >
                    {t("reports.workerReport.calendarView")}
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "contained" : "outlined"}
                    startIcon={<ViewListIcon />}
                    onClick={() => setViewMode("list")}
                  >
                    {t("reports.workerReport.listView")}
                  </Button>
                </ButtonGroup>
              </Stack>

              {viewMode === "calendar" && (
                <JalaliMonthCalendar
                  year={calendarParams.year}
                  month={calendarParams.month}
                  daysInMonth={calendarParams.daysInMonth}
                  startWeekdayIndex={calendarParams.startWeekdayIndex}
                  dailyReports={dailyReportsMap}
                  dateForDay={calendarParams.dateForDay}
                />
              )}

              {viewMode === "list" && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} mb={1}>
                      {t("reports.workerReport.dailyDetailsTitle")}
                    </Typography>
                    {report.dailyBreakdown.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        {t("reports.workerReport.noRecordsInRange")}
                      </Typography>
                    )}
                    <Stack divider={<Divider />} spacing={1}>
                      {report.dailyBreakdown.map((day) => (
                        <Stack key={day.date} direction="row" justifyContent="space-between" py={0.5}>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {toJalaliShort(day.date)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {day.checkIn || "—"} {t("reports.workerReport.toSeparator")} {day.checkOut || "—"} | {t("reports.workerReport.usefulTimeLabel")}:{" "}
                              {formatMinutesToText(day.usefulMinutes)}
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
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
