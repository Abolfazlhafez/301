import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import PaymentsIcon from "@mui/icons-material/Payments";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import TimerOffIcon from "@mui/icons-material/TimerOff";
import ShareIcon from "@mui/icons-material/Share";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { Capacitor } from "@capacitor/core";
import { dashboardApi, reportsApi } from "../../shared/api/dashboardApi";
import { backupService } from "../../core/services/backupService";
import { WeeklyTrendChart } from "../../widgets/charts/WeeklyTrendChart";
import { StatCard } from "../../shared/components/StatCard";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { formatCurrency, formatMinutesToText } from "../../shared/utils/format";
import { extractErrorMessage } from "../../shared/api/client";
import { getTodayIso, toJalaliDisplay } from "../../shared/utils/jalaliDate";
import { buildDailySummaryText } from "../../shared/utils/dailySummaryText";
import { RecentActivity } from "../../entities/Report";
import { UpcomingActivitiesCard } from "../../widgets/dashboard/UpcomingActivitiesCard";
import { TodayWorkLogCard } from "../../widgets/dashboard/TodayWorkLogCard";
import { ProjectFloorsCard } from "../../widgets/dashboard/ProjectFloorsCard";
import { useToast } from "../../shared/components/ToastProvider";
import { photosApi } from "../../shared/api/photosApi";
import { workLogNoteApi } from "../../shared/api/workLogNoteApi";
import { useLanguage } from "../../shared/hooks/useLanguage";

function activityIcon(type: RecentActivity["type"]) {
  switch (type) {
    case "attendance_checkin":
      return <LoginIcon fontSize="small" />;
    case "attendance_checkout":
      return <LogoutIcon fontSize="small" />;
    case "timeloss":
      return <TimerOffIcon fontSize="small" />;
    default:
      return <AccessTimeIcon fontSize="small" />;
  }
}

function activityColor(type: RecentActivity["type"]): string {
  switch (type) {
    case "attendance_checkin":
      return "#2E7D32";
    case "attendance_checkout":
      return "#455A64";
    case "timeloss":
      return "#ED6C02";
    default:
      return "#757575";
  }
}

