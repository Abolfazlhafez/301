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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { CreateFloorInput, FLOOR_USAGE_TYPES, Floor, FloorUsageType, UpdateFloorInput, FloorStatus, FLOOR_STATUSES, FloorUnitType, FLOOR_UNIT_TYPES } from "../../entities/Floor";

interface FloorFormDialogProps {
  open: boolean;
  floor?: Floor | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateFloorInput | UpdateFloorInput) => void;
}

export function FloorFormDialog({ open, floor, loading, onClose, onSubmit }: FloorFormDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [usageType, setUsageType] = useState<FloorUsageType>("residential");
  const [unitType, setUnitType] = useState<FloorUnitType>("single");
  const [unitCount, setUnitCount] = useState("");
  const [area, setArea] = useState("");
  const [height, setHeight] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<FloorStatus>("not_started");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(floor?.name || "");
      setNumber(floor?.number !== null && floor?.number !== undefined ? String(floor.number) : "");
      setUsageType(floor?.usageType || "residential");
      setUnitType(floor?.unitType || "single");
      setUnitCount(floor?.unitCount !== null && floor?.unitCount !== undefined ? String(floor.unitCount) : "");
      setArea(floor?.area !== null && floor?.area !== undefined ? String(floor.area) : "");
      setHeight(floor?.height !== null && floor?.height !== undefined ? String(floor.height) : "");
      setDescription(floor?.description || "");
      setStatus(floor?.status || "not_started");
      setErrors({});
    }
  }, [open, floor]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t("common.required", { defaultValue: "این فیلد الزامی است." }) as string;
    if (area && (isNaN(Number(area)) || Number(area) < 0)) e.area = t("floor.form.floor.area") as string;
    if (height && (isNaN(Number(height)) || Number(height) < 0)) e.height = t("floor.form.floor.height") as string;
    if (unitType === "multi" && (!unitCount.trim() || isNaN(Number(unitCount)) || Number(unitCount) < 1)) {
      e.unitCount = t("floor.form.floor.unitCountError") as string;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      number: number.trim() ? Number(number) : null,
      usageType,
      area: area.trim() ? Number(area) : null,
      height: height.trim() ? Number(height) : null,
      description: description.trim() || null,
      status,
      unitType,
      unitCount: unitType === "multi" ? Number(unitCount) : null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {floor ? t("floor.form.floor.editTitle") : t("floor.form.floor.addTitle")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            label={t("floor.form.floor.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            placeholder={t("floor.form.floor.namePlaceholder") as string}
            autoFocus
          />
          <TextField
            label={t("floor.form.floor.number")}
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/[^\d-]/g, ""))}
            inputMode="numeric"
          />
          <TextField select label={t("floor.form.floor.usageType")} value={usageType} onChange={(e) => setUsageType(e.target.value as FloorUsageType)}>
            {FLOOR_USAGE_TYPES.map((u) => (
              <MenuItem key={u} value={u}>
                {t(`floor.usageType.${u}`)}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1.5}>
            <TextField
              select
              label={t("floor.form.floor.unitType")}
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as FloorUnitType)}
              fullWidth
            >
              {FLOOR_UNIT_TYPES.map((u) => (
                <MenuItem key={u} value={u}>
                  {t(`floor.unitType.${u}`)}
                </MenuItem>
              ))}
            </TextField>
            {unitType === "multi" && (
              <TextField
                label={t("floor.form.floor.unitCount")}
                value={unitCount}
                onChange={(e) => setUnitCount(e.target.value.replace(/[^\d]/g, ""))}
                error={!!errors.unitCount}
                helperText={errors.unitCount}
                fullWidth
                inputMode="numeric"
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField
              label={t("floor.form.floor.area")}
              value={area}
              onChange={(e) => setArea(e.target.value.replace(/[^\d.]/g, ""))}
              error={!!errors.area}
              helperText={errors.area}
              fullWidth
              inputMode="decimal"
            />
            <TextField
              label={t("floor.form.floor.height")}
              value={height}
              onChange={(e) => setHeight(e.target.value.replace(/[^\d.]/g, ""))}
              fullWidth
              inputMode="decimal"
              error={!!errors.height}
              helperText={errors.height}
            />
          </Stack>
          <TextField select label={t("floor.form.floor.status")} value={status} onChange={(e) => setStatus(e.target.value as FloorStatus)}>
            {FLOOR_STATUSES.map((s) => <MenuItem key={s} value={s}>{t(`floor.status.${s}`)}</MenuItem>)}
          </TextField>
          <TextField
            label={t("floor.form.floor.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("floor.form.floor.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {t("floor.form.floor.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
