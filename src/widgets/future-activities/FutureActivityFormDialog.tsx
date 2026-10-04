import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import { formatNumber, toPlainDigitsOnly } from "../../shared/utils/format";
import { workersApi } from "../../shared/api/workersApi";
import { WorkerAvatar } from "../worker-form/WorkerAvatar";
import type {
  ActivityPriority,
  CreateFutureActivityInput,
  FutureActivity,
} from "../../entities/FutureActivity";

interface FutureActivityFormDialogProps {
  open: boolean;
  initialActivity?: FutureActivity | null;
  defaultDate?: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateFutureActivityInput) => void;
}

const MIN_OCCURRENCES = 1;
const MAX_OCCURRENCES = 60;

const PRIORITY_OPTIONS: { value: ActivityPriority; labelKey: string; color: string }[] = [
  { value: "low", labelKey: "futureActivities.priorityLow", color: "#4C9A73" },
  { value: "medium", labelKey: "futureActivities.priorityMedium", color: "#D69A2D" },
  { value: "high", labelKey: "futureActivities.priorityHigh", color: "#D14343" },
];

const FREQUENCY_OPTIONS: { value: "daily" | "weekly" | "monthly"; labelKey: string }[] = [
  { value: "daily", labelKey: "futureActivities.form.freqDaily" },
  { value: "weekly", labelKey: "futureActivities.form.freqWeekly" },
  { value: "monthly", labelKey: "futureActivities.form.freqMonthly" },
];

const SUMMARY_KEYS = {
  daily: "futureActivities.form.summaryDaily",
  weekly: "futureActivities.form.summaryWeekly",
  monthly: "futureActivities.form.summaryMonthly",
} as const;

