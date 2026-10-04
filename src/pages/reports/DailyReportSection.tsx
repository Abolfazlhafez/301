import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EditIcon from "@mui/icons-material/Edit";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { reportsApi } from "../../shared/api/dashboardApi";
import { settingsApi } from "../../shared/api/settingsApi";
import { dailyReportNoteApi } from "../../shared/api/dailyReportNoteApi";
import { extractErrorMessage } from "../../shared/api/client";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { EditTextDialog } from "../../shared/components/EditTextDialog";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { useToast } from "../../shared/components/ToastProvider";
import { getTodayIso, toJalaliWithWeekday } from "../../shared/utils/jalaliDate";
import { formatCurrency, formatMinutesToText } from "../../shared/utils/format";
import { usePdfExport } from "../../shared/hooks/usePdfExport";
import { DailyReportWorkersPage } from "../../widgets/daily-report/DailyReportWorkersPage";

const WORKERS_PER_PAGE = 4;

export function DailyReportSection() {
  const { t } = useTranslation();
  const [date, setDate] = useState(getTodayIso());
  const [editingProjectInfo, setEditingProjectInfo] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const { exportPagesToPdf, isExporting } = usePdfExport();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["daily-report-all", date],
    queryFn: () => reportsApi.dailyForAllWorkers(date),
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const { data: reportNote } = useQuery({
    queryKey: ["daily-report-note", date],
    queryFn: () => dailyReportNoteApi.getByDate(date),
  });

  const updateProjectInfoMutation = useMutation({
    mutationFn: (input: { projectName: string; supervisorName: string; projectLocation: string }) =>
      settingsApi.updateProjectInfo(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setEditingProjectInfo(false);
      showToast(t("dailyReport.projectInfoSaved"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateNoteMutation = useMutation({
    mutationFn: (note: string) => dailyReportNoteApi.upsert(date, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-report-note", date] });
      setEditingNote(false);
      showToast(t("dailyReport.noteSaved"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  // گروه‌بندی نیروها به دسته‌های ۴تایی — هر دسته دقیقاً یک صفحه A4 می‌شود.
  const pages = useMemo(() => {
    if (!data) return [];
    const chunks: (typeof data)[] = [];
    for (let i = 0; i < data.length; i += WORKERS_PER_PAGE) {
      chunks.push(data.slice(i, i + WORKERS_PER_PAGE));
    }
    return chunks;
  }, [data]);

  const grandTotals = useMemo(() => {
    if (!data) return { workersCount: 0, totalUsefulMinutes: 0, totalTimeLossMinutes: 0, totalPayableSalary: 0 };
    return data.reduce(
      (acc, r) => ({
        workersCount: acc.workersCount + 1,
        totalUsefulMinutes: acc.totalUsefulMinutes + r.usefulMinutes,
        totalTimeLossMinutes: acc.totalTimeLossMinutes + r.totalTimeLossMinutes,
        totalPayableSalary: acc.totalPayableSalary + r.payableSalary + (r.guardDuty?.payableSalary ?? 0),
      }),
      { workersCount: 0, totalUsefulMinutes: 0, totalTimeLossMinutes: 0, totalPayableSalary: 0 }
    );
  }, [data]);

  const pageIds = pages.map((_, i) => `daily-report-page-${i}`);
  const generatedAtLabel = useMemo(() => {
    const now = new Date();
    return `${toJalaliWithWeekday(getTodayIso()).split(" | ")[1]} - ${now
      .getHours()
      .toString()
      .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  }, []);

  async function handleExport() {
    if (pages.length === 0) return;
    await exportPagesToPdf(pageIds, `${t("dailyReport.pdfFilePrefix")}-${date}.pdf`);
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
        <JalaliDatePicker label={t("dailyReport.dateLabel")} value={date} onChange={setDate} size="small" />
        <Typography variant="caption" color="text.secondary">
          {toJalaliWithWeekday(date)}
        </Typography>
      </Stack>

      {/* اطلاعات پروژه/سرپرست — قابل ویرایش، برای سربرگ PDF */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
      >
        <Box>
          <Typography variant="body2" fontWeight={700}>
            {settings?.projectName || t("dailyReport.noProject")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {settings?.supervisorName ? t("dailyReport.supervisorLine", { name: settings.supervisorName }) : t("dailyReport.noSupervisor")}
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setEditingProjectInfo(true)} aria-label={t("dailyReport.editProjectInfoAria")}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Stack>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={<AssessmentIcon fontSize="inherit" />}
          title={t("dailyReport.emptyTitle")}
          description={t("dailyReport.emptyDesc")}
        />
      )}

      {data && data.length > 0 && (
        <>
          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? t("reports.workerReport.exportingPdf") : t("dailyReport.downloadPdf")}
            </Button>
            <Button variant="text" size="small" onClick={() => setEditingNote(true)}>
              {reportNote?.supervisorNote ? t("dailyReport.editNote") : t("dailyReport.addNote")}
            </Button>
          </Stack>

          {/* پیش‌نمایش سریع روی صفحه — جزئیات کامل هر نیرو با آکاردئون (رفتار قبلی حفظ شده) */}
          <Stack spacing={1.25}>
            {data.map((report) => (
              <Accordion key={report.workerId} variant="outlined" disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {report.workerFullName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {report.position}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {/* محتوای حضور/غیاب عمداً از این گزارش حذف شده — تکراری با صفحهٔ
                      حضور و غیاب بود؛ خودِ صفحه‌ی حضور و غیاب همچنان منبع اصلی آن دادهٔ خام است.
                      اینجا فقط خلاصهٔ کار/دستمزد که مخصوص این گزارش است می‌ماند. */}
                  <Stack spacing={0.75}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      {t("dailyReport.summaryTitle")}
                    </Typography>
                    <ReportRow
                      label={t("dailyReport.timeLoss")}
                      value={formatMinutesToText(report.totalTimeLossMinutes)}
                      color="warning.main"
                    />
                    <ReportRow
                      label={t("dailyReport.allowedBreak")}
                      value={formatMinutesToText(report.totalBreakMinutes)}
                      color="info.main"
                    />
                    <ReportRow
                      label={t("dailyReport.usefulTime")}
                      value={formatMinutesToText(report.usefulMinutes)}
                      color="success.main"
                    />
                    <Divider sx={{ my: 0.5 }} />
                    <ReportRow
                      label={t("dailyReport.finalSalary")}
                      value={formatCurrency(report.payableSalary)}
                      color="primary.main"
                      bold
                    />

                    {report.timeLosses.length > 0 && (
                      <>
                        <Divider sx={{ my: 0.5 }} />
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                          {t("dailyReport.timeLossDetails")}
                        </Typography>
                        {report.timeLosses.map((tl) => (
                          <Typography key={tl.id} variant="caption" color="text.secondary">
                            {t("dailyReport.detailLine", { label: tl.reason, start: tl.startTime, end: tl.endTime })}
                          </Typography>
                        ))}
                      </>
                    )}

                    {report.breakTimes.length > 0 && (
                      <>

                        <Divider sx={{ my: 0.5 }} />
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                          {t("dailyReport.breakDetails")}
                        </Typography>
                        {report.breakTimes.map((bt) => (
                          <Typography key={bt.id} variant="caption" color="text.secondary">
                            {t("dailyReport.detailLine", { label: bt.typeLabel, start: bt.startTime, end: bt.endTime })}
                          </Typography>
                        ))}
                      </>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>

          {/* صفحات A4 خروجی PDF — خارج از دید کاربر، هر عنصر دقیقاً یک صفحه کامل است */}
          <Box sx={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }} aria-hidden>
            {pages.map((pageWorkers, i) => (
              <DailyReportWorkersPage
                key={pageIds[i]}
                id={pageIds[i]}
                date={date}
                projectName={settings?.projectName || ""}
                supervisorName={settings?.supervisorName || ""}
                supervisorNote={reportNote?.supervisorNote || ""}
                workers={pageWorkers}
                pageIndex={i}
                pageCount={pages.length}
                showSummaryFooter={i === pages.length - 1}
                generatedAtLabel={generatedAtLabel}
                grandTotals={grandTotals}
              />
            ))}
          </Box>
        </>
      )}

      <EditTextDialog
        open={editingNote}
        title={t("dailyReport.noteDialogTitle")}
        label={t("dailyReport.noteDialogLabel")}
        initialValue={reportNote?.supervisorNote || ""}
        saving={updateNoteMutation.isPending}
        onClose={() => setEditingNote(false)}
        onSave={(value) => updateNoteMutation.mutate(value)}
      />

      <ProjectInfoDialog
        open={editingProjectInfo}
        initialProjectName={settings?.projectName || ""}
        initialSupervisorName={settings?.supervisorName || ""}
        initialProjectLocation={settings?.projectLocation || ""}
        saving={updateProjectInfoMutation.isPending}
        onClose={() => setEditingProjectInfo(false)}
        onSave={(v) => updateProjectInfoMutation.mutate(v)}
      />
    </Box>
  );
}

function ReportRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={bold ? 700 : 600} color={color}>
        {value}
      </Typography>
    </Stack>
  );
}

function ProjectInfoDialog({
  open,
  initialProjectName,
  initialSupervisorName,
  initialProjectLocation,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initialProjectName: string;
  initialSupervisorName: string;
  initialProjectLocation: string;
  saving: boolean;
  onClose: () => void;
  onSave: (v: { projectName: string; supervisorName: string; projectLocation: string }) => void;
}) {
  const { t } = useTranslation();
  const [projectName, setProjectName] = useState(initialProjectName);
  const [supervisorName, setSupervisorName] = useState(initialSupervisorName);
  const [projectLocation, setProjectLocation] = useState(initialProjectLocation);

  useMemo(() => {
    if (open) {
      setProjectName(initialProjectName);
      setSupervisorName(initialSupervisorName);
      setProjectLocation(initialProjectLocation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(0,0,0,0.5)",
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
      onClick={onClose}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{ bgcolor: "background.paper", borderRadius: 2, p: 2.5, width: "100%", maxWidth: 420 }}
      >
        <Typography variant="subtitle1" fontWeight={700} mb={2}>
          {t("dailyReport.projectDialogTitle")}
        </Typography>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label={t("dailyReport.projectNameLabel")}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <TextField
            fullWidth
            label={t("dailyReport.supervisorNameLabel")}
            value={supervisorName}
            onChange={(e) => setSupervisorName(e.target.value)}
          />
          <TextField
            fullWidth
            label={t("dailyReport.projectLocationLabel")}
            value={projectLocation}
            onChange={(e) => setProjectLocation(e.target.value)}
          />
        </Stack>
        <Stack direction="row" justifyContent="flex-end" spacing={1} mt={2.5}>
          <Button onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={() => onSave({ projectName, supervisorName, projectLocation })}
          >
            {t("common.save")}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
