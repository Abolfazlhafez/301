import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Chip, IconButton, Menu, MenuItem, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import TodayIcon from "@mui/icons-material/Today";
import TuneIcon from "@mui/icons-material/Tune";
import CheckIcon from "@mui/icons-material/Check";
import { format } from "date-fns-jalali";
import { futureActivitiesApi } from "../../shared/api/futureActivitiesApi";
import { workersApi } from "../../shared/api/workersApi";
import { EmptyState } from "../../shared/components/EmptyState";
import { WorkerAvatar } from "../worker-form/WorkerAvatar";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import type { ActivityPriority, FutureActivity } from "../../entities/FutureActivity";
import type { Worker } from "../../entities/Worker";
import {
  addDaysIso,
  addJalaliMonthsIso,
  daysBetweenIso,
  getMonthDatesIso,
  getTodayIso,
  getWeekDatesIso,
} from "../../shared/utils/jalaliDate";

type GanttPeriod = "week" | "month";
type GroupBy = "worker" | "activity" | "priority";

const PRIORITY_COLORS: Record<ActivityPriority, string> = {
  low: "#4C9A73",
  medium: "#D69A2D",
  high: "#D14343",
};

const PRIORITY_LABELS: Record<ActivityPriority, string> = {
  low: "اولویت کم",
  medium: "اولویت متوسط",
  high: "اولویت زیاد",
};

const ROW_HEIGHT = 40;
const LANE_GAP = 4;
const LABEL_COL_WIDTH = 96;
const MONTH_DAY_COL_PX = 34;

interface GanttRow {
  key: string;
  label: string;
  avatarWorker?: Worker | null;
  colorDot?: string;
  laneCount: number;
  bars: { activity: FutureActivity; lane: number; startOffset: number; endOffset: number }[];
}

/** بسته‌بندی سادهٔ فعالیت‌های هم‌پوشان یک ردیف در «خط»های جداگانه، تا دو فعالیت هم‌زمان روی هم نیفتند (مثل نمای منابع MS Project). */
function packLanes(items: FutureActivity[], periodStart: string, periodEnd: string) {
  const withOffsets = items
    .map((a) => {
      const start = a.date;
      const end = a.endDate || a.date;
      const startOffset = Math.max(0, daysBetweenIso(periodStart, start));
      const endOffset = Math.min(daysBetweenIso(periodStart, periodEnd), daysBetweenIso(periodStart, end));
      return { activity: a, startOffset, endOffset };
    })
    .filter((x) => x.endOffset >= 0 && x.startOffset <= daysBetweenIso(periodStart, periodEnd))
    .sort((a, b) => a.startOffset - b.startOffset);

  const laneEnds: number[] = [];
  const bars: GanttRow["bars"] = [];
  for (const item of withOffsets) {
    let lane = laneEnds.findIndex((end) => end < item.startOffset);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endOffset);
    } else {
      laneEnds[lane] = item.endOffset;
    }
    bars.push({ activity: item.activity, lane, startOffset: item.startOffset, endOffset: item.endOffset });
  }
  return { bars, laneCount: Math.max(1, laneEnds.length) };
}

