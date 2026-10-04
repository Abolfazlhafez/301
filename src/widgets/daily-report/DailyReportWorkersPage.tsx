import { Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ApartmentIcon from "@mui/icons-material/Apartment";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PersonIcon from "@mui/icons-material/Person";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import InsertChartOutlinedIcon from "@mui/icons-material/InsertChartOutlined";
import GroupsIcon from "@mui/icons-material/Groups";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import { DailyWorkerReport } from "../../entities/Report";
import { formatCurrency, formatMinutesToText } from "../../shared/utils/format";
import { toJalaliWithWeekday } from "../../shared/utils/jalaliDate";

// ابعاد ثابت یک صفحه A4 در ۹۶dpi — تا خروجی html2canvas همیشه دقیقاً
// نسبت واقعی A4 را داشته باشد و در PDF بدون کش/برش قرار بگیرد.
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

const NAVY = "#111C33";
const ORANGE = "#E8791E";
const GREEN_TEXT = "#1B8A50";

interface DailyReportWorkersPageProps {
  id: string;
  date: string;
  projectName: string;
  supervisorName: string;
  supervisorNote: string;
  workers: DailyWorkerReport[];
  pageIndex: number;
  pageCount: number;
  showSummaryFooter: boolean;
  generatedAtLabel: string;
  grandTotals: {
    workersCount: number;
    totalUsefulMinutes: number;
    totalTimeLossMinutes: number;
    totalPayableSalary: number;
  };
}

/**
 * یک صفحهٔ کامل A4 از گزارش روزانه، مطابق نمونهٔ طراحی ارائه‌شده: هدر با لوگو،
 * ردیف اطلاعات پروژه/سرپرست، شبکهٔ ۲×۲ کارت نیرو (حداکثر ۴ نیرو در هر صفحه)،
 * یادداشت سرپرست و خلاصهٔ گزارش. این کامپوننت خارج از دید کاربر رندر می‌شود و
 * توسط exportElementsToPdf (هر صفحه = یک تصویر مستقل) به PDF تبدیل می‌شود،
 * بنابراین هیچ‌وقت وسط یک کارت نیرو برش نمی‌خورد.
 */
export function DailyReportWorkersPage({
  id,
  date,
  projectName,
  supervisorName,
  supervisorNote,
  workers,
  pageIndex,
  pageCount,
  showSummaryFooter,
  generatedAtLabel,
  grandTotals,
}: DailyReportWorkersPageProps) {
  const { t } = useTranslation();
  return (
    <Box
      id={id}
      sx={{
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        bgcolor: "#ffffff",
        color: "#1a1a1a",
        fontFamily: "Vazirmatn, IRANSans, Tahoma, sans-serif",
        direction: "rtl",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* هدر تیره */}
      <Box sx={{ bgcolor: NAVY, borderRadius: "0 0 22px 22px", px: "30px", pt: "24px", pb: "20px" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.3}>
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: "13px",
                bgcolor: "rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <HomeWorkIcon sx={{ color: "#fff", fontSize: 26 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 17, color: "#fff", lineHeight: 1.2 }}>
                {t("dailyReport.pdf.brandName")}
              </Typography>
              <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                {t("dailyReport.pdf.brandTagline")}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 19, color: "#fff", textAlign: "left" }}>
                {t("dailyReport.pdf.title")}
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", textAlign: "left", mt: 0.3 }}>
                {t("dailyReport.pdf.dateLine", { date: toJalaliWithWeekday(date) })}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                bgcolor: "rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CalendarMonthIcon sx={{ color: "#fff", fontSize: 20 }} />
            </Box>
          </Stack>
        </Stack>
      </Box>

      {/* ردیف اطلاعات پروژه/سرپرست */}
      {(projectName || supervisorName) && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-around"
          sx={{ mt: "16px", mx: "30px", py: "10px", borderBottom: "1px solid #eee" }}
        >
          {projectName && (
            <Stack direction="row" alignItems="center" spacing={0.8}>
              <ApartmentIcon sx={{ fontSize: 16, color: "#888" }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "#333" }}>
                {t("dailyReport.pdf.projectLine", { name: projectName })}
              </Typography>
            </Stack>
          )}
          {supervisorName && (
            <Stack direction="row" alignItems="center" spacing={0.8}>
              <PersonIcon sx={{ fontSize: 16, color: "#888" }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "#333" }}>
                {t("dailyReport.supervisorLine", { name: supervisorName })}
              </Typography>
            </Stack>
          )}
        </Stack>
      )}

      {/* شبکه ۲×۲ کارت نیرو */}
      <Box
        sx={{
          flex: 1,
          mt: "18px",
          px: "30px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: "16px",
          minHeight: 0,
        }}
      >
        {workers.map((w, i) => (
          <WorkerReportCard key={w.workerId} report={w} index={pageIndex * 4 + i + 1} />
        ))}
        {Array.from({ length: Math.max(0, 4 - workers.length) }).map((_, i) => (
          <Box key={`empty-${i}`} sx={{ border: "1.5px dashed #eee", borderRadius: "16px" }} />
        ))}
      </Box>

      {/* یادداشت سرپرست + خلاصه گزارش — فقط صفحه آخر */}
      {showSummaryFooter && (
        <Stack direction="row" spacing={2} sx={{ px: "30px", mt: "16px", mb: "16px" }}>
          <Box sx={{ flex: 1, border: "1px solid #eee", borderRadius: "14px", p: "14px 16px" }}>
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 1.3 }}>
              <InsertChartOutlinedIcon sx={{ fontSize: 15, color: "#888" }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#333" }}>{t("dailyReport.pdf.summaryTitle")}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Stack alignItems="center" spacing={0.4}>
                <GroupsIcon sx={{ fontSize: 17, color: NAVY }} />
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: NAVY }}>
                  {t("dailyReport.pdf.workersCountValue", { n: grandTotals.workersCount })}
                </Typography>
                <Typography sx={{ fontSize: 10, color: "#999" }}>{t("dailyReport.pdf.totalWorkers")}</Typography>
              </Stack>
              <Stack alignItems="center" spacing={0.4}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: GREEN_TEXT }}>
                  {formatMinutesToText(grandTotals.totalUsefulMinutes)}
                </Typography>
                <Typography sx={{ fontSize: 10, color: "#999" }}>{t("dailyReport.pdf.totalUseful")}</Typography>
              </Stack>
              <Stack alignItems="center" spacing={0.4}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#C25700" }}>
                  {formatMinutesToText(grandTotals.totalTimeLossMinutes)}
                </Typography>
                <Typography sx={{ fontSize: 10, color: "#999" }}>{t("dailyReport.pdf.totalLoss")}</Typography>
              </Stack>
              <Stack alignItems="center" spacing={0.4}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>
                  {formatCurrency(grandTotals.totalPayableSalary)}
                </Typography>
                <Typography sx={{ fontSize: 10, color: "#999" }}>{t("dailyReport.pdf.totalPay")}</Typography>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, border: "1px solid #eee", borderRadius: "14px", p: "14px 16px" }}>
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 1 }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 15, color: "#888" }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#333" }}>{t("dailyReport.pdf.noteTitle")}</Typography>
            </Stack>
            {supervisorNote ? (
              <Typography sx={{ fontSize: 12.5, whiteSpace: "pre-wrap", lineHeight: 1.9, color: "#444" }}>
                {supervisorNote}
              </Typography>
            ) : (
              <Stack spacing={1.1} sx={{ mt: 1 }}>
                <Box sx={{ borderBottom: "1px dotted #ddd", height: 1 }} />
                <Box sx={{ borderBottom: "1px dotted #ddd", height: 1 }} />
                <Box sx={{ borderBottom: "1px dotted #ddd", height: 1 }} />
              </Stack>
            )}
          </Box>
        </Stack>
      )}

      {/* فوتر */}
      <Box sx={{ bgcolor: NAVY, px: "30px", py: "12px", mt: showSummaryFooter ? 0 : "auto" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)" }}>
            {t("dailyReport.pdf.footerBrand")}
          </Typography>
          <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)" }}>
            {t("dailyReport.pdf.pageOf", { page: pageIndex + 1, total: pageCount })}
          </Typography>
          <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)" }}>
            {t("dailyReport.pdf.generatedAt", { time: generatedAtLabel })}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

