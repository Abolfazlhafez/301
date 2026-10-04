import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { haptics } from "../utils/haptics";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: "error" | "primary" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmColor = "error",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const finalConfirmLabel = confirmLabel ?? (t("common.confirm") as string);
  const finalCancelLabel = cancelLabel ?? (t("common.cancel") as string);
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onCancel} color="inherit" disabled={loading}>
          {finalCancelLabel}
        </Button>
        <Button
          onClick={() => {
            // لرزش سبک هم‌زمان با خودِ لمس دکمه (نه منتظر نتیجهٔ mutation) تا
            // بازخورد لمسی بی‌درنگ حس شود؛ toast موفقیت/خطا جدا از این، خودش
            // لرزش مخصوص به خودش را دارد.
            haptics.medium();
            onConfirm();
          }}
          color={confirmColor}
          variant="contained"
          disabled={loading}
        >
          {finalConfirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
