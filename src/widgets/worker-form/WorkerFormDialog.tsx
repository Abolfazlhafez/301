import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import SecurityIcon from "@mui/icons-material/Security";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { Worker, CreateWorkerInput, GuardDutyRateType, UpdateWorkerInput } from "../../entities/Worker";
import { jobTypeApi } from "../../shared/api/jobTypeApi";
import { JobTypeIcon } from "../../shared/components/JobTypeIcon";
import { WorkerAvatarPicker, AvatarPickerAction } from "./WorkerAvatarPicker";
import { formatNumber, toPlainDigitsOnly } from "../../shared/utils/format";
import { useLanguage } from "../../shared/hooks/useLanguage";
import { getCurrencyInfo } from "../../shared/i18n/languages";

const MAX_CARD_NUMBERS = 3;
const MAX_SHEBA_NUMBERS = 2;

interface WorkerFormDialogProps {
  open: boolean;
  worker?: Worker | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateWorkerInput | UpdateWorkerInput, avatarAction: AvatarPickerAction) => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  position: string;
  jobTypeId: string | null;
  dailyBaseSalary: string;
  description: string;
  defaultCheckIn: string;
  defaultCheckOut: string;
  guardDutyEnabled: boolean;
  guardDutyRateType: GuardDutyRateType;
  guardDutyRate: string;
  guardDutyMergeWithRegularPay: boolean;
}

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  phoneNumber: "",
  position: "",
  jobTypeId: null,
  dailyBaseSalary: "",
  description: "",
  defaultCheckIn: "",
  defaultCheckOut: "",
  guardDutyEnabled: false,
  guardDutyRateType: "hourly",
  guardDutyRate: "",
  guardDutyMergeWithRegularPay: false,
};

