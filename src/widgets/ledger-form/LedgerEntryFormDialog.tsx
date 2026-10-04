import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import { toPlainDigitsOnly } from "../../shared/utils/format";
import { useLanguage } from "../../shared/hooks/useLanguage";
import { getCurrencyInfo } from "../../shared/i18n/languages";

export type ManualLedgerType = "advance" | "deduction" | "credit";

interface LedgerEntryFormDialogProps {
  open: boolean;
  workerName?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: {
    type: ManualLedgerType;
    amount: number;
    date: string;
    description: string | null;
    recordInCashbook: boolean;
  }) => void;
}

export function LedgerEntryFormDialog({
  open,
  workerName,
  loading,
  onClose,
  onSubmit,
}: LedgerEntryFormDialogProps) {
  const { t } = useTranslation();
  const { currency } = useLanguage();
  const currencySymbol = getCurrencyInfo(currency).symbol;
  const TYPE_OPTIONS: { value: ManualLedgerType; label: string; helper: string; color: "warning" | "error" | "success" }[] = [
    { value: "advance", label: t("ledgerEntry.typeAdvance"), helper: t("ledgerEntry.typeAdvanceHelper"), color: "warning" },
    { value: "deduction", label: t("ledgerEntry.typeDeduction"), helper: t("ledgerEntry.typeDeductionHelper"), color: "error" },
    { value: "credit", label: t("ledgerEntry.typeCredit"), helper: t("ledgerEntry.typeCreditHelper"), color: "success" },
  ];
  const [type, setType] = useState<ManualLedgerType>("advance");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayIso());
  const [description, setDescription] = useState("");
  const [recordInCashbook, setRecordInCashbook] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setType("advance");
      setAmount("");
      setDate(getTodayIso());
      setDescription("");
      setRecordInCashbook(true);
      setError("");
    }
  }, [open]);

  const currentOption = TYPE_OPTIONS.find((o) => o.value === type)!;
  // «مساعده» یعنی پول نقد واقعاً از صندوق به نیرو داده شده (پرداخت حقوق) و
  // «کسر دستی» معمولاً بابت مواردی مثل بیمه/جریمه است که کارگاه از حقوق نیرو
  // کم و خودش به‌عنوان هزینه پرداخت می‌کند؛ پس هر دو روی دفتر حساب اثر دارند.
  // فقط «طلب اضافه» جابجایی نقدی واقعی نیست و نیازی به ثبت در دفتر حساب ندارد.
  const affectsCashbook = type === "advance" || type === "deduction";
  const cashbookCheckboxLabel = type === "advance" ? t("ledgerEntry.cashbookCheckboxAdvance") : t("ledgerEntry.cashbookCheckboxDeduction");

  function handleSubmit() {
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError(t("ledgerEntry.validationError") as string);
      return;
    }
    onSubmit({
      type,
      amount: amt,
      date,
      description: description.trim() || null,
      recordInCashbook: affectsCashbook && recordInCashbook,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {t("ledgerEntry.dialogTitle")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {workerName && (
            <Typography variant="subtitle2" color="text.secondary">
              {t("ledgerEntry.workerLabel")}: <strong>{workerName}</strong>
            </Typography>
          )}

          <ToggleButtonGroup
            value={type}
            exclusive
            onChange={(_, v) => v && setType(v)}
            fullWidth
            size="small"
          >
            {TYPE_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value} color={o.color}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Typography variant="caption" color="text.secondary">
            {currentOption.helper}
          </Typography>

          <TextField
            label={t("ledgerEntry.amountLabel")}
            value={amount}
            onChange={(e) => setAmount(toPlainDigitsOnly(e.target.value))}
            inputMode="numeric"
            InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
          />

          <JalaliDatePicker label={t("ledgerEntry.dateLabel") as string} value={date} onChange={setDate} size="small" />

          <TextField
            label={t("ledgerEntry.descriptionLabel")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />

          {affectsCashbook && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={recordInCashbook}
                  onChange={(e) => setRecordInCashbook(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  {cashbookCheckboxLabel}
                </Typography>
              }
            />
          )}

          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("ledgerEntry.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" color={currentOption.color} disabled={loading}>
          {t("ledgerEntry.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