// میان‌برهای دسترسی سریع به سه اقدام روزمرهٔ اصلی سرپرست — مستقیماً از
// داشبورد، بدون نیاز به رفتن به تب پایین و سپس انتخاب زیرتب مربوطه. مقصد هر
// کدام همان صفحه‌ی موجود با پارامتر ?tab= است (نه صفحهٔ جدید)، چون منطق
// واقعی هرکدام (فرم‌ها، اعتبارسنجی و...) از قبل در همان‌جا وجود دارد.
function useQuickActions() {
  const { t } = useTranslation();
  return [
    { label: t("dashboard.quickActions.workLog"), to: "/activities?tab=work-log", icon: <AssignmentTurnedInIcon fontSize="small" /> },
    // «حضور و غیاب» حالا نمای داخلی زیرتب «نیروها» است (?view=attendance).
    { label: t("dashboard.quickActions.attendance"), to: "/resources?tab=workers&view=attendance", icon: <HowToRegIcon fontSize="small" /> },
    { label: t("dashboard.quickActions.addTransaction"), to: "/reports?tab=cashbook", icon: <ReceiptLongIcon fontSize="small" /> },
  ];
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { currency } = useLanguage();
  const QUICK_ACTIONS = useQuickActions();
  const today = getTodayIso();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isBackingUp, setIsBackingUp] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard-summary", today],
    queryFn: () => dashboardApi.getSummary(today),
  });

  const { data: trend } = useQuery({
    queryKey: ["weekly-trend"],
    queryFn: () => reportsApi.weeklyTrend(7),
  });

  // وضعیت «گزارش کار» امروز (تعداد عکس + توضیحات) هم برای کارت گزارش کار
  // در داشبورد لازم است و هم برای این‌که متن اشتراک‌گذاری سریع، سرپرست را
  // از وجود/عدم‌وجود گزارش کار امروز مطلع کند — بدون نیاز به باز کردن
  // جداگانهٔ صفحهٔ «گزارش کار».
  const { data: todayPhotos } = useQuery({
    queryKey: ["photos", "site", "day", today],
    queryFn: () => photosApi.list({ relatedType: "site", from: today, to: today }),
  });

  const { data: todayWorkLogNote } = useQuery({
    queryKey: ["work-log-note", today],
    queryFn: () => workLogNoteApi.getByDate(today),
  });

  // خلاصهٔ متنی امروز را یا از طریق منوی اشتراک‌گذاری بومی گوشی (اگر
  // پشتیبانی شود) یا در غیر این‌صورت با کپی به کلیپ‌بورد در اختیار سرپرست
  // می‌گذارد؛ برای ارسال سریع وضعیت روز به کارفرما/پیمانکار بدون نیاز به
  // باز کردن گزارش کامل.
  async function handleShareSummary() {
    if (!data) return;
    const text = buildDailySummaryText(today, data, {
      workLogPhotosCount: todayPhotos?.length ?? 0,
      workLogDescription: todayWorkLogNote?.description ?? null,
    });

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // کاربر منوی اشتراک‌گذاری را لغو کرده یا خطایی رخ داده؛ نیازی به
        // پیام خطا نیست (لغو کردن یک رفتار عادی کاربر است).
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast(t("dashboard.shareCopied"), "success");
    } catch {
      showToast(t("dashboard.shareCopyUnsupported"), "error");
    }
  }

  // پشتیبان‌گیری سریع مستقیماً از داشبورد — همان قابلیت کامل «پشتیبان‌گیری و
  // بازیابی» که در تنظیمات هم هست، اینجا فقط برای دسترسی سریع‌تر (بدون نیاز
  // به رفتن به تنظیمات) در دسترس قرار می‌گیرد؛ منطق واقعی در backupService
  // مشترک است، نه تکرارشده.
  async function handleQuickBackup() {
    try {
      setIsBackingUp(true);
      await backupService.exportAndShare();
      showToast(
        Capacitor.isNativePlatform() ? t("dashboard.backupReadyNative") : t("dashboard.backupReadyWeb"),
        "success"
      );
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setIsBackingUp(false);
    }
  }

  return (
    <Box display="flex" flexDirection="column" gap={2.5}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t("dashboard.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {toJalaliDisplay(today)}
          </Typography>
        </Box>
        {data && (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={t("dashboard.quickBackup") as string}>
              <IconButton
                onClick={handleQuickBackup}
                color="primary"
                disabled={isBackingUp}
                aria-label={t("dashboard.quickBackup") as string}
              >
                {isBackingUp ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={t("dashboard.shareSummary") as string}>
              <IconButton onClick={handleShareSummary} color="primary" aria-label={t("dashboard.shareSummary") as string}>
                <ShareIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>

      {/* میان‌برهای سریع — سه اقدام روزمرهٔ پرتکرار سرپرست، یک ضربه با فاصله
          تا فرم مربوطه (به‌جای نویگیشن پایین + انتخاب زیرتب). */}
      <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
        {QUICK_ACTIONS.map((action) => (
          <Paper
            key={action.to}
            component="button"
            onClick={() => navigate(action.to)}
            elevation={0}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              flexShrink: 0,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 999,
              px: 1.5,
              py: 0.75,
              bgcolor: "background.paper",
              color: "primary.main",
              cursor: "pointer",
              transition: "transform 120ms ease-out, background-color 150ms ease-out",
              "&:active": { transform: "scale(0.96)", bgcolor: "action.selected" },
            }}
          >
            {action.icon}
            <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ whiteSpace: "nowrap" }}>
              {action.label}
            </Typography>
          </Paper>
        ))}
      </Stack>

      {isLoading && <LoadingState message={t("dashboard.loading") as string} />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {data && (
        <>
          <Grid
            container
            spacing={1.5}
            sx={{
              "@keyframes karegahyar-stagger-in": {
                from: { opacity: 0, transform: "translateY(10px)" },
                to: { opacity: 1, transform: "translateY(0)" },
              },
              "& > .MuiGrid-item": {
                animation: "karegahyar-stagger-in 320ms ease-out both",
              },
              "& > .MuiGrid-item:nth-of-type(1)": { animationDelay: "0ms" },
              "& > .MuiGrid-item:nth-of-type(2)": { animationDelay: "40ms" },
              "& > .MuiGrid-item:nth-of-type(3)": { animationDelay: "80ms" },
              "& > .MuiGrid-item:nth-of-type(4)": { animationDelay: "120ms" },
              "& > .MuiGrid-item:nth-of-type(5)": { animationDelay: "160ms" },
            }}
          >
            <Grid item xs={6}>
              <StatCard
                title={t("dashboard.stats.presentWorkers")}
                value={`${data.presentWorkersCount} ${t("dashboard.stats.personUnit")}`}
                icon={<PeopleAltIcon />}
                color="#2E7D32"
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                title={t("dashboard.stats.absentWorkers")}
                value={
                  data.onLeaveWorkersCount > 0
                    ? `${data.absentWorkersCount} ${t("dashboard.stats.personUnit")} (+${data.onLeaveWorkersCount} ${t("dashboard.stats.onLeaveSuffix")})`
                    : `${data.absentWorkersCount} ${t("dashboard.stats.personUnit")}`
                }
                icon={<PersonOffIcon />}
                color="#D32F2F"
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                title={t("dashboard.stats.totalHoursToday")}
                value={formatMinutesToText(data.totalWorkedMinutesToday)}
                icon={<AccessTimeIcon />}
                color="#0288D1"
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                title={t("dashboard.stats.totalTimeLossToday")}
                value={formatMinutesToText(data.totalTimeLossMinutesToday)}
                icon={<HourglassBottomIcon />}
                color="#ED6C02"
              />
            </Grid>
            <Grid item xs={12}>
              <StatCard
                title={t("dashboard.stats.todaySalary")}
                value={formatCurrency(data.totalPayableSalaryToday, currency)}
                icon={<PaymentsIcon />}
                color="#EA6A00"
              />
            </Grid>
          </Grid>

          {trend && trend.some((day) => day.totalUsefulMinutes > 0) && <WeeklyTrendChart data={trend} />}

          <UpcomingActivitiesCard />

          <ProjectFloorsCard />

          <TodayWorkLogCard />

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              {t("dashboard.recentActivities")}
            </Typography>

            {data.recentActivities.length === 0 ? (
              <EmptyState title={t("dashboard.noActivitiesYet") as string} />
            ) : (
              <List
                disablePadding
                sx={{
                  "@keyframes karegahyar-activity-in": {
                    from: { opacity: 0, transform: "translateX(8px)" },
                    to: { opacity: 1, transform: "translateX(0)" },
                  },
                }}
              >
                {data.recentActivities.map((activity, index) => (
                  <ListItem
                    key={activity.id}
                    disableGutters
                    sx={{
                      py: 1,
                      animation: "karegahyar-activity-in 260ms ease-out both",
                      animationDelay: `${Math.min(index, 8) * 40}ms`,
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          bgcolor: `${activityColor(activity.type)}22`,
                          color: activityColor(activity.type),
                          width: 38,
                          height: 38,
                        }}
                      >
                        {activityIcon(activity.type)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={activity.workerFullName}
                      secondary={activity.description}
                      primaryTypographyProps={{ fontWeight: 600, variant: "body2" }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>

          {data.totalActiveWorkersCount === 0 && (
            <Alert severity="info" variant="outlined">
              {t("dashboard.noWorkersAlert")}
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}