function WorkerReportCard({ report, index }: { report: DailyWorkerReport; index: number }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        border: "1px solid #eee",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* هدر تیره کارت: بج شماره (راست) + نام/سمت */}
      <Box sx={{ bgcolor: NAVY, px: "14px", py: "10px" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              bgcolor: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: NAVY }}>
              {String(index).padStart(2, "0")}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#fff" }} noWrap>
              {report.workerFullName}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)" }} noWrap>
              {report.position}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* بدنه سفید: ردیف‌های اطلاعات — محتوای حضور/غیاب عمداً از این گزارش حذف شده
          (تکراری با صفحهٔ حضور و غیاب بود)؛ فقط خلاصهٔ کار/دستمزد نمایش داده می‌شود. */}
      <Box sx={{ p: "10px 14px", flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
        <InfoRow
          icon={<FiberManualRecordIcon sx={{ fontSize: 9, color: "#ED6C02" }} />}
          label={t("dailyReport.timeLoss")}
          value={formatMinutesToText(report.totalTimeLossMinutes)}
          valueColor="#ED6C02"
        />
        <InfoRow
          icon={<FiberManualRecordIcon sx={{ fontSize: 9, color: "#0288D1" }} />}
          label={t("dailyReport.allowedBreak")}
          value={formatMinutesToText(report.totalBreakMinutes)}
          valueColor="#0288D1"
        />
        <InfoRow
          icon={<FiberManualRecordIcon sx={{ fontSize: 9, color: "#2E7D32" }} />}
          label={t("dailyReport.usefulTime")}
          value={formatMinutesToText(report.usefulMinutes)}
          valueColor="#2E7D32"
          bold
        />
      </Box>

      {/* حقوق نهایی */}
      <Box sx={{ px: "14px", py: "9px", borderTop: "1px dashed #eee" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: ORANGE }}>
            {formatCurrency(report.payableSalary)}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.6}>
            <Typography sx={{ fontSize: 11, color: "#888" }}>{t("dailyReport.finalSalary")}</Typography>
            <AccountBalanceWalletIcon sx={{ fontSize: 14, color: "#888" }} />
          </Stack>
        </Stack>
        {report.guardDuty.enabled && report.guardDuty.payableSalary > 0 && (
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.3 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#7B4FA0" }}>
              {formatCurrency(report.guardDuty.payableSalary)}
            </Typography>
            <Typography sx={{ fontSize: 10, color: "#7B4FA0" }}>{t("dailyReport.pdf.guardPlus")}</Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
  bold,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography sx={{ fontSize: 12, fontWeight: bold ? 800 : 600, color: valueColor || "#222" }}>
        {value}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.6}>
        <Typography sx={{ fontSize: 11, color: "#999" }}>{label}</Typography>
        <Box sx={{ color: "#aaa", display: "flex" }}>{icon}</Box>
      </Stack>
    </Stack>
  );
}

export { A4_WIDTH_PX, A4_HEIGHT_PX };
