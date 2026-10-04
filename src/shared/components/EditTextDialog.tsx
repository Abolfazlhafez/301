import { useEffect, useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import HistoryIcon from "@mui/icons-material/History";

interface EditTextDialogProps {
  open: boolean;
  title: string;
  label: string;
  initialValue: string;
  multiline?: boolean;
  saving?: boolean;
  /**
   * متن پیشنهادی از یک منبع قبلی (مثلاً توضیحات آخرین روزی که برای آن
   * یادداشت ثبت شده). فقط وقتی initialValue خالی است نمایش داده می‌شود —
   * تا هرگز جایگزین متنی که کاربر واقعاً همان روز نوشته نشود. کاملاً
   * اختیاری و برای استفاده‌های قبلی این دیالوگ (که این پراپ را نمی‌دهند)
   * بدون تغییر رفتار باقی می‌ماند.
   */
  suggestion?: string;
  suggestionLabel?: string;
  onClose: () => void;
  onSave: (value: string) => void;
}

/**
 * دیالوگ عمومی ویرایش یک متن (مثلاً توضیح عکس، یادداشت سرپرست و ...).
 * هر بار که با مقدار اولیه جدید باز می‌شود، فیلد را با همان مقدار همگام می‌کند.
 */
export function EditTextDialog({
  open,
  title,
  label,
  initialValue,
  multiline = true,
  saving = false,
  suggestion,
  suggestionLabel,
  onClose,
  onSave,
}: EditTextDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const showSuggestion = open && !!suggestion && value.trim() === "";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline={multiline}
          minRows={multiline ? 3 : 1}
          label={label}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          sx={{ mt: 1 }}
        />
        {showSuggestion && (
          <Box sx={{ mt: 1 }}>
            <Chip
              icon={<HistoryIcon fontSize="small" />}
              size="small"
              variant="outlined"
              label={suggestionLabel ?? (t("common.usePreviousText") as string)}
              onClick={() => setValue(suggestion!)}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button variant="contained" onClick={() => onSave(value)} disabled={saving}>
          {t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
