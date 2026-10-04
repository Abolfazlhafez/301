import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import { GuardShift } from "../../entities/GuardShift";

interface GuardShiftFormDialogProps {
  open: boolean;
  workerName?: string;
  editingShift?: GuardShift | null;
  /**
   * ساعت شروع/پایان آخرین نوبت ثبت‌شدهٔ همین نیرو قبل از این تاریخ — فقط
   * هنگام ثبت نوبت تازه (نه ویرایش) و وقتی فیلدها هنوز خالی‌اند به‌صورت یک
   * پیشنهاد قابل‌لمس نشان داده می‌شود؛ چون نوبت‌های نگهبانی معمولاً هر شب
   * ساعت ثابتی دارند، این کار از تایپ تکراری هر بار جلوگیری می‌کند.
   */
  previousShift?: { startTime: string; endTime: string };
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: { startTime: string; endTime: string; note: string | null }) => void;
}

/**
 * ثبت/ویرایش یک نوبت نگهبانی. زمان‌ها به‌صورت دستی وارد می‌شوند (HH:mm)؛ اگر
 * ساعت پایان از ساعت شروع کوچک‌تر باشد، محاسبه مدت به‌صورت خودکار فرض می‌کند
 * نوبت از نیمه‌شب رد شده است (مناسب نگهبانی شبانه).
 */
export function GuardShiftFormDialog({
  open,
  workerName,
  editingShift,
  previousShift,
  loading,
  onClose,
  onSubmit,
}: GuardShiftFormDialogProps) {
  const { t } = useTranslation();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setStartTime(editingShift?.startTime || "");
      setEndTime(editingShift?.endTime || "");
      setNote(editingShift?.note || "");
      setError("");
    }
  }, [open, editingShift]);

  function handleSubmit() {
    if (!startTime || !endTime) {
      setError(t("guardDuty.formDialog.validationError") as string);
      return;
    }
    onSubmit({ startTime, endTime, note: note.trim() || null });
  }

  const showPreviousShiftSuggestion = open && !editingShift && !!previousShift && !startTime && !endTime;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {editingShift ? t("guardDuty.formDialog.editTitle") : t("guardDuty.formDialog.createTitle")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {workerName && (
            <Typography variant="subtitle2" color="text.secondary">
              {t("guardDuty.formDialog.workerLabel")}: <strong>{workerName}</strong>
            </Typography>
          )}
          {showPreviousShiftSuggestion && (
            <Chip
              icon={<HistoryIcon fontSize="small" />}
              size="small"
              variant="outlined"
              sx={{ alignSelf: "flex-start" }}
              label={t("guardDuty.formDialog.usePreviousShift", {
                start: previousShift!.startTime,
                end: previousShift!.endTime,
              }) as string}
              onClick={() => {
                setStartTime(previousShift!.startTime);
                setEndTime(previousShift!.endTime);
              }}
            />
          )}
          <TextField
            label={t("guardDuty.formDialog.startTimeLabel")}
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t("guardDuty.formDialog.endTimeLabel")}
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText={t("guardDuty.formDialog.endTimeHelper")}
          />
          <TextField
            label={t("guardDuty.formDialog.noteLabel")}
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
          {t("guardDuty.formDialog.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {editingShift ? t("guardDuty.formDialog.saveChanges") : t("guardDuty.formDialog.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
