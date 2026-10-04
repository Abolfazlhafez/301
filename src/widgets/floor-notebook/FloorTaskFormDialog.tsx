import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { workersApi } from "../../shared/api/workersApi";
import { projectsApi } from "../../shared/api/projectsApi";
import {
  CreateFloorTaskInput,
  FLOOR_TASK_PRIORITIES,
  FloorTask,
  FloorTaskPriority,
  UpdateFloorTaskInput,
} from "../../entities/FloorTask";
import type { FloorStageWithStats } from "../../entities/FloorStage";
import { STANDARD_STAGE_KEYS } from "../../core/seedFloorStages";

interface FloorTaskFormDialogProps {
  open: boolean;
  floorId: string;
  stages: FloorStageWithStats[];
  task?: FloorTask | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateFloorTaskInput | UpdateFloorTaskInput) => void;
}

export function FloorTaskFormDialog({ open, floorId, stages, task, loading, onClose, onSubmit }: FloorTaskFormDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState("");
  const [priority, setPriority] = useState<FloorTaskPriority>("medium");
  const [status, setStatus] = useState<FloorTask["status"]>("todo");
  const [progress, setProgress] = useState(0);
  const [description, setDescription] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [actualCost, setActualCost] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: workers } = useQuery({
    queryKey: ["workers", "active", floorId],
    queryFn: async () => {
      const projectId = await projectsApi.getActiveProjectId();
      return workersApi.list({ isActive: true, projectId });
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setTitle(task?.title || "");
      setStageId(task?.stageId || "");
      setPriority(task?.priority || "medium");
      setStatus(task?.status || "todo");
      setProgress(task?.progress ?? 0);
      setDescription(task?.description || "");
      setWorkerId(task?.workerId || "");
      setStartDate(task?.startDate || "");
      setDueDate(task?.dueDate || "");
      setEstimatedCost(task?.estimatedCost !== null && task?.estimatedCost !== undefined ? String(task.estimatedCost) : "");
      setActualCost(task?.actualCost !== null && task?.actualCost !== undefined ? String(task.actualCost) : "");
      setNote(task?.note || "");
      setErrors({});
    }
  }, [open, task]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = t("floor.form.task.title") as string;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const base = {
      floorId,
      stageId: stageId || null,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      workerId: workerId || null,
      startDate: startDate.trim() || null,
      dueDate: dueDate.trim() || null,
      estimatedCost: estimatedCost.trim() ? Number(estimatedCost) : null,
      note: note.trim() || null,
    };
    onSubmit(task ? {
      ...base,
      status,
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      actualCost: actualCost.trim() ? Number(actualCost) : null,
    } : base);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {task ? t("floor.form.task.editTitle") : t("floor.form.task.addTitle")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            label={t("floor.form.task.title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!!errors.title}
            helperText={errors.title}
            autoFocus
          />
          <TextField select label={t("floor.form.task.stage")} value={stageId} onChange={(e) => setStageId(e.target.value)}>
            <MenuItem value="">{t("floor.form.task.noStage")}</MenuItem>
            {stages.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {!s.isCustom && STANDARD_STAGE_KEYS.includes(s.key) ? t(`floor.stageTitle.${s.key}`) : s.title}
              </MenuItem>
            ))}
          </TextField>
          {task && (
            <TextField
              select
              label={t("floor.form.task.status")}
              value={status}
              onChange={(e) => setStatus(e.target.value as FloorTask["status"])}
            >
              {(["todo", "in_progress", "blocked", "done"] as const).map((s) => (
                <MenuItem key={s} value={s}>{t(`floor.taskStatus.${s}`)}</MenuItem>
              ))}
            </TextField>
          )}
          <TextField multiline minRows={2} label={t("floor.form.task.description")} value={description} onChange={(e) => setDescription(e.target.value)} />
          <TextField
            label={t("floor.form.task.progress")}
            value={progress}
            onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            type="number"
            inputProps={{ min: 0, max: 100, step: 1 }}
            disabled={!task}
          />
          <TextField
            select
            label={t("floor.form.task.priority")}
            value={priority}
            onChange={(e) => setPriority(e.target.value as FloorTaskPriority)}
          >
            {FLOOR_TASK_PRIORITIES.map((p) => (
              <MenuItem key={p} value={p}>
                {t(`floor.taskPriority.${p}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label={t("floor.form.task.worker")} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <MenuItem value="">{t("floor.form.task.noWorker")}</MenuItem>
            {(workers ?? []).map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.firstName} {w.lastName}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1.5}>
            <JalaliDatePicker label={t("floor.form.task.startDate") as string} value={startDate} onChange={setStartDate} />
            <JalaliDatePicker label={t("floor.form.task.dueDate") as string} value={dueDate} onChange={setDueDate} />
          </Stack>
          <TextField
            label={t("floor.form.task.estimatedCost")}
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
          />
          {task && (
            <TextField
              label={t("floor.form.task.actualCost")}
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
            />
          )}
          <TextField label={t("floor.form.task.note")} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("floor.form.task.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {t("floor.form.task.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
