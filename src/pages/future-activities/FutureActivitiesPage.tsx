import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Fab,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import SortIcon from "@mui/icons-material/Sort";
import CheckIcon from "@mui/icons-material/Check";
import ViewTimelineIcon from "@mui/icons-material/ViewTimeline";
import ViewListIcon from "@mui/icons-material/ViewList";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { SkeletonList } from "../../shared/components/SkeletonList";
import { PullToRefresh } from "../../shared/components/PullToRefresh";
import { SwipeToDelete } from "../../shared/components/SwipeToDelete";
import { extractErrorMessage } from "../../shared/api/client";
import { futureActivitiesApi } from "../../shared/api/futureActivitiesApi";
import { notificationsApi } from "../../shared/api/notificationsApi";
import { workersApi } from "../../shared/api/workersApi";
import type { CreateFutureActivityInput, FutureActivity } from "../../entities/FutureActivity";
import type { Worker } from "../../entities/Worker";
import { FutureActivityFormDialog } from "../../widgets/future-activities/FutureActivityFormDialog";
import { FutureActivityListItem } from "../../widgets/future-activities/FutureActivityListItem";
import { ActivityGanttView } from "../../widgets/future-activities/ActivityGanttView";
import { AnimatedList } from "../../shared/components/AnimatedList";
import {
  getHistoryDayLabel,
  getOverdueLabelText,
  getRelativeDayLabel,
  getTodayIso,
  getTodayLabelText,
} from "../../shared/utils/jalaliDate";

type ViewMode = "upcoming" | "history";
type SortMode = "date" | "priority";
type DisplayMode = "list" | "gantt";

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface FutureActivitiesPageProps {
  embedded?: boolean;
}

