import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import { useTranslation } from "react-i18next";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { workersApi } from "../../shared/api/workersApi";
import { projectsApi } from "../../shared/api/projectsApi";
import { floorIssuesApi } from "../../shared/api/floorIssuesApi";
import { FLOOR_ISSUE_STATUSES, FloorIssueStatus } from "../../entities/FloorIssue";
import {
  CreateFloorIssueInput,
  FLOOR_ISSUE_SEVERITIES,
  FloorIssue,
  FloorIssueSeverity,
  UpdateFloorIssueInput,
} from "../../entities/FloorIssue";
import type { FloorStageWithStats } from "../../entities/FloorStage";
import type { FloorTask } from "../../entities/FloorTask";
import { STANDARD_STAGE_KEYS } from "../../core/seedFloorStages";
import { VoiceRecorderButton } from "../../shared/components/VoiceRecorderButton";
import { VoiceNoteList } from "../../shared/components/VoiceNoteList";
import { voiceNoteService } from "../../core/services/voiceNoteService";
import { extractErrorMessage } from "../../core/errors";
import { useToast } from "../../shared/components/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";

interface FloorIssueFormDialogProps {
  open: boolean;
  floorId: string;
  stages: FloorStageWithStats[];
  tasks: FloorTask[];
  issue?: FloorIssue | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateFloorIssueInput | UpdateFloorIssueInput) => void;
}

export function FloorIssueFormDialog({ open, floorId, stages, tasks, issue, loading, onClose, onSubmit }: FloorIssueFormDialogProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<FloorIssueSeverity>("medium");
  const [stageId, setStageId] = useState("");
  const [assignedWorkerId, setAssignedWorkerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<FloorIssueStatus>("open");
  const [taskId, setTaskId] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: workers } = useQuery({
    queryKey: ["workers", "active", floorId],
    queryFn: async () => {
      const projectId = await projectsApi.getActiveProjectId();
      return workersApi.list({ isActive: true, projectId });
    },
    enabled: open,
  });

  // برای پیشنهاد «استفاده از توضیح آخرین مشکل» — دقیقاً همان الگویی که در
  // توضیحات گزارش کار روزانه (WorkLogDayEntries) استفاده شده: چون خیلی از
  // مشکلات این طبقه تکراری‌اند (نم، ترک، تأخیر مصالح)، آخرین توضیح ثبت‌شده
  // برای همین طبقه به‌عنوان پیشنهاد نمایش داده می‌شود، نه جایگزین خودکار.
  const { data: floorIssuesForSuggestion } = useQuery({
    queryKey: ["floor-issues", "for-suggestion", floorId],
    queryFn: () => floorIssuesApi.listByFloor(floorId),
    enabled: open,
  });
  const previousIssueDescription = useMemo(() => {
    const prior = (floorIssuesForSuggestion ?? [])
      .filter((i) => i.id !== issue?.id && i.description && i.description.trim() !== "")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return prior[0]?.description ?? undefined;
  }, [floorIssuesForSuggestion, issue]);


  useEffect(() => {
    if (open) {
      setTitle(issue?.title || "");
      setDescription(issue?.description || "");
      setSeverity(issue?.severity || "medium");
      setStageId(issue?.stageId || "");
      setAssignedWorkerId(issue?.assignedWorkerId || "");
      setDueDate(issue?.dueDate || "");
      setStatus(issue?.status || "open");
      setTaskId(issue?.taskId || "");
      setResolutionNote(issue?.resolutionNote || "");
      setErrors({});
    }
  }, [open, issue]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = t("floor.form.issue.title") as string;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleVoiceRecorded(blob: Blob, durationSeconds: number, mimeType: string) {
    if (!issue) return;
    try {
      await voiceNoteService.record({
        relatedType: "floorIssue",
        relatedId: issue.id,
        floorId,
        date: new Date().toISOString().slice(0, 10),
        blob,
        durationSeconds,
        mimeType,
      });
      await queryClient.invalidateQueries({ queryKey: ["voiceNotes", "floorIssue", issue.id] });
    } catch (error) {
      showToast(extractErrorMessage(error), "error");
    }
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit({
      floorId,
      stageId: stageId || null,
      taskId: taskId || null,
      title: title.trim(),
      description: description.trim() || null,
      severity,
      assignedWorkerId: assignedWorkerId || null,
      dueDate: dueDate.trim() || null,
      ...(issue ? { status, resolutionNote: resolutionNote.trim() || null } : {}),
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {issue ? t("floor.form.issue.editTitle") : t("floor.form.issue.addTitle")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            label={t("floor.form.issue.title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!!errors.title}
            helperText={errors.title}
            autoFocus
          />
          <TextField
            select
            label={t("floor.form.issue.severity")}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as FloorIssueSeverity)}
          >
            {FLOOR_ISSUE_SEVERITIES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`floor.issueSeverity.${s}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label={t("floor.form.issue.stage")} value={stageId} onChange={(e) => setStageId(e.target.value)}>
            <MenuItem value="">{t("floor.form.task.noStage")}</MenuItem>
            {stages.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {!s.isCustom && STANDARD_STAGE_KEYS.includes(s.key) ? t(`floor.stageTitle.${s.key}`) : s.title}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t("floor.form.issue.task")}
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
          >
            <MenuItem value="">{t("floor.form.task.noTask")}</MenuItem>
            {tasks.map((task) => (
              <MenuItem key={task.id} value={task.id}>
                {task.title}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t("floor.form.issue.assignedWorker")}
            value={assignedWorkerId}
            onChange={(e) => setAssignedWorkerId(e.target.value)}
          >
            <MenuItem value="">{t("floor.form.task.noWorker")}</MenuItem>
            {(workers ?? []).map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.firstName} {w.lastName}
              </MenuItem>
            ))}
          </TextField>
          <JalaliDatePicker label={t("floor.form.issue.dueDate") as string} value={dueDate} onChange={setDueDate} />
          {issue && (
            <TextField
              select
              label={t("floor.form.issue.status")}
              value={status}
              onChange={(e) => setStatus(e.target.value as FloorIssueStatus)}
            >
              {FLOOR_ISSUE_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>{t(`floor.issueStatus.${s}`)}</MenuItem>
              ))}
            </TextField>
          )}
          {issue && status === "resolved" && (
            <TextField
              label={t("floor.form.issue.resolutionNote")}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              multiline
              minRows={2}
            />
          )}
          <TextField
            label={t("floor.form.issue.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />
          {open && !!previousIssueDescription && description.trim() === "" && (
            <Box sx={{ mt: -1 }}>
              <Chip
                icon={<HistoryIcon fontSize="small" />}
                size="small"
                variant="outlined"
                label={t("common.usePreviousText") as string}
                onClick={() => setDescription(previousIssueDescription)}
              />
            </Box>
          )}
          {issue && (
            <>
              <Divider />
              <Stack spacing={1}>
                <Typography variant="subtitle2">{t("voiceNote.sectionTitle")}</Typography>
                <VoiceNoteList relatedType="floorIssue" relatedId={issue.id} />
                <VoiceRecorderButton onRecorded={handleVoiceRecorded} />
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("floor.form.issue.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {t("floor.form.issue.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
