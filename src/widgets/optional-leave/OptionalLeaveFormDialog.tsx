import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { OptionalLeave, OptionalLeaveType, OPTIONAL_LEAVE_TYPE_LABELS } from "../../entities/OptionalLeave";

interface OptionalLeaveFormDialogProps {
  open: boolean;
  workerName?: string;
  dateLabel?: string;
  existing?: OptionalLeave | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: { type: OptionalLeaveType; isPaid: boolean; note: string | null }) => void;
}

const LEAVE_TYPES = Object.keys(OPTIONAL_LEAVE_TYPE_LABELS) as OptionalLeaveType[];

/**
 * ثبت/ویرایش «غیبت مجاز» برای یک نیرو در یک روز مشخص — کاملاً مستقل از
 * سیستم حضور و غیاب عادی، چون این‌جا اصلاً حضوری در کار رخ نداده.
 *
 * نکته دربارهٔ ترجمه: این دیالوگ برچسب نوع غیبت را از کلیدهای ترجمهٔ محلی
 * (`optionalLeave.type.*`) می‌خواند، نه مستقیماً از
 * `OPTIONAL_LEAVE_TYPE_LABELS` (که فارسی هاردکد است) — چون آن ثابت هنوز در
 * چند فایل دیگر (AttendancePage، WorkReportBuilderDialog،
 * WorkLogDayEntries) که کلاً ترجمه نشده‌اند استفاده می‌شود؛ عمداً دست‌نخورده
 * نگه داشته شده تا وقتی آن فایل‌ها هم ترجمه شوند، همه یک‌جا و هماهنگ به
 * کلید ترجمه سوییچ کنند.
 */
export function OptionalLeaveFormDialog({
  open,
  workerName,
  dateLabel,
  existing,
  loading,
  onClose,
  onSubmit,
}: OptionalLeaveFormDialogProps) {
  const { t } = useTranslation();
  const typeLabels: Record<OptionalLeaveType, string> = {
    sick: t("optionalLeave.type.sick"),
    personal: t("optionalLeave.type.personal"),
    mission: t("optionalLeave.type.mission"),
    unpaid: t("optionalLeave.type.unpaid"),
    other: t("optionalLeave.type.other"),
  };
  const [type, setType] = useState<OptionalLeaveType>("personal");
  const [isPaid, setIsPaid] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setType(existing?.type ?? "personal");
      setIsPaid(existing?.isPaid ?? false);
      setNote(existing?.note ?? "");
    }
  }, [open, existing]);

  function handleSubmit() {
    onSubmit({ type, isPaid, note: note.trim() || null });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" fontWeight={700}>
          {existing ? t("optionalLeave.editTitle") : t("optionalLeave.createTitle")}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {(workerName || dateLabel) && (
            <Typography variant="body2" color="text.secondary">
              {workerName} {dateLabel ? `— ${dateLabel}` : ""}
            </Typography>
          )}
          <TextField select label={t("optionalLeave.typeLabel")} value={type} onChange={(e) => setType(e.target.value as OptionalLeaveType)}>
            {LEAVE_TYPES.map((leaveType) => (
              <MenuItem key={leaveType} value={leaveType}>
                {typeLabels[leaveType]}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={<Switch checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />}
            label={t("optionalLeave.isPaidLabel") as string}
          />
          <TextField
            label={t("optionalLeave.noteLabel")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("optionalLeave.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? t("optionalLeave.saving") : t("optionalLeave.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
