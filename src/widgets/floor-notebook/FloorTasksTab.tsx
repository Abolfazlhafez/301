import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Fab,
  IconButton,
  Stack,
  Typography,
  Grid,
  TextField,
  MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import EventIcon from "@mui/icons-material/Event";
import { useTranslation } from "react-i18next";
import { floorTasksApi } from "../../shared/api/floorTasksApi";
import { floorStagesApi } from "../../shared/api/floorStagesApi";
import { extractErrorMessage } from "../../shared/api/client";
import { CreateFloorTaskInput, FloorTask, FloorTaskPriority, UpdateFloorTaskInput } from "../../entities/FloorTask";
import { getOverdueLabelText, getRelativeDayLabel } from "../../shared/utils/jalaliDate";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { FloorTaskFormDialog } from "./FloorTaskFormDialog";
import { PhotoGalleryDialog } from "../photo-gallery/PhotoGalleryDialog";
import { FloorChecklistSection } from "./FloorChecklistSection";
import { STANDARD_STAGE_KEYS } from "../../core/seedFloorStages";

interface FloorTasksTabProps {
  floorId: string;
}

const PRIORITY_COLOR: Record<string, "default" | "info" | "warning" | "error"> = {
  low: "default",
  medium: "info",
  high: "warning",
  critical: "error",
};

const STATUS_COLOR: Record<string, "default" | "info" | "warning" | "success"> = {
  todo: "default",
  in_progress: "info",
  blocked: "warning",
  done: "success",
};

/**
 * برچسب کوچک موعد برای هر کار، با همان قاعدهٔ «عقب‌افتاده» که در محاسبهٔ
 * healthScore طبقه هم استفاده می‌شود (status !== done و dueDate گذشته) —
 * فقط این‌بار به‌جای شمارش برای امتیاز سلامت، مستقیم روی خودِ کارت نشان
 * داده می‌شود تا کاربر بدون سرزدن به هر کار، عقب‌افتاده‌ها را ببیند.
 */
function taskDueInfo(task: FloorTask): { label: string; overdue: boolean } | null {
  if (!task.dueDate) return null;
  const label = getRelativeDayLabel(task.dueDate);
  return { label, overdue: task.status !== "done" && label === getOverdueLabelText() };
}