export function ActivityGanttView() {
  const theme = useTheme();
  // قبلاً این دو آیکون بدون توجه به جهت زبان هاردکد شده بودند (فقط برای
  // RTL درست بودند)؛ حالا مثل الگوی FloorNotebookPage/ProjectFloorsCard
  // بر اساس theme.direction انتخاب می‌شوند تا در زبان‌های LTR هم جهت
  // بصری درست (بعدی → راست، قبلی → چپ) باشد.
  const NextPeriodIcon = theme.direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;
  const PrevPeriodIcon = theme.direction === "rtl" ? ChevronRightIcon : ChevronLeftIcon;
  const [period, setPeriod] = useState<GanttPeriod>("week");
  const [groupBy, setGroupBy] = useState<GroupBy>("worker");
  const [referenceDate, setReferenceDate] = useState(getTodayIso());
  const [groupMenuAnchor, setGroupMenuAnchor] = useState<HTMLElement | null>(null);
  const [editingActivity, setEditingActivity] = useState<FutureActivity | null>(null);

  const { data: allActivities, isLoading } = useQuery({
    queryKey: ["future-activities", "gantt-all"],
    queryFn: () => futureActivitiesApi.listAll({ scope: "all", includeCompleted: true }),
  });

  const { data: workers } = useQuery({
    queryKey: ["workers", { isActive: true }],
    queryFn: () => workersApi.list({ isActive: true }),
  });

  const workersById = useMemo(() => {
    const map = new Map<string, Worker>();
    (workers ?? []).forEach((w) => map.set(w.id, w));
    return map;
  }, [workers]);

  const days = useMemo(
    () => (period === "week" ? getWeekDatesIso(referenceDate) : getMonthDatesIso(referenceDate)),
    [period, referenceDate]
  );
  const periodStart = days[0];
  const periodEnd = days[days.length - 1];
  const today = getTodayIso();
  const todayOffset = daysBetweenIso(periodStart, today);
  const showTodayLine = todayOffset >= 0 && todayOffset <= days.length - 1;

  const periodLabel = useMemo(() => {
    if (period === "month") return format(new Date(referenceDate), "MMMM yyyy");
    return `${format(new Date(periodStart), "d")} تا ${format(new Date(periodEnd), "d MMMM yyyy")}`;
  }, [period, referenceDate, periodStart, periodEnd]);

  const rows: GanttRow[] = useMemo(() => {
    const activities = (allActivities ?? []).filter((a) => {
      const end = a.endDate || a.date;
      return end >= periodStart && a.date <= periodEnd;
    });

    if (groupBy === "activity") {
      return activities
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((a) => {
          const { bars, laneCount } = packLanes([a], periodStart, periodEnd);
          return {
            key: a.id,
            label: a.title,
            colorDot: PRIORITY_COLORS[a.priority],
            laneCount,
            bars,
          };
        });
    }

    if (groupBy === "priority") {
      const order: ActivityPriority[] = ["high", "medium", "low"];
      return order
        .map((p): GanttRow | null => {
          const items = activities.filter((a) => a.priority === p);
          if (items.length === 0) return null;
          const { bars, laneCount } = packLanes(items, periodStart, periodEnd);
          return { key: p as string, label: PRIORITY_LABELS[p], colorDot: PRIORITY_COLORS[p], laneCount, bars };
        })
        .filter((r): r is GanttRow => r !== null);
    }

    // groupBy === "worker"
    const byWorker = new Map<string, FutureActivity[]>();
    for (const a of activities) {
      const key = a.workerId ?? "__none__";
      if (!byWorker.has(key)) byWorker.set(key, []);
      byWorker.get(key)!.push(a);
    }
    return Array.from(byWorker.entries())
      .sort(([keyA], [keyB]) => {
        if (keyA === "__none__") return 1;
        if (keyB === "__none__") return -1;
        return 0;
      })
      .map(([key, items]) => {
        const { bars, laneCount } = packLanes(items, periodStart, periodEnd);
        const worker = key === "__none__" ? null : workersById.get(key) ?? null;
        return {
          key,
          label: key === "__none__" ? "عمومی" : worker ? `${worker.firstName} ${worker.lastName}` : "—",
          avatarWorker: worker,
          laneCount,
          bars,
        };
      });
  }, [allActivities, groupBy, periodStart, periodEnd, workersById]);

  function goPrev() {
    setReferenceDate((d) => (period === "week" ? addDaysIso(d, -7) : addJalaliMonthsIso(d, -1)));
  }
  function goNext() {
    setReferenceDate((d) => (period === "week" ? addDaysIso(d, 7) : addJalaliMonthsIso(d, 1)));
  }
  function goToday() {
    setReferenceDate(getTodayIso());
  }

  const dayColWidth = period === "week" ? undefined : MONTH_DAY_COL_PX;
  const timelineMinWidth = period === "month" ? days.length * MONTH_DAY_COL_PX : undefined;

  return (
    <Box display="flex" flexDirection="column" gap={1.5}>
      {/* نوار ناوبری بالا: عنوان بازه + دکمه‌های جابه‌جایی + سوییچ هفته/ماه + منوی گروه‌بندی */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Stack direction="row" alignItems="center" spacing={0.25}>
          <IconButton
            size="small"
            onClick={goNext}
            aria-label="بعدی"
            sx={{ transition: "transform 120ms ease-out", "&:active": { transform: "scale(0.85)" } }}
          >
            <NextPeriodIcon fontSize="small" />
          </IconButton>
          <Typography
            key={periodLabel}
            variant="body2"
            fontWeight={700}
            sx={{
              minWidth: 96,
              textAlign: "center",
              animation: "karegahyar-period-label-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              "@keyframes karegahyar-period-label-in": {
                from: { opacity: 0, transform: "translateY(-4px)" },
                to: { opacity: 1, transform: "translateY(0)" },
              },
            }}
          >
            {periodLabel}
          </Typography>
          <IconButton
            size="small"
            onClick={goPrev}
            aria-label="قبلی"
            sx={{ transition: "transform 120ms ease-out", "&:active": { transform: "scale(0.85)" } }}
          >
            <PrevPeriodIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={goToday}
            aria-label="امروز"
            sx={{ transition: "transform 120ms ease-out", "&:active": { transform: "scale(0.85)" } }}
          >
            <TodayIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          <ToggleButtonGroup
            value={period}
            exclusive
            size="small"
            onChange={(_, v) => v && setPeriod(v)}
          >
            <ToggleButton value="week" sx={{ px: 1.5, py: 0.25 }}>
              هفتگی
            </ToggleButton>
            <ToggleButton value="month" sx={{ px: 1.5, py: 0.25 }}>
              ماهانه
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton
            size="small"
            onClick={(e) => setGroupMenuAnchor(e.currentTarget)}
            aria-label="گروه‌بندی"
            sx={{ bgcolor: "action.selected", borderRadius: 999 }}
          >
            <TuneIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={groupMenuAnchor} open={!!groupMenuAnchor} onClose={() => setGroupMenuAnchor(null)}>
            {(
              [
                ["worker", "گروه‌بندی بر اساس نیرو"],
                ["activity", "گروه‌بندی بر اساس فعالیت"],
                ["priority", "گروه‌بندی بر اساس اولویت"],
              ] as [GroupBy, string][]
            ).map(([value, label]) => (
              <MenuItem
                key={value}
                onClick={() => {
                  setGroupBy(value);
                  setGroupMenuAnchor(null);
                }}
              >
                {groupBy === value && <CheckIcon fontSize="small" sx={{ ml: 1 }} />}
                {label}
              </MenuItem>
            ))}
          </Menu>
        </Stack>
      </Stack>

      {isLoading ? (
        <Stack spacing={1}>
          {[0, 1, 2, 3].map((i) => (
            <Box
              key={i}
              sx={{
                height: 40,
                borderRadius: 1.5,
                bgcolor: "action.hover",
                animation: "karegahyar-skeleton-pulse 1.1s ease-in-out infinite",
                animationDelay: `${i * 90}ms`,
                "@keyframes karegahyar-skeleton-pulse": {
                  "0%, 100%": { opacity: 0.5 },
                  "50%": { opacity: 1 },
                },
              }}
            />
          ))}
        </Stack>
      ) : rows.length === 0 ? (
        <Box
          sx={{
            animation: "karegahyar-empty-fade-in 260ms ease-out",
            "@keyframes karegahyar-empty-fade-in": {
              from: { opacity: 0, transform: "translateY(4px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <EmptyState
            icon={<EventAvailableIcon fontSize="inherit" />}
            title="فعالیتی در این بازه نیست"
            description="با دکمهٔ افزودن، یک فعالیت برای این بازه ثبت کنید یا بازهٔ زمانی را عوض کنید."
          />
        </Box>
      ) : (
        <Stack
          direction="row"
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "background.paper",
          }}
        >
          {/* ستون برچسب — ثابت، بیرون از اسکرول افقی */}
          <Box sx={{ width: LABEL_COL_WIDTH, flexShrink: 0, borderInlineStart: "1px solid", borderColor: "divider" }}>
            <Box sx={{ height: 32, borderBottom: "1px solid", borderColor: "divider" }} />
            {rows.map((row, idx) => (
              <Box
                key={`${period}-${groupBy}-${row.key}`}
                sx={{
                  height: row.laneCount * ROW_HEIGHT + (row.laneCount - 1) * LANE_GAP + 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  transition: "height 260ms cubic-bezier(0.4, 0, 0.2, 1)",
                  animation: "karegahyar-row-slide-in 240ms ease-out both",
                  animationDelay: `${Math.min(idx, 8) * 35}ms`,
                  "@keyframes karegahyar-row-slide-in": {
                    from: { opacity: 0, transform: "translateX(6px)" },
                    to: { opacity: 1, transform: "translateX(0)" },
                  },
                }}
              >
                {row.avatarWorker !== undefined &&
                  (row.avatarWorker ? (
                    <WorkerAvatar
                      avatarPhotoId={row.avatarWorker.avatarPhotoId}
                      initials={`${row.avatarWorker.firstName.charAt(0)}${row.avatarWorker.lastName.charAt(0)}`}
                      size={20}
                    />
                  ) : null)}
                {row.colorDot && (
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: row.colorDot, flexShrink: 0 }} />
                )}
                <Typography variant="caption" fontWeight={600} noWrap title={row.label}>
                  {row.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* بخش جدول زمانی — قابل اسکرول افقی در نمای ماهانه */}
          <Box sx={{ flex: 1, overflowX: period === "month" ? "auto" : "hidden", position: "relative" }}>
            <Box sx={{ minWidth: timelineMinWidth ?? "100%", position: "relative" }}>
              {/* هدر روزها */}
              <Box
                sx={{
                  height: 32,
                  display: "grid",
                  gridTemplateColumns: dayColWidth
                    ? `repeat(${days.length}, ${dayColWidth}px)`
                    : `repeat(${days.length}, 1fr)`,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                {days.map((d) => {
                  const isFriday = format(new Date(d), "EEEE") === "جمعه";
                  const isToday = d === today;
                  return (
                    <Box
                      key={d}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: isToday ? "primary.main" : isFriday ? "action.hover" : "transparent",
                        color: isToday ? "primary.contrastText" : "text.secondary",
                        borderInlineStart: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      {period === "week" && (
                        <Typography variant="caption" sx={{ fontSize: 10, lineHeight: 1 }}>
                          {format(new Date(d), "EEEE").slice(0, 1)}
                        </Typography>
                      )}
                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, lineHeight: 1 }}>
                        {format(new Date(d), "d")}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* ردیف‌ها + نوارهای فعالیت */}
              {rows.map((row, idx) => {
                const rowHeight = row.laneCount * ROW_HEIGHT + (row.laneCount - 1) * LANE_GAP + 8;
                return (
                  <Box
                    key={`${period}-${groupBy}-${row.key}`}
                    sx={{
                      position: "relative",
                      height: rowHeight,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      transition: "height 260ms cubic-bezier(0.4, 0, 0.2, 1)",
                      animation: "karegahyar-row-fade-in 240ms ease-out both",
                      animationDelay: `${Math.min(idx, 8) * 35}ms`,
                      "@keyframes karegahyar-row-fade-in": {
                        from: { opacity: 0 },
                        to: { opacity: 1 },
                      },
                      // خطوط عمودی ملایم جداکنندهٔ روزها، پشت نوارها
                      backgroundImage: `repeating-linear-gradient(to left, transparent, transparent calc(${
                        100 / days.length
                      }% - 1px), rgba(128,128,128,0.12) calc(${100 / days.length}% - 1px), rgba(128,128,128,0.12) calc(${
                        100 / days.length
                      }%))`,
                      backgroundSize: dayColWidth ? `${dayColWidth * days.length}px 100%` : "100% 100%",
                    }}
                  >
                    {row.bars.map(({ activity, lane, startOffset, endOffset }) => {
                      const left = (startOffset / days.length) * 100;
                      const width = ((endOffset - startOffset + 1) / days.length) * 100;
                      return (
                        <Box
                          key={activity.id}
                          onClick={() => setEditingActivity(activity)}
                          sx={{
                            position: "absolute",
                            insetInlineStart: `${left}%`,
                            width: `calc(${width}% - 4px)`,
                            top: 4 + lane * (ROW_HEIGHT + LANE_GAP),
                            height: ROW_HEIGHT - 8,
                            mx: "2px",
                            borderRadius: 1.5,
                            bgcolor: PRIORITY_COLORS[activity.priority],
                            opacity: activity.isCompleted ? 0.45 : 0.92,
                            display: "flex",
                            alignItems: "center",
                            px: 1,
                            overflow: "hidden",
                            cursor: "pointer",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                            transition:
                              "inset-inline-start 280ms cubic-bezier(0.4, 0, 0.2, 1), width 280ms cubic-bezier(0.4, 0, 0.2, 1), top 260ms ease-out, opacity 200ms ease-out, transform 120ms ease-out",
                            "&:active": { transform: "scale(0.96)" },
                            animation: "karegahyar-bar-pop-in 220ms ease-out",
                            "@keyframes karegahyar-bar-pop-in": {
                              from: { opacity: 0, transform: "scaleX(0.85)" },
                              to: { opacity: activity.isCompleted ? 0.45 : 0.92, transform: "scaleX(1)" },
                            },
                          }}
                        >
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{
                              color: "#fff",
                              fontWeight: 600,
                              textDecoration: activity.isCompleted ? "line-through" : "none",
                            }}
                          >
                            {activity.title}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}

              {/* خط عمودی «امروز» */}
              {showTodayLine && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 32,
                    bottom: 0,
                    insetInlineStart: `${(todayOffset / days.length) * 100}%`,
                    width: "2px",
                    bgcolor: "primary.main",
                    zIndex: 3,
                    transition: "inset-inline-start 280ms cubic-bezier(0.4, 0, 0.2, 1)",
                    pointerEvents: "none",
                    animation: "karegahyar-today-glow 1.8s ease-in-out infinite",
                    "@keyframes karegahyar-today-glow": {
                      "0%, 100%": { boxShadow: "0 0 0 rgba(234,106,0,0)" },
                      "50%": { boxShadow: "0 0 6px 1px rgba(234,106,0,0.55)" },
                    },
                  }}
                />
              )}
            </Box>
          </Box>
        </Stack>
      )}

      {rows.length > 0 && (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ px: 0.5 }}>
          {(Object.keys(PRIORITY_LABELS) as ActivityPriority[]).map((p, idx) => (
            <Chip
              key={p}
              size="small"
              variant="outlined"
              label={PRIORITY_LABELS[p].replace("اولویت ", "")}
              sx={{
                "& .MuiChip-label": { fontSize: 11 },
                borderColor: PRIORITY_COLORS[p],
                color: PRIORITY_COLORS[p],
                animation: "karegahyar-chip-fade-in 220ms ease-out both",
                animationDelay: `${idx * 60}ms`,
                "@keyframes karegahyar-chip-fade-in": {
                  from: { opacity: 0, transform: "translateY(3px)" },
                  to: { opacity: 1, transform: "translateY(0)" },
                },
              }}
            />
          ))}
        </Stack>
      )}

      {editingActivity && (
        <GanttEditBridge activity={editingActivity} onClose={() => setEditingActivity(null)} />
      )}
    </Box>
  );
}

/**
 * پل سبک بین کلیک روی نوار گانت و دیالوگ ویرایش موجود صفحهٔ فعالیت‌ها —
 * چون این ویجت مستقل است، خودش دیالوگ ویرایش را با mutation جدا (فقط برای
 * حالت ویرایش، نه ایجاد) نگه می‌دارد تا منطق ذخیره در futureActivityService
 * دوباره پیاده‌سازی نشود.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../shared/components/ToastProvider";
import { extractErrorMessage } from "../../shared/api/client";
import { notificationsApi } from "../../shared/api/notificationsApi";
import { FutureActivityFormDialog } from "./FutureActivityFormDialog";
import type { CreateFutureActivityInput } from "../../entities/FutureActivity";

function GanttEditBridge({ activity, onClose }: { activity: FutureActivity; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const updateMutation = useMutation({
    mutationFn: (input: CreateFutureActivityInput) =>
      futureActivitiesApi.update(activity.id, {
        date: input.date,
        endDate: input.endDate,
        time: input.time,
        title: input.title,
        description: input.description,
        priority: input.priority,
        workerId: input.workerId,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["future-activities"] });
      notificationsApi.scheduleForActivity(updated);
      showToast("تغییرات ذخیره شد.", "success");
      onClose();
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  return (
    <FutureActivityFormDialog
      open
      initialActivity={activity}
      saving={updateMutation.isPending}
      onClose={onClose}
      onSubmit={(input) => updateMutation.mutate(input)}
    />
  );
}
