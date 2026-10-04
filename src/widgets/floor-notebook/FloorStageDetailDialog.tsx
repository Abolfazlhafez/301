import { useEffect, useState } from "react";
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
  Typography,
  Box,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import {
  FLOOR_STAGE_STATUSES,
  FloorStageProgressMode,
  FloorStageStatus,
  FloorStageWithStats,
  UpdateFloorStageInput,
} from "../../entities/FloorStage";
import { STANDARD_STAGE_KEYS } from "../../core/seedFloorStages";
import { PhotoGallery } from "../photo-gallery/PhotoGallery";

interface FloorStageDetailDialogProps {
  open: boolean;
  floorId: string;
  stage: FloorStageWithStats | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateFloorStageInput) => void;
  onDelete?: () => void;
}

export function FloorStageDetailDialog({ open, floorId, stage, loading, onClose, onSubmit, onDelete }: FloorStageDetailDialogProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<FloorStageStatus>("not_started");
  const [progressMode, setProgressMode] = useState<FloorStageProgressMode>("calculated");
  const [weight, setWeight] = useState(10);
  const [manualProgress, setManualProgress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  const isStandard = stage ? !stage.isCustom && STANDARD_STAGE_KEYS.includes(stage.key) : false;
  const title = stage ? (isStandard ? t(`floor.stageTitle.${stage.key}`) : stage.title) : "";

  useEffect(() => {
    if (open && stage) {
      setStatus(stage.status);
      setProgressMode(stage.progressMode);
      setWeight(stage.weight);
      setManualProgress(stage.manualProgress !== null ? String(stage.manualProgress) : "");
      setStartDate(stage.startDate || "");
      setEndDate(stage.endDate || "");
      setDescription(stage.description || "");
    }
  }, [open, stage]);

  function handleSubmit() {
    onSubmit({
      status,
      weight: Math.max(0, Number(weight) || 0),
      progressMode,
      manualProgress: progressMode === "manual" && manualProgress.trim() ? Number(manualProgress) : null,
      startDate: startDate.trim() || null,
      endDate: endDate.trim() || null,
      description: description.trim() || null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {title}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            select
            label={t("floor.form.stage.status")}
            value={status}
            onChange={(e) => setStatus(e.target.value as FloorStageStatus)}
          >
            {FLOOR_STAGE_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`floor.stageStatus.${s}`)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label={t("floor.form.stage.weight")}
            value={weight}
            onChange={(e) => setWeight(Math.max(0, Number(e.target.value) || 0))}
            type="number"
            inputProps={{ min: 0, step: 1, inputMode: "numeric" }}
          />

          <Stack spacing={0.5}>
            <ToggleButtonGroup
              exclusive
              size="small"
              fullWidth
              value={progressMode}
              onChange={(_, v) => v && setProgressMode(v)}
            >
              <ToggleButton value="calculated">{t("floor.form.stage.progressModeCalculated")}</ToggleButton>
              <ToggleButton value="manual">{t("floor.form.stage.progressModeManual")}</ToggleButton>
            </ToggleButtonGroup>
            {progressMode === "manual" && (
              <TextField
                label={t("floor.form.stage.manualProgress")}
                value={manualProgress}
                onChange={(e) => setManualProgress(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
              />
            )}
          </Stack>

          <Stack direction="row" spacing={1.5}>
            <JalaliDatePicker label={t("floor.form.stage.startDate") as string} value={startDate} onChange={setStartDate} />
            <JalaliDatePicker label={t("floor.form.stage.endDate") as string} value={endDate} onChange={setEndDate} />
          </Stack>

          <TextField
            label={t("floor.form.stage.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              {t("floor.docsTab.photosTitle")}
            </Typography>
            <Stack spacing={1.25}>
              <PhotoGallery relatedType="floor" relatedId={floorId} floorId={floorId} stageId={stage?.id} phase="before" compact />
              <PhotoGallery relatedType="floor" relatedId={floorId} floorId={floorId} stageId={stage?.id} phase="during" compact />
              <PhotoGallery relatedType="floor" relatedId={floorId} floorId={floorId} stageId={stage?.id} phase="after" compact />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("floor.form.stage.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {t("floor.form.stage.save")}
        </Button>
        {stage?.isCustom && onDelete && (
          <Button onClick={onDelete} color="error" disabled={loading}>
            {t("floor.actions.deleteStage")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
