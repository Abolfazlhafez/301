import { forwardRef, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import { reportsApi } from "../../shared/api/dashboardApi";
import { settingsApi } from "../../shared/api/settingsApi";
import { extractErrorMessage } from "../../shared/api/client";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { ExportMenuButton } from "../../shared/components/ExportMenuButton";
import { useToast } from "../../shared/components/ToastProvider";
import { getCurrentJalaliMonthRange, toJalaliShort } from "../../shared/utils/jalaliDate";
import { formatCurrency, formatMinutesToText } from "../../shared/utils/format";
import { useLanguage } from "../../shared/hooks/useLanguage";
import { getCurrencyInfo } from "../../shared/i18n/languages";
import { exportRowsAsCsv, saveRowsAsCsvToDevice } from "../../shared/utils/exportCsv";
import { exportElementAsShareableImage, saveElementAsImageToDevice } from "../../shared/utils/exportCard";

/**
 * خلاصهٔ حقوق ماهانهٔ همهٔ نیروها در یک جدول — برخلاف تب «ماهانه» که فقط
 * یک نیرو را در هر بار نشان می‌دهد، این‌جا کل کارگاه در یک نگاه دیده
 * می‌شود؛ دقیقاً همان چیزی که برای بستن حقوق آخر ماه لازم است. از همان
 * منطق محاسباتی reportService.getMonthlyWorkerReport استفاده می‌کند (فقط
 * برای همهٔ نیروهای فعال یک‌جا اجرا می‌شود)، پس هیچ عدد جدیدی این‌جا
 * حساب نمی‌شود و با تب «ماهانه» همیشه هم‌خوان می‌ماند.
 */
// عرض ثابت رندر خروجی تصویر — مستقل از عرض واقعی صفحه (که روی موبایل معمولاً
// خیلی کمتر است). چون جدول ۶ ستونه با عرض واقعی صفحه در موبایل هم بریده
// می‌شد و هم فشرده/نامرتب به نظر می‌رسید، این جدول برای خروجی روی یک نسخهٔ
// کاملاً جدا با عرض ثابت و بزرگ (خارج از دید، با مختصات منفی) بازرندر
// می‌شود؛ خروجی نهایی همیشه کامل و خوانا است، صرف‌نظر از سایز گوشی کاربر.
const EXPORT_TABLE_WIDTH = 900;

export function MonthlyPayrollSummarySection() {
  const { t } = useTranslation();
  const { currency } = useLanguage();
  const currencySymbol = getCurrencyInfo(currency).symbol;
  const { showToast } = useToast();
  const defaultRange = getCurrentJalaliMonthRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const exportTableRef = useRef<HTMLDivElement>(null);

  const {
    data: reports,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["monthly-payroll-summary", from, to],
    queryFn: () => reportsApi.monthlyForAllWorkers(from, to),
    enabled: !!from && !!to,
  });

  const { data: appSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const grandTotal = reports?.reduce(
    (acc, r) => ({
      presentDays: acc.presentDays + r.presentDaysCount,
      usefulMinutes: acc.usefulMinutes + r.totalUsefulMinutes,
      salary: acc.salary + r.totalPayableSalary,
      guardDutySalary: acc.guardDutySalary + r.totalGuardDutyPayableSalary,
    }),
    { presentDays: 0, usefulMinutes: 0, salary: 0, guardDutySalary: 0 }
  );

  // سرستون‌ها، ردیف‌ها و نام فایل‌ها از زبان فعلی اپ می‌آیند و بین «اشتراک‌گذاری»
  // و «ذخیره در گوشی» مشترک‌اند (یک تعریف، نه دو کپی).
  function buildCsvTable() {
    const headers = [
      t("payrollSummary.csvWorker"),
      t("payrollSummary.csvPosition"),
      t("payrollSummary.csvPresentDays"),
      t("payrollSummary.csvUsefulHours"),
      t("payrollSummary.csvRegular", { symbol: currencySymbol }),
      t("payrollSummary.csvGuard", { symbol: currencySymbol }),
      t("payrollSummary.csvTotal", { symbol: currencySymbol }),
    ];
    const rows = (reports ?? []).map((r) => [
      r.workerFullName,
      r.position,
      r.presentDaysCount,
      formatMinutesToText(r.totalUsefulMinutes),
      r.totalPayableSalary,
      r.totalGuardDutyPayableSalary,
      r.totalPayableSalary + r.totalGuardDutyPayableSalary,
    ]);
    return { headers, rows };
  }
  const csvFileName = () => t("payrollSummary.csvFileName", { from: toJalaliShort(from), to: toJalaliShort(to) });
  const imageFileName = () => t("payrollSummary.imageFileName", { from: toJalaliShort(from), to: toJalaliShort(to) });

  async function handleExportCsv() {
    if (!reports || reports.length === 0) return;
    setIsExportingCsv(true);
    try {
      const { headers, rows } = buildCsvTable();
      await exportRowsAsCsv(headers, rows, csvFileName());
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setIsExportingCsv(false);
    }
  }

  async function handleExportImage() {
    if (!exportTableRef.current) return;
    try {
      await exportElementAsShareableImage(exportTableRef.current, imageFileName(), t("payrollSummary.exportTitle"));
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }

  // نسخهٔ «ذخیره در گوشی» همین دو خروجی — بدون بازکردن منوی اشتراک‌گذاری.
  async function handleSaveCsvToDevice() {
    if (!reports || reports.length === 0) return;
    setIsExportingCsv(true);
    try {
      const { headers, rows } = buildCsvTable();
      await saveRowsAsCsvToDevice(headers, rows, csvFileName());
      showToast(t("payrollSummary.toastExcelSaved"), "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setIsExportingCsv(false);
    }
  }

  async function handleSaveImageToDevice() {
    if (!exportTableRef.current) return;
    try {
      await saveElementAsImageToDevice(exportTableRef.current, imageFileName());
      showToast(t("payrollSummary.toastImageSaved"), "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction="row" spacing={1.5}>
        <JalaliDatePicker label={t("reports.workerReport.fromDateLabel")} value={from} onChange={setFrom} size="small" />
        <JalaliDatePicker label={t("reports.workerReport.toDateLabel")} value={to} onChange={setTo} size="small" />
      </Stack>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {reports && reports.length === 0 && (
        <EmptyState
          icon={<PeopleAltIcon fontSize="inherit" />}
          title={t("payrollSummary.emptyTitle")}
          description={t("payrollSummary.emptyDesc")}
        />
      )}

      {reports && reports.length > 0 && grandTotal && (
        <>
          <ExportMenuButton
            onExportImage={handleExportImage}
            onExportExcel={handleExportCsv}
            onSaveImageToDevice={handleSaveImageToDevice}
            onSaveExcelToDevice={handleSaveCsvToDevice}
            disabled={isExportingCsv}
          />

          <Card variant="outlined">
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("payrollSummary.colWorker")}</TableCell>
                      <TableCell align="center">{t("payrollSummary.colPresentDays")}</TableCell>
                      <TableCell align="center">{t("payrollSummary.colUsefulHours")}</TableCell>
                      <TableCell align="left">{t("payrollSummary.colRegular")}</TableCell>
                      <TableCell align="left">{t("payrollSummary.colGuardDuty")}</TableCell>
                      <TableCell align="left">{t("payrollSummary.colTotal")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.workerId} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {r.workerFullName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {r.position}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">{r.presentDaysCount}</TableCell>
                        <TableCell align="center">{formatMinutesToText(r.totalUsefulMinutes)}</TableCell>
                        <TableCell align="left">{formatCurrency(r.totalPayableSalary)}</TableCell>
                        <TableCell align="left">
                          {r.totalGuardDutyPayableSalary > 0 ? formatCurrency(r.totalGuardDutyPayableSalary) : "—"}
                        </TableCell>
                        <TableCell align="left">
                          <Typography variant="body2" fontWeight={700} color="primary.main">
                            {formatCurrency(r.totalPayableSalary + r.totalGuardDutyPayableSalary)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {t("payrollSummary.totalRow", { count: reports.length })}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={700}>
                          {grandTotal.presentDays}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={700}>
                          {formatMinutesToText(grandTotal.usefulMinutes)}
                        </Typography>
                      </TableCell>
                      <TableCell align="left">
                        <Typography variant="body2" fontWeight={700}>
                          {formatCurrency(grandTotal.salary)}
                        </Typography>
                      </TableCell>
                      <TableCell align="left">
                        <Typography variant="body2" fontWeight={700}>
                          {grandTotal.guardDutySalary > 0 ? formatCurrency(grandTotal.guardDutySalary) : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="left">
                        <Typography variant="body2" fontWeight={800} color="primary.main">
                          {formatCurrency(grandTotal.salary + grandTotal.guardDutySalary)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* رندر مخفی برای خروجی تصویر — با عرض ثابت EXPORT_TABLE_WIDTH، مستقل
          از عرض واقعی صفحه، تا روی موبایل هم جدول کامل و بدون بریدگی گرفته
          شود (نه فقط بخشی که در همان لحظه در دید کاربر است). رنگ‌ها به‌صورت
          صریح از رنگ‌های تم فعلی خوانده می‌شوند تا خروجی هم در حالت روشن و
          هم تاریک هم‌خوان با ظاهر واقعی برنامه باشد. هرگز از opacity:0 برای
          مخفی‌کردن استفاده نمی‌شود (html2canvas افت شفافیت را هم در خروجی
          اعمال می‌کند)؛ به‌جای آن با مختصات منفی از صفحه بیرون برده می‌شود. */}
      {reports && reports.length > 0 && grandTotal && (
        <PayrollExportTable
          ref={exportTableRef}
          reports={reports as WorkerMonthlyPayrollRow[]}
          grandTotal={grandTotal}
          from={from}
          to={to}
          projectName={appSettings?.projectName}
        />
      )}
    </Box>
  );
}

interface WorkerMonthlyPayrollRow {
  workerId: string;
  workerFullName: string;
  position: string;
  presentDaysCount: number;
  totalUsefulMinutes: number;
  totalPayableSalary: number;
  totalGuardDutyPayableSalary: number;
}

interface PayrollExportTableProps {
  reports: WorkerMonthlyPayrollRow[];
  grandTotal: { presentDays: number; usefulMinutes: number; salary: number; guardDutySalary: number };
  from: string;
  to: string;
  projectName?: string;
}

const PayrollExportTable = forwardRef<HTMLDivElement, PayrollExportTableProps>(function PayrollExportTable(
  { reports, grandTotal, from, to, projectName },
  ref
) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const paperBg = theme.palette.background.paper;
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const borderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(17,19,24,0.12)";
  const headerBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(17,19,24,0.045)";
  const accent = theme.palette.primary.main;

  const cellStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: `1px solid ${borderColor}`,
    textAlign: "right",
    fontSize: 14,
  };
  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 700,
    color: textSecondary,
    backgroundColor: headerBg,
  };

  return (
    <Box sx={{ position: "fixed", top: 0, insetInlineStart: -9999, zIndex: -1 }} aria-hidden>
      <Box
        ref={ref}
        sx={{
          width: EXPORT_TABLE_WIDTH,
          bgcolor: paperBg,
          color: textPrimary,
          p: 3,
          fontFamily: "'Vazirmatn', 'Roboto', 'Arial', sans-serif",
        }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ color: textPrimary, mb: 0.25 }}>
          {t("payrollSummary.exportTitle")}
        </Typography>
        <Typography variant="body2" sx={{ color: textSecondary, mb: 2 }}>
          {projectName ? `${projectName} · ` : ""}
          {t("payrollSummary.dateRange", { from: toJalaliShort(from), to: toJalaliShort(to) })}
        </Typography>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={headerCellStyle}>{t("payrollSummary.colWorker")}</th>
              <th style={{ ...headerCellStyle, textAlign: "center" }}>{t("payrollSummary.colPresentDays")}</th>
              <th style={{ ...headerCellStyle, textAlign: "center" }}>{t("payrollSummary.colUsefulHours")}</th>
              <th style={headerCellStyle}>{t("payrollSummary.colRegular")}</th>
              <th style={headerCellStyle}>{t("payrollSummary.colGuardDuty")}</th>
              <th style={headerCellStyle}>{t("payrollSummary.colTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.workerId}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 600 }}>{r.workerFullName}</div>
                  <div style={{ fontSize: 12, color: textSecondary }}>{r.position}</div>
                </td>
                <td style={{ ...cellStyle, textAlign: "center" }}>{r.presentDaysCount}</td>
                <td style={{ ...cellStyle, textAlign: "center" }}>{formatMinutesToText(r.totalUsefulMinutes)}</td>
                <td style={cellStyle}>{formatCurrency(r.totalPayableSalary)}</td>
                <td style={cellStyle}>
                  {r.totalGuardDutyPayableSalary > 0 ? formatCurrency(r.totalGuardDutyPayableSalary) : "—"}
                </td>
                <td style={{ ...cellStyle, fontWeight: 700, color: accent }}>
                  {formatCurrency(r.totalPayableSalary + r.totalGuardDutyPayableSalary)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...cellStyle, fontWeight: 700, borderBottom: "none" }}>
                {t("payrollSummary.totalRow", { count: reports.length })}
              </td>
              <td style={{ ...cellStyle, textAlign: "center", fontWeight: 700, borderBottom: "none" }}>
                {grandTotal.presentDays}
              </td>
              <td style={{ ...cellStyle, textAlign: "center", fontWeight: 700, borderBottom: "none" }}>
                {formatMinutesToText(grandTotal.usefulMinutes)}
              </td>
              <td style={{ ...cellStyle, fontWeight: 700, borderBottom: "none" }}>
                {formatCurrency(grandTotal.salary)}
              </td>
              <td style={{ ...cellStyle, fontWeight: 700, borderBottom: "none" }}>
                {grandTotal.guardDutySalary > 0 ? formatCurrency(grandTotal.guardDutySalary) : "—"}
              </td>
              <td style={{ ...cellStyle, fontWeight: 800, color: accent, borderBottom: "none" }}>
                {formatCurrency(grandTotal.salary + grandTotal.guardDutySalary)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Box>
    </Box>
  );
});
