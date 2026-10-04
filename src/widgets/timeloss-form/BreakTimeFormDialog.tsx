import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { BreakTimeType } from "../../entities/BreakTime";
import { breakTimeApi } from "../../shared/api/breakTimeApi";

interface BreakTimeFormDialogProps {
  open: boolean;
  /** برای پیشنهاد ساعت بر اساس آخرین استراحتِ همین نیرو؛ اگر داده نشود، مقدار خالی شروع می‌شود. */
  workerId?: string;
  workerName?: string;
  loading?: boolean;
  /**
   * نوع استراحتی که فرم باید با آن باز شود (مثلاً وقتی «صبحانه سریع» بدون
   * سابقه یا تنظیم پیش‌فرض زده شده و کاربر باید یک‌بار دستی وارد کند).
   * اگر داده نشود، مقدار پیش‌فرض "breakfast" است.
   */
  initialType?: BreakTimeType;
  onClose: () => void;
  onSubmit: (input: { type: BreakTimeType; startTime: string; endTime: string; note: string | null }) => void;
}

export function BreakTimeFormDialog({
  open,
  workerId,
  workerName,
  loading,
  initialType,
  onClose,
  onSubmit,
}: BreakTimeFormDialogProps) {
  const { t } = useTranslation();
  const TYPE_OPTIONS: { value: BreakTimeType; label: string }[] = [
    { value: "breakfast", label: t("breakTime.typeBreakfast") },
    { value: "lunch", label: t("breakTime.typeLunch") },
    { value: "other", label: t("breakTime.typeOther") },
  ];
  const [type, setType] = useState<BreakTimeType>(initialType ?? "breakfast");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // با باز شدن دیالوگ یا تغییر نوع استراحت، ساعت‌ها از روی آخرین رکورد واقعی
  // همین نوع استراحت برای همین نیرو پیشنهاد می‌شوند (نه یک عدد ثابت یکسان
  // برای همه) — همان منطقی که «ثبت سریع» هم استفاده می‌کند؛ فرق اصلی این
  // است که این‌جا فقط پرشدنِ فرم است و کاربر همچنان باید «ثبت استراحت» را
  // بزند تا واقعاً ذخیره شود.
  useEffect(() => {
    if (!open) return;
    setType(initialType ?? "breakfast");
    setNote("");
    setError("");
    setStartTime("");
    setEndTime("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType]);

  useEffect(() => {
    if (!open || type === "other" || !workerId) return;
    let cancelled = false;
    breakTimeApi.getSuggestedTimes(workerId, type).then((suggestion) => {
      if (cancelled) return;
      setStartTime(suggestion.startTime ?? "");
      setEndTime(suggestion.endTime ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [open, type, workerId]);

  function handleSubmit() {
    if (!startTime || !endTime) {
      setError(t("breakTime.validationError") as string);
      return;
    }
    onSubmit({ type, startTime, endTime, note: note.trim() || null });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {t("breakTime.dialogTitle")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {workerName && (
            <Typography variant="subtitle2" color="text.secondary">
              {t("breakTime.workerLabel")}: <strong>{workerName}</strong>
            </Typography>
          )}
          <Typography variant="caption" color="success.main" fontWeight={600}>
            {t("breakTime.legalRightNote")}
          </Typography>

          <ToggleButtonGroup value={type} exclusive onChange={(_, v) => v && setType(v)} fullWidth size="small">
            {TYPE_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {type !== "other" && !startTime && !endTime && workerId && (
            <Typography variant="caption" color="text.secondary">
              {t("breakTime.noHistoryHint")}
            </Typography>
          )}

          <TextField
            label={t("breakTime.startTimeLabel")}
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t("breakTime.endTimeLabel")}
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t("breakTime.noteLabel")}
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
          {t("breakTime.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="success" disabled={loading}>
          {t("breakTime.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
