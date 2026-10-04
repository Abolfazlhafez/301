import { useEffect, useState } from "react";
import {
  Button,
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
import { TimeLoss } from "../../entities/TimeLoss";

interface TimeLossFormDialogProps {
  open: boolean;
  workerName?: string;
  editingTimeLoss?: TimeLoss | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: { startTime: string; endTime: string; reason: string; note: string | null }) => void;
}

const REASON_SUGGESTIONS = ["استراحت اضافه", "تاخیر در شروع کار", "قطعی برق", "کمبود مصالح", "مشکل ابزار"];

export function TimeLossFormDialog({
  open,
  workerName,
  editingTimeLoss,
  loading,
  onClose,
  onSubmit,
}: TimeLossFormDialogProps) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setStartTime(editingTimeLoss?.startTime || "");
      setEndTime(editingTimeLoss?.endTime || "");
      setReason(editingTimeLoss?.reason || "");
      setNote(editingTimeLoss?.note || "");
      setError("");
    }
  }, [open, editingTimeLoss]);

  function handleSubmit() {
    if (!startTime || !endTime) {
      setError("ساعت شروع و پایان الزامی است.");
      return;
    }
    if (!reason.trim()) {
      setError("علت اتلاف وقت را وارد کنید.");
      return;
    }
    onSubmit({ startTime, endTime, reason: reason.trim(), note: note.trim() || null });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {editingTimeLoss ? "ویرایش اتلاف وقت" : "ثبت اتلاف وقت"}
        <IconButton onClick={onClose} size="small" aria-label="بستن">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {workerName && (
            <Typography variant="subtitle2" color="text.secondary">
              نیرو: <strong>{workerName}</strong>
            </Typography>
          )}
          <TextField
            label="ساعت شروع"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="ساعت پایان"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="علت"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثلا: استراحت اضافه، قطعی برق"
            inputProps={{ list: "reason-suggestions" }}
          />
          <datalist id="reason-suggestions">
            {REASON_SUGGESTIONS.map((r) => (
              <option value={r} key={r} />
            ))}
          </datalist>
          <TextField
            label="توضیح (اختیاری)"
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
          انصراف
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {editingTimeLoss ? "ذخیره تغییرات" : "ثبت"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