export function FutureActivitiesPage({ embedded = false }: FutureActivitiesPageProps = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<FutureActivity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<FutureActivity | null>(null);
  const [deleteSeriesTarget, setDeleteSeriesTarget] = useState<string | null>(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);

  const queryKey = ["future-activities", viewMode, includeCompleted] as const;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => futureActivitiesApi.listAll({ scope: viewMode, includeCompleted }),
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

  const activities = useMemo(() => data ?? [], [data]);
  const today = getTodayIso();

  const groups = useMemo(() => {
    const map = new Map<string, FutureActivity[]>();
    for (const activity of activities) {
      const label =
        viewMode === "history"
          ? getHistoryDayLabel(activity.date, today)
          : getRelativeDayLabel(activity.date, today);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(activity);
    }
    const entries = Array.from(map.entries());
    if (sortMode === "priority") {
      // مرتب‌سازی داخل هر گروه روزانه بر اساس اولویت (زیاد > متوسط > کم).
      for (const [, items] of entries) {
        items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
      }
      // نکته: چون اغلب گروه‌های روزانه فقط یک فعالیت دارند، مرتب‌سازی
      // «فقط داخل گروه» عملاً در بیشتر موارد هیچ تغییری در نمایش ایجاد
      // نمی‌کرد و به‌نظر می‌رسید این گزینه اصلاً کاری نمی‌کند. برای این‌که
      // انتخاب «اولویت» واقعاً محسوس باشد، ترتیب خودِ گروه‌های روزانه را هم
      // بر اساس بالاترین اولویت موجود در آن روز عوض می‌کنیم — روزی که یک
      // فعالیتِ «اولویت زیاد» دارد، جلوتر از روزی می‌آید که فقط «کم» دارد،
      // حتی اگر تاریخش دیرتر باشد؛ برچسب «امروز/فردا» هرکدام همچنان
      // سرِجایش می‌ماند، فقط ترتیب نمایش گروه‌ها عوض می‌شود.
      entries.sort(([, itemsA], [, itemsB]) => {
        const bestA = Math.min(...itemsA.map((a) => PRIORITY_RANK[a.priority]));
        const bestB = Math.min(...itemsB.map((b) => PRIORITY_RANK[b.priority]));
        return bestA - bestB;
      });
    }
    return entries;
  }, [activities, today, viewMode, sortMode]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["future-activities"] });
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateFutureActivityInput) => futureActivitiesApi.create(input),
    onSuccess: (created) => {
      invalidate();
      setFormOpen(false);
      created.forEach((a) => notificationsApi.scheduleForActivity(a));
      showToast(
        created.length > 1
          ? (t("futureActivities.toastCreatedMultiple", { count: created.length }) as string)
          : (t("futureActivities.toastCreated") as string),
        "success"
      );
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; input: CreateFutureActivityInput }) =>
      futureActivitiesApi.update(vars.id, {
        date: vars.input.date,
        time: vars.input.time,
        title: vars.input.title,
        description: vars.input.description,
        priority: vars.input.priority,
        workerId: vars.input.workerId,
      }),
    onSuccess: (updated) => {
      invalidate();
      setFormOpen(false);
      setEditingActivity(null);
      notificationsApi.scheduleForActivity(updated);
      showToast(t("futureActivities.toastUpdated") as string, "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => futureActivitiesApi.toggleCompleted(id),
    onSuccess: (updated) => {
      invalidate();
      if (updated.isCompleted) {
        notificationsApi.cancelForActivity(updated.id);
      } else {
        notificationsApi.scheduleForActivity(updated);
      }
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => futureActivitiesApi.remove(id),
    onSuccess: (_data, id) => {
      invalidate();
      notificationsApi.cancelForActivity(id);
      showToast(t("futureActivities.toastDeleted") as string, "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
    onSettled: () => setDeletingActivity(null),
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: (seriesId: string) => futureActivitiesApi.removeSeries(seriesId),
    onSuccess: (_data, seriesId) => {
      invalidate();
      activities.filter((a) => a.seriesId === seriesId).forEach((a) => notificationsApi.cancelForActivity(a.id));
      showToast(t("futureActivities.toastSeriesDeleted") as string, "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
    onSettled: () => setDeleteSeriesTarget(null),
  });

  function openCreate() {
    setEditingActivity(null);
    setFormOpen(true);
  }

  function openEdit(activity: FutureActivity) {
    setEditingActivity(activity);
    setFormOpen(true);
  }

  function handleSubmit(input: CreateFutureActivityInput) {
    if (editingActivity) {
      updateMutation.mutate({ id: editingActivity.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  function handleDeleteRequest(activity: FutureActivity) {
    if (activity.seriesId) {
      setDeleteSeriesTarget(activity.seriesId);
    } else {
      setDeletingActivity(activity);
    }
  }

  if (isError) return <ErrorState message={extractErrorMessage(error)} />;

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        {!embedded && (
          <Typography variant="h5" fontWeight={700}>
            {t("futureActivities.title")}
          </Typography>
        )}
        <ToggleButtonGroup
          value={displayMode}
          exclusive
          size="small"
          onChange={(_, v) => v && setDisplayMode(v)}
          sx={{ ml: "auto" }}
        >
          <ToggleButton value="list" aria-label={t("futureActivities.listView") as string} sx={{ px: 1.25, py: 0.5 }}>
            <ViewListIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="gantt" aria-label={t("futureActivities.ganttView") as string} sx={{ px: 1.25, py: 0.5 }}>
            <ViewTimelineIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {displayMode === "gantt" ? (
        <Box
          key="gantt"
          sx={{
            animation: "karegahyar-view-fade-in 260ms ease-out",
            "@keyframes karegahyar-view-fade-in": {
              from: { opacity: 0, transform: "translateY(6px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <ActivityGanttView />
        </Box>
      ) : (
        <Box
          key="list"
          sx={{
            animation: "karegahyar-view-fade-in 260ms ease-out",
            "@keyframes karegahyar-view-fade-in": {
              from: { opacity: 0, transform: "translateY(6px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          {/* این صفحه از قبل زیرتب «فعالیت‌های آینده» در تب «فعالیت‌ها» است؛
              پس یک نوار Tabs تمام‌عرض دیگر برای نمایش/تاریخچه، یعنی دو منوی
              کامل روی هم. این‌جا هم مثل تجهیزات، با یک ToggleButtonGroup
              (سوییچ نمایش، نه یک مقصد ناوبری دوم) جایگزین شده. */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v !== null && setViewMode(v)}
            fullWidth
            size="small"
          >
            <ToggleButton value="upcoming">{t("futureActivities.tabUpcoming") as string}</ToggleButton>
            <ToggleButton value="history">{t("futureActivities.tabHistory") as string}</ToggleButton>
          </ToggleButtonGroup>

          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mt: 1.5 }}>
            {viewMode === "upcoming" ? (
              <FormControlLabel
                control={<Switch checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} />}
                label={t("futureActivities.showCompleted") as string}
                sx={{ ml: 0 }}
              />
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t("futureActivities.historyHint")}
              </Typography>
            )}

            <IconButton
              size="small"
              onClick={(e) => setSortMenuAnchor(e.currentTarget)}
              aria-label={t("futureActivities.sortAriaLabel") as string}
              sx={{
                bgcolor: sortMode === "priority" ? "action.selected" : "transparent",
                borderRadius: 999,
              }}
            >
              <SortIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={sortMenuAnchor} open={!!sortMenuAnchor} onClose={() => setSortMenuAnchor(null)}>
              <MenuItem
                onClick={() => {
                  setSortMode("date");
                  setSortMenuAnchor(null);
                }}
              >
                {sortMode === "date" && <CheckIcon fontSize="small" sx={{ ml: 1 }} />}
                {t("futureActivities.sortByDate")}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setSortMode("priority");
                  setSortMenuAnchor(null);
                }}
              >
                {sortMode === "priority" && <CheckIcon fontSize="small" sx={{ ml: 1 }} />}
                {t("futureActivities.sortByPriority")}
              </MenuItem>
            </Menu>
          </Stack>

          {isLoading ? (
            <SkeletonList count={4} rowHeight={64} withAvatar={false} />
          ) : activities.length === 0 ? (
            <EmptyState
              icon={<EventAvailableIcon fontSize="inherit" />}
              title={
                viewMode === "upcoming"
                  ? (t("futureActivities.emptyUpcomingTitle") as string)
                  : (t("futureActivities.emptyHistoryTitle") as string)
              }
              description={
                viewMode === "upcoming"
                  ? (t("futureActivities.emptyUpcomingDesc") as string)
                  : (t("futureActivities.emptyHistoryDesc") as string)
              }
            />
          ) : (
            <PullToRefresh onRefresh={() => refetch()}>
              <Stack spacing={2.5} sx={{ mt: 1.5 }}>
                {groups.map(([label, items]) => {
                  const isToday = label === getTodayLabelText();
                  return (
                    <Box
                      key={label}
                      sx={{
                        animation: "karegahyar-group-fade-in 220ms ease-out",
                        "@keyframes karegahyar-group-fade-in": {
                          from: { opacity: 0, transform: "translateY(6px)" },
                          to: { opacity: 1, transform: "translateY(0)" },
                        },
                      }}
                    >
                      {/* هدر چسبان: هنگام اسکرول لیست بلند، برچسب تاریخ گروه فعلی
                          بالای صفحه می‌ماند تا کاربر همیشه بداند در کدام روز است؛
                          bgcolor پشت آن لازم است وگرنه آیتم‌های زیرین از پشتش رد می‌شوند. */}
                      <Box
                        sx={{
                          position: "sticky",
                          top: 0,
                          zIndex: 2,
                          bgcolor: "background.default",
                          py: 0.75,
                          mb: 0.25,
                        }}
                      >
                        <Chip
                          label={label}
                          size="small"
                          color={label === getOverdueLabelText() ? "error" : isToday ? "primary" : "default"}
                          variant={label === getOverdueLabelText() || isToday ? "filled" : "outlined"}
                          sx={{ fontWeight: 700 }}
                        />
                      </Box>
                      <AnimatedList spacing={1}>
                        {items.map((activity) => (
                          <SwipeToDelete
                            key={activity.id}
                            onDelete={() => handleDeleteRequest(activity)}
                            ariaLabel={t("futureActivities.deleteItemAriaLabel", { title: activity.title }) as string}
                          >
                            <FutureActivityListItem
                              activity={activity}
                              worker={activity.workerId ? workersById.get(activity.workerId) ?? null : null}
                              showStatusChip={viewMode === "history"}
                              onToggleCompleted={(a) => toggleMutation.mutate(a.id)}
                              onEdit={openEdit}
                              onDelete={handleDeleteRequest}
                            />
                          </SwipeToDelete>
                        ))}
                      </AnimatedList>
                    </Box>
                  );
                })}
              </Stack>
            </PullToRefresh>
          )}
        </Box>
      )}

      <Fab
        color="primary"
        onClick={openCreate}
        sx={{ position: "fixed", bottom: 84, insetInlineEnd: 20, zIndex: 5 }}
      >
        <AddIcon />
      </Fab>

      <FutureActivityFormDialog
        open={formOpen}
        initialActivity={editingActivity}
        saving={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditingActivity(null);
        }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deletingActivity}
        title={t("futureActivities.deleteDialogTitle") as string}
        description={t("futureActivities.deleteDialogDesc") as string}
        confirmLabel={t("futureActivities.deleteAction") as string}
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => deletingActivity && deleteMutation.mutate(deletingActivity.id)}
        onCancel={() => setDeletingActivity(null)}
      />

      <ConfirmDialog
        open={!!deleteSeriesTarget}
        title={t("futureActivities.deleteSeriesDialogTitle") as string}
        description={t("futureActivities.deleteSeriesDialogDesc") as string}
        confirmLabel={t("futureActivities.deleteSeriesAction") as string}
        confirmColor="error"
        loading={deleteSeriesMutation.isPending}
        onConfirm={() => deleteSeriesTarget && deleteSeriesMutation.mutate(deleteSeriesTarget)}
        onCancel={() => setDeleteSeriesTarget(null)}
      />
    </Box>
  );
}