export function WorkerFormDialog({ open, worker, loading, onClose, onSubmit }: WorkerFormDialogProps) {
  const { t, i18n } = useTranslation();
  const { currency } = useLanguage();
  const currencySymbol = getCurrencyInfo(currency).symbol;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [cardNumbers, setCardNumbers] = useState<string[]>([]);
  const [shebaNumbers, setShebaNumbers] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [avatarAction, setAvatarAction] = useState<AvatarPickerAction>({ type: "none" });

  const { data: jobTypes = [] } = useQuery({
    queryKey: ["job-types"],
    queryFn: () => jobTypeApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      if (worker) {
        setForm({
          firstName: worker.firstName,
          lastName: worker.lastName,
          phoneNumber: worker.phoneNumber ?? "",
          position: worker.position,
          jobTypeId: worker.jobTypeId ?? null,
          dailyBaseSalary: String(worker.dailyBaseSalary),
          description: worker.description || "",
          defaultCheckIn: worker.defaultCheckIn ?? "",
          defaultCheckOut: worker.defaultCheckOut ?? "",
          guardDutyEnabled: worker.guardDutyEnabled,
          guardDutyRateType: worker.guardDutyRateType,
          guardDutyRate: worker.guardDutyRate ? String(worker.guardDutyRate) : "",
          guardDutyMergeWithRegularPay: worker.guardDutyMergeWithRegularPay,
        });
        setCardNumbers(worker.cardNumbers && worker.cardNumbers.length > 0 ? worker.cardNumbers : worker.cardNumber ? [worker.cardNumber] : []);
        setShebaNumbers(worker.shebaNumbers ?? []);
      } else {
        setForm(EMPTY_FORM);
        setCardNumbers([]);
        setShebaNumbers([]);
      }
      setAvatarAction({ type: "none" });
      setErrors({});
    }
  }, [open, worker]);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) newErrors.firstName = t("workers.form.errFirstName");
    if (!form.lastName.trim()) newErrors.lastName = t("workers.form.errLastName");
    if (!form.position.trim()) newErrors.position = t("workers.form.errPosition");
    const salaryNum = Number(form.dailyBaseSalary);
    if (!form.dailyBaseSalary || isNaN(salaryNum) || salaryNum < 0) {
      newErrors.dailyBaseSalary = t("workers.form.errSalary");
    }
    if (form.guardDutyEnabled) {
      const rateNum = Number(form.guardDutyRate);
      if (!form.guardDutyRate || isNaN(rateNum) || rateNum < 0) {
        newErrors.guardDutyRate = t("workers.form.errGuardRate");
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit(
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim() || null,
        cardNumbers: cardNumbers.filter(Boolean),
        shebaNumbers: shebaNumbers.filter(Boolean),
        position: form.position.trim(),
        jobTypeId: form.jobTypeId,
        dailyBaseSalary: Number(form.dailyBaseSalary),
        description: form.description.trim() || null,
        defaultCheckIn: form.defaultCheckIn || null,
        defaultCheckOut: form.defaultCheckOut || null,
        guardDutyEnabled: form.guardDutyEnabled,
        guardDutyRateType: form.guardDutyRateType,
        guardDutyRate: form.guardDutyRate ? Number(form.guardDutyRate) : 0,
        guardDutyMergeWithRegularPay: form.guardDutyMergeWithRegularPay,
      },
      avatarAction
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {worker ? t("workers.form.titleEdit") : t("workers.form.titleCreate")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <WorkerAvatarPicker
              resetKey={`${open}-${worker?.id ?? "new"}`}
              persistedAvatarPhotoId={worker?.avatarPhotoId ?? null}
              initials={
                (form.firstName.charAt(0) || "") + (form.lastName.charAt(0) || "") || "?"
              }
              onChange={setAvatarAction}
            />
          </Box>

          <TextField
            label={t("workers.form.firstName")}
            value={form.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            error={!!errors.firstName}
            helperText={errors.firstName}
            autoFocus
          />
          <TextField
            label={t("workers.form.lastName")}
            value={form.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            error={!!errors.lastName}
            helperText={errors.lastName}
          />
          <TextField
            label={t("workers.form.phone")}
            value={form.phoneNumber}
            onChange={(e) => handleChange("phoneNumber", e.target.value)}
            inputMode="tel"
          />

          <Box>
            <Stack direction="row" alignItems="center" spacing={0.75} mb={0.75}>
              <CreditCardIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={700}>
                {t("workers.form.cardsHeading", { max: formatNumber(MAX_CARD_NUMBERS, i18n.language) })}
              </Typography>
            </Stack>
            <Stack spacing={1}>
              {cardNumbers.map((num, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="XXXX XXXX XXXX XXXX"
                    value={num.replace(/(\d{4})(?=\d)/g, "$1 ")}
                    onChange={(e) => {
                      const next = [...cardNumbers];
                      next[idx] = toPlainDigitsOnly(e.target.value).slice(0, 19);
                      setCardNumbers(next);
                    }}
                    inputMode="numeric"
                  />
                  <IconButton
                    size="small"
                    onClick={() => setCardNumbers(cardNumbers.filter((_, i) => i !== idx))}
                    aria-label={t("workers.form.cardRemove")}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              {cardNumbers.length < MAX_CARD_NUMBERS && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setCardNumbers([...cardNumbers, ""])}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {t("workers.form.cardAdd")}
                </Button>
              )}
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" fontWeight={700} mb={0.75}>
              {t("workers.form.shebaHeading", { max: formatNumber(MAX_SHEBA_NUMBERS, i18n.language) })}
            </Typography>
            <Stack spacing={1}>
              {shebaNumbers.map((num, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="XXXXXXXXXXXXXXXXXXXXXXXX"
                    value={num}
                    onChange={(e) => {
                      const next = [...shebaNumbers];
                      next[idx] = toPlainDigitsOnly(e.target.value).slice(0, 24);
                      setShebaNumbers(next);
                    }}
                    inputMode="numeric"
                    InputProps={{ startAdornment: <InputAdornment position="start">IR</InputAdornment> }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setShebaNumbers(shebaNumbers.filter((_, i) => i !== idx))}
                    aria-label={t("workers.form.shebaRemove")}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              {shebaNumbers.length < MAX_SHEBA_NUMBERS && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setShebaNumbers([...shebaNumbers, ""])}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {t("workers.form.shebaAdd")}
                </Button>
              )}
            </Stack>
          </Box>

          <Autocomplete
            options={jobTypes}
            value={jobTypes.find((jt) => jt.id === form.jobTypeId) ?? null}
            onChange={(_, selected) => {
              setForm((prev) => ({
                ...prev,
                jobTypeId: selected?.id ?? null,
                // انتخاب یک تیپ، عنوان سمت را پیش‌فرض پر می‌کند، ولی کاربر
                // می‌تواند بعداً آن را دستی تغییر دهد — چون طبق نیاز، تیپ
                // نیرو و متن نمایشی سمت دو مفهوم مستقل‌اند.
                position: selected ? selected.name : prev.position,
              }));
            }}
            getOptionLabel={(jt) => jt.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderOption={(props, jt) => (
              <Box component="li" {...props} key={jt.id}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <JobTypeIcon iconKey={jt.iconKey} fontSize="small" color="action" />
                  <Typography variant="body2">{jt.name}</Typography>
                </Stack>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("workers.form.jobType")}
                helperText={t("workers.form.jobTypeHelper")}
              />
            )}
          />

          <TextField
            label={t("workers.form.position")}
            value={form.position}
            onChange={(e) => handleChange("position", e.target.value)}
            error={!!errors.position}
            helperText={errors.position}
            placeholder={t("workers.form.positionPlaceholder")}
          />
          <TextField
            label={t("workers.form.dailySalary")}
            value={form.dailyBaseSalary}
            onChange={(e) => handleChange("dailyBaseSalary", toPlainDigitsOnly(e.target.value))}
            error={!!errors.dailyBaseSalary}
            helperText={errors.dailyBaseSalary}
            inputMode="numeric"
            InputProps={{
              endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment>,
            }}
          />
          <TextField
            label={t("workers.form.description")}
            value={form.description}
            onChange={(e) => handleChange("description", e.target.value)}
            multiline
            minRows={2}
          />

          <Divider />

          <Box>
            <Stack direction="row" alignItems="center" spacing={0.75} mb={0.5}>
              <ScheduleIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={700}>
                {t("workers.form.shiftHeading")}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              {t("workers.form.shiftHelp")}
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <TextField
                label={t("workers.form.checkIn")}
                type="time"
                value={form.defaultCheckIn}
                onChange={(e) => handleChange("defaultCheckIn", e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label={t("workers.form.checkOut")}
                type="time"
                value={form.defaultCheckOut}
                onChange={(e) => handleChange("defaultCheckOut", e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Stack direction="row" alignItems="center" spacing={0.75} mb={0.5}>
              <SecurityIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={700}>
                {t("workers.form.guardHeading")}
              </Typography>
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={form.guardDutyEnabled}
                  onChange={(e) => setForm((prev) => ({ ...prev, guardDutyEnabled: e.target.checked }))}
                />
              }
              label={t("workers.form.guardToggle")}
            />

            {form.guardDutyEnabled && (
              <Stack spacing={1.5} mt={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                    {t("workers.form.rateUnit")}
                  </Typography>
                  <ToggleButtonGroup
                    value={form.guardDutyRateType}
                    exclusive
                    onChange={(_, v) => v && setForm((prev) => ({ ...prev, guardDutyRateType: v }))}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="hourly">{t("workers.form.rateHourly")}</ToggleButton>
                    <ToggleButton value="shift">{t("workers.form.rateShift")}</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <TextField
                  label={t(form.guardDutyRateType === "hourly" ? "workers.form.rateLabelHourly" : "workers.form.rateLabelShift", { unit: currencySymbol })}
                  value={form.guardDutyRate}
                  onChange={(e) => handleChange("guardDutyRate", toPlainDigitsOnly(e.target.value))}
                  error={!!errors.guardDutyRate}
                  helperText={errors.guardDutyRate}
                  inputMode="numeric"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment>,
                  }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.guardDutyMergeWithRegularPay}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, guardDutyMergeWithRegularPay: e.target.checked }))
                      }
                    />
                  }
                  label={t("workers.form.merge")}
                />
                <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
                  {t("workers.form.mergeNote")}
                </Alert>
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {worker ? t("workers.form.submitEdit") : t("workers.form.submitCreate")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
