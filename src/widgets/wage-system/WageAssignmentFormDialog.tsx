import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Worker } from "../../entities/Worker";
import type { JobType, WageMethod } from "../../entities/JobType";
import type { WageAssignment } from "../../entities/WageAssignment";
import { wageAssignmentApi } from "../../shared/api/wageAssignmentApi";
import { useToast } from "../../shared/components/ToastProvider";
import { extractErrorMessage } from "../../shared/api/client";

interface WageAssignmentFormDialogProps {
  open: boolean;
  worker: Worker;
  jobType: JobType | null;
  wageMethods: WageMethod[];
  existing?: WageAssignment | null;
  onClose: () => void;
}

/**
 * دیالوگ افزودن/ویرایش یک آیتم دستمزد. اگر نیرو یک شغل تعریف‌شده داشته
 * باشد، روش‌های پیشنهادی همان شغل بالای فهرست و با یک برچسب «پیشنهادی»
 * نمایش داده می‌شوند — دقیقاً طبق نیاز («بعد از انتخاب بنا، روش‌های
 * پیشنهادی پرداخت آن نمایش داده شود») — ولی کاربر می‌تواند هر روش دیگری
 * را هم آزادانه انتخاب کند.
 */
export function WageAssignmentFormDialog({
  open,
  worker,
  jobType,
  wageMethods,
  existing,
  onClose,
}: WageAssignmentFormDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [label, setLabel] = useState("");
  const [methodId, setMethodId] = useState("");
  const [defaultValues, setDefaultValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setLabel(existing?.label ?? "");
    setMethodId(existing?.wageMethodId ?? "");
    if (existing) {
      setDefaultValues(Object.fromEntries(Object.entries(existing.defaultVariableValues).map(([k, v]) => [k, String(v)])));
    } else {
      setDefaultValues({});
    }
  }, [open, existing]);

  const selectedMethod = wageMethods.find((m) => m.id === methodId) ?? null;

  // وقتی روش عوض می‌شود، مقادیر پیش‌فرض بر اساس متغیرهای همان روش بازسازی
  // می‌شود (مقادیر قبلی برای متغیرهای مشترک حفظ می‌شوند، بقیه صفر).
  useEffect(() => {
    if (!selectedMethod) return;
    setDefaultValues((prev) => {
      const next: Record<string, string> = {};
      for (const v of selectedMethod.formula.variables) {
        next[v.key] = prev[v.key] ?? "0";
      }
      return next;
    });
  }, [selectedMethod]);

  const suggestedIds = new Set(jobType?.suggestedWageMethodIds ?? []);
  const suggestedMethods = wageMethods.filter((m) => suggestedIds.has(m.id));
  const otherMethods = wageMethods.filter((m) => !suggestedIds.has(m.id));

  const mutation = useMutation({
    mutationFn: () => {
      const numericValues = Object.fromEntries(Object.entries(defaultValues).map(([k, v]) => [k, Number(v) || 0]));
      if (existing) {
        return wageAssignmentApi.update(existing.id, { label: label.trim(), wageMethodId: methodId, defaultVariableValues: numericValues });
      }
      return wageAssignmentApi.create({ workerId: worker.id, wageMethodId: methodId, label: label.trim(), defaultVariableValues: numericValues });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wage-assignments", worker.id] });
      showToast(existing ? t("wageAssignmentForm.updated") : t("wageAssignmentForm.created"), "success");
      onClose();
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const canSubmit = !!label.trim() && !!methodId;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" fontWeight={700}>
          {existing ? t("wageAssignmentForm.titleEdit") : t("wageAssignmentForm.titleAdd")}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t("common.close")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            label={t("wageAssignmentForm.labelField")}
            placeholder={t("wageAssignmentForm.labelPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />

          <TextField select label={t("wageAssignmentForm.methodField")} value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            {suggestedMethods.length > 0 && [
              <MenuItem key="suggested-header" disabled sx={{ opacity: "1 !important", fontWeight: 700, fontSize: "0.75rem" }}>
                {t("wageAssignmentForm.suggestedHeader", { job: jobType?.name ?? "" })}
              </MenuItem>,
              ...suggestedMethods.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.formula.name}
                </MenuItem>
              )),
            ]}
            {otherMethods.length > 0 && [
              <MenuItem key="other-header" disabled sx={{ opacity: "1 !important", fontWeight: 700, fontSize: "0.75rem" }}>
                {t("wageAssignmentForm.otherHeader")}
              </MenuItem>,
              ...otherMethods.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.formula.name}
                </MenuItem>
              )),
            ]}
          </TextField>

          {selectedMethod && (
            <Typography variant="caption" color="text.secondary">
              {selectedMethod.formula.description}
            </Typography>
          )}

          {selectedMethod && selectedMethod.formula.variables.length > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>
                {t("wageAssignmentForm.defaultsTitle")}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                {t("wageAssignmentForm.defaultsHelp")}
              </Typography>
              {selectedMethod.formula.variables.map((v) => (
                <TextField
                  key={v.key}
                  label={`${v.label} (${v.unit})`}
                  type="number"
                  inputProps={{ min: 0 }}
                  value={defaultValues[v.key] ?? ""}
                  onChange={(e) => setDefaultValues((prev) => ({ ...prev, [v.key]: e.target.value }))}
                  size="small"
                />
              ))}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={() => mutation.mutate()} variant="contained" disabled={mutation.isPending || !canSubmit}>
          {mutation.isPending ? t("wageAssignmentForm.saving") : t("wageAssignmentForm.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