export function FloorTasksTab({ floorId }: FloorTasksTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FloorTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<FloorTask | null>(null);
  const [photosTask, setPhotosTask] = useState<FloorTask | null>(null);
  const [statusFilter, setStatusFilter] = useState<FloorTask["status"] | "">("");
  const [priorityFilter, setPriorityFilter] = useState<FloorTaskPriority | "">("");
  const [sortMode, setSortMode] = useState<"newest" | "due" | "progress">("newest");

  const tasksQuery = useQuery({
    queryKey: ["floorTasks", floorId],
    queryFn: () => floorTasksApi.listByFloor(floorId),
  });

  const stagesQuery = useQuery({
    queryKey: ["floorStages", floorId],
    queryFn: () => floorStagesApi.listByFloor(floorId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["floorTasks", floorId] });
    queryClient.invalidateQueries({ queryKey: ["floorStages", floorId] });
    queryClient.invalidateQueries({ queryKey: ["floors", floorId] });
    queryClient.invalidateQueries({ queryKey: ["floorActivity", floorId] });
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateFloorTaskInput) => floorTasksApi.create(input),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.taskCreated") as string, "success");
      setFormOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFloorTaskInput }) => floorTasksApi.update(id, input),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.taskUpdated") as string, "success");
      setFormOpen(false);
      setEditingTask(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => floorTasksApi.remove(id),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.taskDeleted") as string, "success");
      setDeletingTask(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  function handleSubmit(input: CreateFloorTaskInput | UpdateFloorTaskInput) {
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, input });
    } else {
      createMutation.mutate(input as CreateFloorTaskInput);
    }
  }

  function toggleDone(task: FloorTask) {
    updateMutation.mutate({ id: task.id, input: { status: task.status === "done" ? "todo" : "done" } });
  }

  function stageLabel(stageId: string | null): string | null {
    if (!stageId) return null;
    const stage = (stagesQuery.data ?? []).find((s) => s.id === stageId);
    if (!stage) return null;
    return !stage.isCustom && STANDARD_STAGE_KEYS.includes(stage.key) ? (t(`floor.stageTitle.${stage.key}`) as string) : stage.title;
  }

  const tasks = [...(tasksQuery.data ?? [])]
    .filter((task) => !statusFilter || task.status === statusFilter)
    .filter((task) => !priorityFilter || task.priority === priorityFilter)
    .sort((a, b) => {
      if (sortMode === "progress") return b.progress - a.progress;
      if (sortMode === "due") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });

  return (
    <Box display="flex" flexDirection="column" gap={2} sx={{ position: "relative", minHeight: 200, pb: 8 }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {t("floor.tasksTab.title")}
      </Typography>

      <Grid container spacing={1}>
        <Grid item xs={12} sm={4}>
          <TextField select fullWidth size="small" label={t("floor.tasksTab.filterStatus")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FloorTask["status"] | "")}>
            <MenuItem value="">{t("floor.tasksTab.all")}</MenuItem>
            {(["todo", "in_progress", "blocked", "done"] as const).map((s) => <MenuItem key={s} value={s}>{t(`floor.taskStatus.${s}`)}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField select fullWidth size="small" label={t("floor.tasksTab.filterPriority")} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as FloorTaskPriority | "")}>
            <MenuItem value="">{t("floor.tasksTab.all")}</MenuItem>
            {(["low", "medium", "high", "critical"] as const).map((p) => <MenuItem key={p} value={p}>{t(`floor.taskPriority.${p}`)}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField select fullWidth size="small" label={t("floor.tasksTab.sort")} value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)}>
            <MenuItem value="newest">{t("floor.tasksTab.sortNewest")}</MenuItem>
            <MenuItem value="due">{t("floor.tasksTab.sortDueDate")}</MenuItem>
            <MenuItem value="progress">{t("floor.tasksTab.sortProgress")}</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      {tasks.length === 0 ? (
        <EmptyState icon={<AssignmentIcon fontSize="inherit" />} title={t("floor.tasksTab.empty") as string} />
      ) : (
        <Stack spacing={1}>
          {tasks.map((task) => {
            const due = taskDueInfo(task);
            return (
            <Card key={task.id} variant="outlined">
              <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{ textDecoration: task.status === "done" ? "line-through" : "none" }}
                      >
                        {task.title}
                      </Typography>
                      <Chip size="small" label={t(`floor.taskStatus.${task.status}`)} color={STATUS_COLOR[task.status]} sx={{ height: 18, fontSize: 10 }} />
                      <Chip size="small" label={t(`floor.taskPriority.${task.priority}`)} color={PRIORITY_COLOR[task.priority]} variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                      {due && (
                        <Chip
                          size="small"
                          icon={<EventIcon fontSize="small" />}
                          label={due.label}
                          color={due.overdue ? "error" : "default"}
                          variant={due.overdue ? "filled" : "outlined"}
                          sx={{ height: 18, fontSize: 10, "& .MuiChip-icon": { fontSize: 12 } }}
                        />
                      )}
                    </Stack>
                    {stageLabel(task.stageId) && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {stageLabel(task.stageId)}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row">
                    <IconButton size="small" color={task.status === "done" ? "success" : "default"} onClick={() => toggleDone(task)}>
                      <CheckCircleIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setPhotosTask(task)}
                      aria-label={t("floor.tasksTab.taskPhotos") as string}
                      title={t("floor.tasksTab.taskPhotos") as string}
                    >
                      <PhotoCameraIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingTask(task);
                        setFormOpen(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeletingTask(task)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
            );
          })}
        </Stack>
      )}

      <Divider />
      <FloorChecklistSection floorId={floorId} />

      <Fab
        color="primary"
        size="medium"
        onClick={() => {
          setEditingTask(null);
          setFormOpen(true);
        }}
        sx={{ position: "fixed", bottom: 84, insetInlineStart: 20, zIndex: 5 }}
        aria-label={t("floor.tasksTab.addTask") as string}
      >
        <AddIcon />
      </Fab>

      <FloorTaskFormDialog
        open={formOpen}
        floorId={floorId}
        stages={stagesQuery.data ?? []}
        task={editingTask}
        loading={createMutation.isPending || updateMutation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <PhotoGalleryDialog
        open={!!photosTask}
        title={photosTask ? `${t("floor.tasksTab.taskPhotos")} · ${photosTask.title}` : t("floor.tasksTab.taskPhotos") as string}
        relatedType="floor"
        relatedId={photosTask ? floorId : null}
        floorId={floorId}
        taskId={photosTask?.id}
        onClose={() => setPhotosTask(null)}
      />

      <ConfirmDialog
        open={!!deletingTask}
        title={t("floor.form.task.editTitle") as string}
        description={t("floor.dialogs.deleteTaskMessage") as string}
        confirmLabel={t("floor.dialogs.confirm") as string}
        loading={deleteMutation.isPending}
        onConfirm={() => deletingTask && deleteMutation.mutate(deletingTask.id)}
        onCancel={() => setDeletingTask(null)}
      />
    </Box>
  );
}
