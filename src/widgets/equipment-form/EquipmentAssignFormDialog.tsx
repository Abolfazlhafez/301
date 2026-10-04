import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { EquipmentWithAvailability } from "../../entities/Equipment";
import { Worker } from "../../entities/Worker";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { WorkerAvatar } from "../worker-form/WorkerAvatar";
import { getTodayIso } from "../../shared/utils/jalaliDate";

interface EquipmentAssignFormDialogProps {
  open: boolean;
  equipmentList: EquipmentWithAvailability[];
  workers: Worker[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: { equipmentId: string; workerId: string; quantity: number; assignedDate: string; note: string | null }) => void;
}

export function EquipmentAssignFormDialog({
  open,
  equipmentList,
  workers,
  loading,
  onClose,
  onSubmit,
}: EquipmentAssignFormDialogProps) {
  const { t } = useTranslation();
  const [equipmentId, setEquipmentId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [assignedDate, setAssignedDate] = useState(getTodayIso());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEquipmentId("");
      setWorkerId("");
      setQuantity("1");
      setAssignedDate(getTodayIso());
      setNote("");
      setError("");
    }
  }, [open]);

  const selectedEquipment = equipmentList.find((e) => e.id === equipmentId);

  function handleSubmit() {
    if (!equipmentId || !workerId) {
      setError(t("equipment.assignDialog.selectionRequired") as string);
      return;
    }
    const qty = Number(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      setError(t("equipment.assignDialog.quantityInvalid") as string);
      return;
    }
    if (selectedEquipment && qty > selectedEquipment.availableQuantity) {
      setError(
        t("equipment.assignDialog.insufficientStock", {
          available: selectedEquipment.availableQuantity,
          unit: selectedEquipment.unit,
        }) as string
      );
      return;
    }
    onSubmit({ equipmentId, workerId, quantity: qty, assignedDate, note: note.trim() || null });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {t("equipment.assignDialog.title")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            select
            label={t("equipment.assignDialog.equipmentLabel")}
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
          >
            <MenuItem value="" disabled>
              {t("equipment.assignDialog.selectPlaceholder")}
            </MenuItem>
            {equipmentList.map((eq) => (
              <MenuItem key={eq.id} value={eq.id} disabled={eq.availableQuantity <= 0}>
                {eq.name} — {t("equipment.assignDialog.availableCount", { count: eq.availableQuantity, unit: eq.unit })}
              </MenuItem>
            ))}
          </TextField>

          <TextField select label={t("equipment.assignDialog.workerLabel")} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <MenuItem value="" disabled>
              {t("equipment.assignDialog.selectPlaceholder")}
            </MenuItem>
            {workers.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <WorkerAvatar
                    avatarPhotoId={w.avatarPhotoId}
                    initials={`${w.firstName.charAt(0)}${w.lastName.charAt(0)}`}
                    size={22}
                  />
                  <span>
                    {w.firstName} {w.lastName}
                  </span>
                </Stack>
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label={t("equipment.assignDialog.quantityLabel")}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="numeric"
          />

          <JalaliDatePicker label={t("equipment.assignDialog.dateLabel") as string} value={assignedDate} onChange={setAssignedDate} size="small" />

          <TextField
            label={t("equipment.assignDialog.noteLabel")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
          />

          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("equipment.assignDialog.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {t("equipment.assignDialog.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
