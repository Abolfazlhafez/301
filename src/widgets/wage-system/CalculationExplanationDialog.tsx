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
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import type { WageFormulaEvaluationStep, WageVariableDefinition } from "../../core/wageFormula";
import { formatCurrency } from "../../shared/utils/format";
import i18n from "../../shared/i18n";

interface CalculationExplanationDialogProps {
  open: boolean;
  onClose: () => void;
  formulaText: string;
  variables: WageVariableDefinition[];
  variableValues: Record<string, number>;
  steps: WageFormulaEvaluationStep[];
  finalAmount: number;
  error?: string | null;
}

/**
 * ساخت یک جملهٔ توضیحی به زبان ساده از روی مقادیر واقعی وارد‌شده — نه یک
 * متن ثابت. چون فرمول‌ها کاملاً سفارشی‌اند، این تابع به‌جای تلاش برای فهم
 * معنایی فرمول، فقط مقادیر واقعی را در قالب یک جملهٔ خوانا کنار هم می‌گذارد.
 */
function buildPlainLanguageSummary(variables: WageVariableDefinition[], variableValues: Record<string, number>): string {
  const parts = variables
    .filter((v) => (variableValues[v.key] ?? v.defaultValue) !== 0)
    .map((v) => `${v.label}: ${variableValues[v.key] ?? v.defaultValue} ${v.unit}`);
  if (parts.length === 0) return i18n.t("calcExplanation.noValues");
  return i18n.t("calcExplanation.summary", { parts: parts.join(i18n.t("calcExplanation.summarySeparator")) });
}

export function CalculationExplanationDialog({
  open,
  onClose,
  formulaText,
  variables,
  variableValues,
  steps,
  finalAmount,
  error,
}: CalculationExplanationDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" fontWeight={700}>
          {t("calcExplanation.title")}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t("common.close")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {error ? (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          ) : (
            <>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t("calcExplanation.explanationLabel")}
                </Typography>
                <Typography variant="body2">{buildPlainLanguageSummary(variables, variableValues)}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t("calcExplanation.valuesLabel")}
                </Typography>
                <Stack spacing={0.5}>
                  {variables.map((v) => (
                    <Stack key={v.key} direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {v.label}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {variableValues[v.key] ?? v.defaultValue} {v.unit}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>

              {steps.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                    {t("calcExplanation.stepsLabel")}
                  </Typography>
                  <Stack spacing={0.75}>
                    {steps.map((step, index) => (
                      <Stack key={index} direction="row" alignItems="center" spacing={0.75}>
                        <ArrowBackIosNewIcon sx={{ fontSize: 10, color: "text.disabled", transform: "rotate(180deg)" }} />
                        <Typography variant="body2" sx={{ flex: 1 }} dir="ltr" textAlign="left">
                          {step.label}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          {formatCurrency(step.value)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t("calcExplanation.formulaLabel")}
                </Typography>
                <Typography variant="body2" fontFamily="monospace" dir="ltr" textAlign="left">
                  {formulaText}
                </Typography>
              </Box>

              <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t("calcExplanation.resultLabel")}
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="primary.main">
                    {formatCurrency(finalAmount)}
                  </Typography>
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          {t("calcExplanation.gotIt")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