export function FutureActivityFormDialog({
  open,
  initialActivity,
  defaultDate,
  saving,
  onClose,
  onSubmit,
}: FutureActivityFormDialogProps) {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState(getTodayIso());
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ActivityPriority>("medium");
  const [workerId, setWorkerId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [interval, setInterval_] = useState(1);
  const [occurrences, setOccurrences] = useState(4);
  const [error, setError] = useState("");

  const { data: workers } = useQuery({
    queryKey: ["workers", { isActive: true }],
    queryFn: () => workersApi.list({ isActive: true }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (initialActivity) {
      setDate(initialActivity.date);
      setIsMultiDay(!!initialActivity.endDate && initialActivity.endDate !== initialActivity.date);
      setEndDate(initialActivity.endDate ?? "");
      setTime(initialActivity.time ?? "");
      setTitle(initialActivity.title);
      setDescription(initialActivity.description ?? "");
      setPriority(initialActivity.priority);
      setWorkerId(initialActivity.workerId ?? "");
      setIsRecurring(false); // ویرایش فقط روی همین رخداد اعمال می‌شود
    } else {
      setDate(defaultDate ?? getTodayIso());
      setIsMultiDay(false);
      setEndDate("");
      setTime("");
      setTitle("");
      setDescription("");
      setPriority("medium");
      setWorkerId("");
      setIsRecurring(false);
      setFrequency("weekly");
      setInterval_(1);
      setOccurrences(4);
    }
    setError("");
  }, [open, initialActivity, defaultDate]);

  const isEditMode = !!initialActivity;

  function handleSubmit() {
    if (!title.trim()) {
      setError(t("futureActivities.form.errTitle"));
      return;
    }
    if (isRecurring && (occurrences < MIN_OCCURRENCES || occurrences > MAX_OCCURRENCES)) {
      setError(
        t("futureActivities.form.errOccurrences", {
          min: formatNumber(MIN_OCCURRENCES, i18n.language),
          max: formatNumber(MAX_OCCURRENCES, i18n.language),
        })
      );
      return;
    }
    if (isMultiDay && endDate && endDate < date) {
      setError(t("futureActivities.form.errEndBeforeStart"));
      return;
    }

    onSubmit({
      date,
      endDate: isMultiDay ? endDate || date : null,
      time: time || null,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      workerId: workerId || null,
      recurrence: isRecurring ? { frequency, interval, occurrences } : null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {isEditMode ? t("futureActivities.form.titleEdit") : t("futureActivities.form.titleCreate")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} mt={0.5}>
          <TextField
            label={t("futureActivities.form.titleField")}
            placeholder={t("futureActivities.form.titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            autoFocus
          />

          <TextField
            label={t("futureActivities.form.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          {/* تاریخ و ساعت به‌صورت عمودی زیر هم — قرارگرفتن کنار هم باعث می‌شد
              مجموع عرض سه‌تایی روز/ماه/سال + فیلد ساعت از عرض دیالوگ در
              موبایل بیشتر شود و بیرون بزند (ریشهٔ باگ گزارش‌شده). */}
          <Box sx={{ flex: 1 }}>
            <JalaliDatePicker
              label={t(isMultiDay ? "futureActivities.form.dateStart" : "futureActivities.form.dateDone")}
              value={date}
              onChange={(v) => {
                setDate(v);
                // اگر پایان از شروع جدید عقب‌تر افتاد، پایان را هم همراه شروع جلو می‌بریم
                // تا فعالیت هیچ‌وقت با «پایان قبل از شروع» نامعتبر باقی نماند.
                if (isMultiDay && endDate && endDate < v) setEndDate(v);
              }}
              size="small"
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={isMultiDay}
                onChange={(e) => {
                  setIsMultiDay(e.target.checked);
                  if (e.target.checked && !endDate) setEndDate(date);
                }}
              />
            }
            label={t("futureActivities.form.multiDay")}
          />
          {isMultiDay && (
            <Box sx={{ flex: 1 }}>
              <JalaliDatePicker label={t("futureActivities.form.dateEnd")} value={endDate || date} onChange={setEndDate} size="small" />
            </Box>
          )}

          <TextField
            label={t("futureActivities.form.time")}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            fullWidth
          />

          <TextField
            select
            label={t("futureActivities.form.worker")}
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            size="small"
            fullWidth
          >
            <MenuItem value="">
              <em>{t("futureActivities.form.workerNone")}</em>
            </MenuItem>
            {workers?.map((w) => (
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

          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              {t("futureActivities.form.priority")}
            </Typography>
            <ToggleButtonGroup
              value={priority}
              exclusive
              onChange={(_, v) => v && setPriority(v)}
              size="small"
              fullWidth
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <ToggleButton key={opt.value} value={opt.value} sx={{ gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: opt.color }} />
                  {t(opt.labelKey)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {!isEditMode && (
            <Box>
              <FormControlLabel
                control={<Switch checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />}
                label={t("futureActivities.form.recurring")}
              />
              {isRecurring && (
                <Stack spacing={1.5} mt={1}>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      select
                      label={t("futureActivities.form.frequency")}
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                      size="small"
                      fullWidth
                    >
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label={t("futureActivities.form.interval")}
                      value={interval === 0 ? "" : String(interval)}
                      onChange={(e) => {
                        const digits = toPlainDigitsOnly(e.target.value);
                        setInterval_(digits ? Math.max(1, Number(digits)) : 1);
                      }}
                      inputMode="numeric"
                      size="small"
                      sx={{ width: 90 }}
                    />
                  </Stack>
                  <TextField
                    label={t("futureActivities.form.occurrences", { max: formatNumber(MAX_OCCURRENCES, i18n.language) })}
                    value={occurrences === 0 ? "" : String(occurrences)}
                    onChange={(e) => {
                      const digits = toPlainDigitsOnly(e.target.value);
                      setOccurrences(digits ? Math.min(MAX_OCCURRENCES, Math.max(MIN_OCCURRENCES, Number(digits))) : 1);
                    }}
                    inputMode="numeric"
                    size="small"
                  />
                  <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
                    {t(SUMMARY_KEYS[frequency], {
                      times: formatNumber(occurrences, i18n.language),
                      interval: formatNumber(interval, i18n.language),
                    })}
                  </Alert>
                </Stack>
              )}
            </Box>
          )}

          {error && (
            <Alert severity="error" variant="outlined" sx={{ py: 0 }}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          {saving
            ? t("futureActivities.form.saving")
            : isEditMode
              ? t("futureActivities.form.submitEdit")
              : t("futureActivities.form.submitCreate")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
