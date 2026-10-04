import { ReactNode, useEffect, useState } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import { WorkersPage } from "./WorkersPage";
import { BulkAttendanceSheet } from "../../widgets/attendance-form/BulkAttendanceSheet";
import { AttendancePage } from "../attendance/AttendancePage";
import { MonthlyPayrollSummarySection } from "../reports/MonthlyPayrollSummarySection";
import { resolveTeamView, TeamView } from "../resources/resourcesPageTabs";
import { workersApi } from "../../shared/api/workersApi";
import { attendanceApi } from "../../shared/api/attendanceApi";
import { projectsApi } from "../../shared/api/projectsApi";
import { getTodayIso, toJalaliWithWeekday } from "../../shared/utils/jalaliDate";
import { formatNumber } from "../../shared/utils/format";

interface ViewDef {
  value: TeamView;
  labelKey: string;
  icon: ReactNode;
  activeIcon: ReactNode;
}

const VIEWS: ViewDef[] = [
  { value: "list", labelKey: "team.views.list", icon: <GroupsOutlinedIcon />, activeIcon: <GroupsRoundedIcon /> },
  { value: "attendance", labelKey: "team.views.attendance", icon: <HowToRegOutlinedIcon />, activeIcon: <HowToRegRoundedIcon /> },
  { value: "payroll", labelKey: "team.views.payroll", icon: <PaymentsOutlinedIcon />, activeIcon: <PaymentsRoundedIcon /> },
];

interface MiniStatProps {
  label: string;
  value: string;
  tone: "primary" | "success" | "warning";
  onClick?: () => void;
}

/** یک کاشی آمار نرم داخل کارت وضعیت امروز؛ با لمس، به نمای مربوط می‌رود. */
function MiniStat({ label, value, tone, onClick }: MiniStatProps) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={!onClick}
      sx={(theme) => ({
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 0.25,
        px: 1.5,
        py: 1.1,
        borderRadius: "16px",
        textAlign: "start",
        bgcolor: alpha(theme.palette[tone].main, theme.palette.mode === "dark" ? 0.14 : 0.1),
        transition: "transform 120ms ease-out, background-color 150ms ease-out",
        "&:active": { transform: onClick ? "scale(0.97)" : "none" },
      })}
    >
      <Typography
        sx={(theme) => ({ fontSize: "1.25rem", fontWeight: 800, lineHeight: 1.1, color: theme.palette[tone].main })}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: "100%", fontWeight: 600 }}>
        {label}
      </Typography>
    </ButtonBase>
  );
}

/**
 * هستهٔ یکپارچهٔ زیرتب «نیروها»: فهرست نیروها، حضور و غیاب و حقوق در یک
 * صفحه، با یک کارت «وضعیت امروز» و یک سوییچ نرم سه‌حالته.
 *
 * هر نما فقط بار اول که باز می‌شود mount می‌شود و بعد با display:none نگه
 * داشته می‌شود تا جستجو/فیلتر/اسکرول و بازهٔ تاریخ هر نما هنگام برگشت حفظ شود.
 */
