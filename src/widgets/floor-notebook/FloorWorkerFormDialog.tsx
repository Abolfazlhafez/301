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
import { workersApi } from "../../shared/api/workersApi";
import { projectsApi } from "../../shared/api/projectsApi";
import { CreateFloorWorkerInput } from "../../entities/FloorWorker";
import type { FloorStageWithStats } from "../../entities/FloorStage";
import { STANDARD_STAGE_KEYS } from "../../core/seedFloorStages";

interface FloorWorkerFormDialogProps {
  open: boolean;
  floorId: string;
  stages: FloorStageWithStats[];
  existingWorkerIds: string[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateFloorWorkerInput) => void;
}

export function FloorWorkerFormDialog({
  open,
  floorId,
  stages,
  existingWorkerIds,
  loading,
  onClose,
  onSubmit,
}: FloorWorkerFormDialogProps) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState("");
  const [role, setRole] = useState("");
  const [stageId, setStageId] = useState("");
  const [error, setError] = useState("");

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
      setWorkerId("");
      setRole("");
      setStageId("");
      setError("");
    }
  }, [open]);

  function handleSubmit() {
    if (!workerId) {
      setError(t("floor.form.worker.worker") as string);
      return;
    }
    onSubmit({ floorId, workerId, role: role.trim() || null, stageId: stageId || null });
  }

  const availableWorkers = (workers ?? []).filter((w) => !existingWorkerIds.includes(w.id));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {t("floor.form.worker.addTitle")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            select
            label={t("floor.form.worker.worker")}
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            error={!!error}
            helperText={error}
          >
            {availableWorkers.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.firstName} {w.lastName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("floor.form.worker.role")}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t("floor.form.worker.rolePlaceholder") as string}
          />
          <TextField select label={t("floor.form.worker.stage")} value={stageId} onChange={(e) => setStageId(e.target.value)}>
            <MenuItem value="">{t("floor.form.task.noStage")}</MenuItem>
            {stages.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {!s.isCustom && STANDARD_STAGE_KEYS.includes(s.key) ? t(`floor.stageTitle.${s.key}`) : s.title}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("floor.form.worker.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {t("floor.form.worker.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
