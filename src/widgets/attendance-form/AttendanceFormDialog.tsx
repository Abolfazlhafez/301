import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
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
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { Worker } from "../../entities/Worker";
import { Attendance } from "../../entities/Attendance";
import { WorkerAvatar } from "../worker-form/WorkerAvatar";
import { attendanceApi } from "../../shared/api/attendanceApi";

interface AttendanceFormDialogProps {
  open: boolean;
  worker: Worker | null;
  date: string;
  existingAttendance?: Attendance | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: { checkIn: string | null; checkOut: string | null; note: string | null }) => void;
}

export function AttendanceFormDialog({
  open,
  worker,
  date,
  existingAttendance,
  loading,
  onClose,
  onSubmit,
}: AttendanceFormDialogProps) {
  const { t } = useTranslation();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [suggestionLabel, setSuggestionLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setNote(existingAttendance?.note || "");

    // اگر برای این روز قبلاً رکوردی ثبت شده (در حال ویرایش هستیم)، همان مقادیر واقعی نمایش داده می‌شود.
    if (existingAttendance) {
      setCheckIn(existingAttendance.checkIn || "");
      setCheckOut(existingAttendance.checkOut || "");
      setSuggestionLabel("");
      return;
    }

    // برای یک روز تازه (بدون رکورد قبلی)، ساعت‌ها را به‌صورت خودکار از شیفت ثابت نیرو
    // یا در نبود آن، از آخرین حضور ثبت‌شده‌اش پیشنهاد می‌دهیم تا کاربر مجبور به تایپ دستی نباشد.
    setCheckIn("");
    setCheckOut("");
    setSuggestionLabel("");
    if (!worker?.id) return;

    let cancelled = false;
    attendanceApi.getSuggestedTimes(worker.id).then((suggestion) => {
      if (cancelled) return;
      if (suggestion.checkIn) setCheckIn(suggestion.checkIn);
      if (suggestion.checkOut) setCheckOut(suggestion.checkOut);
      if (suggestion.source === "default-shift") {
        setSuggestionLabel(t("attendance.form.suggestionDefaultShift") as string);
      } else if (suggestion.source === "last-attendance") {
        setSuggestionLabel(t("attendance.form.suggestionLastAttendance") as string);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, existingAttendance, worker?.id, t]);

  function handleSubmit() {
    if (!checkIn && !checkOut) {
      setError(t("attendance.form.validationError") as string);
      return;
    }
    onSubmit({
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      note: note.trim() || null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {t("attendance.form.title")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {worker && (
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <WorkerAvatar
                avatarPhotoId={worker.avatarPhotoId}
                initials={`${worker.firstName.charAt(0)}${worker.lastName.charAt(0)}`}
                size={36}
              />
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {worker.firstName} {worker.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("attendance.form.dateLabel")}: {date}
                </Typography>
              </Box>
            </Stack>
          )}
          {suggestionLabel && (
            <Stack direction="row" alignItems="flex-start" spacing={0.75}>
              <AutoAwesomeIcon fontSize="small" color="primary" sx={{ mt: "2px" }} />
              <Typography variant="caption" color="primary.main">
                {suggestionLabel}
              </Typography>
            </Stack>
          )}
          <TextField
            label={t("attendance.form.checkInLabel")}
            type="time"
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              setSuggestionLabel("");
            }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t("attendance.form.checkOutLabel")}
            type="time"
            value={checkOut}
            onChange={(e) => {
              setCheckOut(e.target.value);
              setSuggestionLabel("");
            }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t("attendance.form.noteLabel")}
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
          {t("attendance.form.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {t("attendance.form.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