export function TeamHub() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const viewParam = searchParams.get("view");
  const [view, setView] = useState<TeamView>(resolveTeamView(tabParam, viewParam));
  const [visited, setVisited] = useState<Set<TeamView>>(() => new Set([resolveTeamView(tabParam, viewParam)]));
  const today = getTodayIso();

  // شیت «حضور گروهی» اینجا زندگی می‌کند (پدر مشترک WorkersPage، AttendancePage و کاشی «ثبت‌نشده»)
  // تا یک نمونه و یک مسیر ثبت داشته باشیم؛ هر سه فقط یک callback ساده می‌گیرند.
  const [bulkSheet, setBulkSheet] = useState<{ date: string; preselect: string[] } | null>(null);

  useEffect(() => {
    // فقط وقتی پارامتر URL واقعاً چیزی می‌گوید (مثلاً لینک از داشبورد) هم‌گام شو؛
    // در نبود پارامتر، انتخاب فعلی کاربر دست‌نخورده می‌ماند.
    if (!viewParam && !(tabParam === "attendance" || tabParam === "payroll")) return;
    const next = resolveTeamView(tabParam, viewParam);
    setView(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }, [tabParam, viewParam]);

  function selectView(next: TeamView) {
    setView(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }

  const { data: activeProjectId } = useQuery({
    queryKey: ["projects", "active"],
    queryFn: () => projectsApi.getActiveProjectId(),
  });

  // کلید کوئری عمداً همان کلید WorkersPage است تا یک بار واکشی شود و کش مشترک بماند.
  const { data: workers } = useQuery({
    queryKey: ["workers", activeProjectId],
    queryFn: () => workersApi.list({ projectId: activeProjectId }),
    enabled: !!activeProjectId,
  });

  const { data: todayAttendance } = useQuery({
    queryKey: ["attendance", "team-today", activeProjectId, today],
    queryFn: () => attendanceApi.list({ date: today }),
    enabled: !!activeProjectId,
  });

  const activeWorkers = (workers ?? []).filter((w) => w.isActive);
  const activeIds = new Set(activeWorkers.map((w) => w.id));
  const presentIds = new Set(
    (todayAttendance ?? []).filter((a) => !!a.checkIn && activeIds.has(a.workerId)).map((a) => a.workerId)
  );
  const presentCount = presentIds.size;
  const pendingCount = Math.max(activeWorkers.length - presentCount, 0);
  const statsReady = !!workers && !!todayAttendance;
  const fmt = (n: number) => formatNumber(n, i18n.language);
  const pendingWorkerIds = activeWorkers.filter((w) => !presentIds.has(w.id)).map((w) => w.id);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {/* کارت «وضعیت امروز» — نرم، با رنگ‌مایهٔ ملایم برند */}
      <Box
        sx={(theme) => ({
          borderRadius: "24px",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          background:
            theme.palette.mode === "dark"
              ? `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`
              : `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.14)}`,
        })}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={800} lineHeight={1.3}>
            {t("team.hero.title")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {toJalaliWithWeekday(today)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <MiniStat
            tone="primary"
            label={t("team.hero.activeWorkers")}
            value={statsReady ? fmt(activeWorkers.length) : "—"}
            onClick={() => selectView("list")}
          />
          <MiniStat
            tone="success"
            label={t("team.hero.presentToday")}
            value={statsReady ? fmt(presentCount) : "—"}
            onClick={() => selectView("attendance")}
          />
          <MiniStat
            tone="warning"
            label={t("team.hero.pendingToday")}
            value={statsReady ? fmt(pendingCount) : "—"}
            onClick={statsReady ? () => setBulkSheet({ date: today, preselect: pendingWorkerIds }) : undefined}
          />
        </Box>
      </Box>

      {/* سوییچ نرم سه‌حالته */}
      <Box
        role="tablist"
        aria-label={t("team.switchAria") as string}
        sx={(theme) => ({
          display: "flex",
          gap: 0.5,
          p: 0.5,
          borderRadius: "20px",
          bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(17,19,24,0.045)",
        })}
      >
        {VIEWS.map((def) => {
          const active = def.value === view;
          return (
            <ButtonBase
              key={def.value}
              role="tab"
              aria-selected={active}
              onClick={() => selectView(def.value)}
              sx={(theme) => ({
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.75,
                py: 1,
                px: 1,
                borderRadius: "16px",
                fontWeight: active ? 800 : 600,
                fontSize: "0.82rem",
                color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                bgcolor: active ? theme.palette.background.paper : "transparent",
                boxShadow: active
                  ? theme.palette.mode === "dark"
                    ? "0 2px 10px rgba(0,0,0,0.35)"
                    : "0 2px 10px rgba(17,19,24,0.08)"
                  : "none",
                transition: "background-color 180ms ease-out, color 180ms ease-out, box-shadow 180ms ease-out, transform 120ms ease-out",
                "&:active": { transform: "scale(0.97)" },
                "& svg": { fontSize: 20, flexShrink: 0 },
              })}
            >
              {active ? def.activeIcon : def.icon}
              <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {t(def.labelKey)}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>

      <Box sx={{ display: view === "list" ? "block" : "none" }}>
        {visited.has("list") && (
          <WorkersPage embedded onOpenBulkAttendance={() => setBulkSheet({ date: today, preselect: [] })} />
        )}
      </Box>
      <Box sx={{ display: view === "attendance" ? "block" : "none" }}>
        {visited.has("attendance") && (
          <AttendancePage
            embedded
            onOpenBulkAttendance={(date, preselect) => setBulkSheet({ date, preselect })}
          />
        )}
      </Box>
      <Box sx={{ display: view === "payroll" ? "block" : "none" }}>
        {visited.has("payroll") && <MonthlyPayrollSummarySection />}
      </Box>

      <BulkAttendanceSheet
        open={!!bulkSheet}
        onClose={() => setBulkSheet(null)}
        initialDate={bulkSheet?.date}
        preselectWorkerIds={bulkSheet?.preselect}
      />
    </Box>
  );
}
