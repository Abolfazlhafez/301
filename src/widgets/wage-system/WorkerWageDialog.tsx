import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import CalculateIcon from "@mui/icons-material/Calculate";
import HistoryIcon from "@mui/icons-material/History";
import { Worker } from "../../entities/Worker";
import { wageAssignmentApi } from "../../shared/api/wageAssignmentApi";
import { wageMethodApi } from "../../shared/api/wageMethodApi";
import { wageCalculationApi } from "../../shared/api/wageCalculationApi";
import { jobTypeApi } from "../../shared/api/jobTypeApi";
import { reportsApi } from "../../shared/api/dashboardApi";
import { getTodayIso, toJalaliDisplay } from "../../shared/utils/jalaliDate";
import { formatCurrency } from "../../shared/utils/format";
import { useToast } from "../../shared/components/ToastProvider";
import { extractErrorMessage } from "../../shared/api/client";
import { EmptyState } from "../../shared/components/EmptyState";
import { AnimatedList } from "../../shared/components/AnimatedList";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { WageAssignmentFormDialog } from "./WageAssignmentFormDialog";
import { CalculationExplanationDialog } from "./CalculationExplanationDialog";
import { WageCalculationHistoryDialog } from "./WageCalculationHistoryDialog";
import { BUILTIN_WAGE_METHOD_IDS } from "../../core/seedWageMethods";

interface WorkerWageDialogProps {
  open: boolean;
  worker: Worker | null;
  onClose: () => void;
}

/**
 * دیالوگ اصلی مدیریت دستمزد یک نیرو — فهرست «آیتم‌های دستمزد» تعریف‌شده،
 * امکان افزودن آیتم جدید (با روش محاسبهٔ انتخابی)، و برای هر آیتم امکان
 * اجرای یک محاسبهٔ واقعی با فرم داینامیک بر اساس متغیرهای همان روش.
 */
export function WorkerWageDialog({ open, worker, onClose }: WorkerWageDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [assignmentFormOpen, setAssignmentFormOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [calculatingAssignmentId, setCalculatingAssignmentId] = useState<string | null>(null);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);
  const [historyAssignmentId, setHistoryAssignmentId] = useState<string | null>(null);

  const { data: assignments = [] } = useQuery({
    queryKey: ["wage-assignments", worker?.id],
    queryFn: () => wageAssignmentApi.listByWorker(worker!.id, true),
    enabled: open && !!worker,
  });

  const { data: wageMethods = [] } = useQuery({
    queryKey: ["wage-methods"],
    queryFn: () => wageMethodApi.list(),
    enabled: open,
  });

  const { data: jobTypes = [] } = useQuery({
    queryKey: ["job-types"],
    queryFn: () => jobTypeApi.list(),
    enabled: open,
  });

  const methodsById = new Map(wageMethods.map((m) => [m.id, m]));
  const jobType = worker?.jobTypeId ? jobTypes.find((jt) => jt.id === worker.jobTypeId) : null;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wageAssignmentApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wage-assignments", worker?.id] });
      showToast(t("wageDialog.itemDeleted"), "success");
      setDeletingAssignmentId(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const calculatingAssignment = assignments.find((a) => a.id === calculatingAssignmentId) ?? null;
  const editingAssignment = assignments.find((a) => a.id === editingAssignmentId) ?? null;
  const deletingAssignment = assignments.find((a) => a.id === deletingAssignmentId) ?? null;
  const historyAssignment = assignments.find((a) => a.id === historyAssignmentId) ?? null;
  const historyMethod = historyAssignment ? methodsById.get(historyAssignment.wageMethodId) : null;

  if (!worker) return null;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {t("wageDialog.title", { name: `${worker.firstName} ${worker.lastName}` })}
            </Typography>
            {jobType && (
              <Typography variant="caption" color="text.secondary">
                {t("wageDialog.jobLine", { job: jobType.name })}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small" aria-label={t("common.close")}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingAssignmentId(null);
                setAssignmentFormOpen(true);
              }}
              sx={{ alignSelf: "flex-start" }}
            >
              {t("wageDialog.addItem")}
            </Button>

            {assignments.length === 0 ? (
              <EmptyState
                icon={<CalculateIcon fontSize="inherit" />}
                title={t("wageDialog.emptyTitle")}
                description={t("wageDialog.emptyDesc")}
              />
            ) : (
              <AnimatedList spacing={1}>
                {assignments.map((assignment) => {
                  const method = methodsById.get(assignment.wageMethodId);
                  return (
                    <Box
                      key={assignment.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        opacity: assignment.isActive ? 1 : 0.55,
                      }}
                    >
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {assignment.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t("wageDialog.methodLine", { method: method?.formula.name ?? t("wageDialog.unknownMethod") })}
                          </Typography>
                          {!assignment.isActive && (
                            <Chip label={t("wageDialog.inactive")} size="small" sx={{ height: 18, mr: 1 }} />
                          )}
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          startIcon={<CalculateIcon fontSize="small" />}
                          onClick={() => setCalculatingAssignmentId(assignment.id)}
                        >
                          {t("wageDialog.calculate")}
                        </Button>
                        <Button
                          size="small"
                          startIcon={<HistoryIcon fontSize="small" />}
                          onClick={() => setHistoryAssignmentId(assignment.id)}
                        >
                          {t("wageDialog.history")}
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setEditingAssignmentId(assignment.id);
                            setAssignmentFormOpen(true);
                          }}
                        >
                          {t("wageDialog.edit")}
                        </Button>
                        <Button size="small" color="error" onClick={() => setDeletingAssignmentId(assignment.id)}>
                          {t("common.delete")}
                        </Button>
                      </Stack>
                    </Box>
                  );
                })}
              </AnimatedList>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      <WageAssignmentFormDialog
        open={assignmentFormOpen}
        worker={worker}
        jobType={jobType ?? null}
        wageMethods={wageMethods}
        existing={editingAssignment}
        onClose={() => setAssignmentFormOpen(false)}
      />

      {calculatingAssignment && (
        <RunCalculationDialog
          open={!!calculatingAssignmentId}
          worker={worker}
          assignmentId={calculatingAssignment.id}
          assignmentLabel={calculatingAssignment.label}
          methodId={calculatingAssignment.wageMethodId}
          defaultVariableValues={calculatingAssignment.defaultVariableValues}
          onClose={() => setCalculatingAssignmentId(null)}
        />
      )}

      <WageCalculationHistoryDialog
        open={!!historyAssignmentId}
        wageAssignmentId={historyAssignment?.id ?? null}
        assignmentLabel={historyAssignment?.label ?? ""}
        variableDefinitions={historyMethod?.formula.variables ?? []}
        onClose={() => setHistoryAssignmentId(null)}
      />

      <ConfirmDialog
        open={!!deletingAssignmentId}
        title={t("wageDialog.deleteTitle")}
        description={
          deletingAssignment
            ? t("wageDialog.deleteConfirm", { label: deletingAssignment.label })
            : ""
        }
        confirmLabel={t("common.delete")}
        loading={deleteMutation.isPending}
        onCancel={() => setDeletingAssignmentId(null)}
        onConfirm={() => deletingAssignmentId && deleteMutation.mutate(deletingAssignmentId)}
      />
    </>
  );
}

interface RunCalculationDialogProps {
  open: boolean;
  worker: Worker;
  assignmentId: string;
  assignmentLabel: string;
  methodId: string;
  defaultVariableValues: Record<string, number>;
  onClose: () => void;
}

/**
 * فرم اجرای یک محاسبهٔ واقعی برای یک آیتم دستمزد — فرم کاملاً داینامیک است
 * (بر اساس متغیرهای همان روش محاسبه ساخته می‌شود)، پیش‌نمایش زنده دارد، و
 * برای روش «دقیقه‌ای» به‌طور خودکار زمان مفید واقعی همان روز را از سیستم
 * حضور و غیاب کارگاه‌یار پیشنهاد می‌دهد.
 */
export function RunCalculationDialog({
  open,
  worker,
  assignmentId,
  assignmentLabel,
  methodId,
  defaultVariableValues,
  onClose,
}: RunCalculationDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [date, setDate] = useState(getTodayIso());
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [explanationOpen, setExplanationOpen] = useState(false);

  const { data: method } = useQuery({
    queryKey: ["wage-method", methodId],
    queryFn: () => wageMethodApi.findByIdOrNull(methodId),
    enabled: open,
  });

  const isPerMinuteMethod = methodId === BUILTIN_WAGE_METHOD_IDS.perMinute;

  const { data: dailyReport } = useQuery({
    queryKey: ["daily-report", worker.id, date],
    queryFn: () => reportsApi.dailyForWorker(worker.id, date),
    enabled: open && isPerMinuteMethod,
  });

  useEffect(() => {
    if (!open || !method) return;
    const initial: Record<string, string> = {};
    for (const v of method.formula.variables) {
      initial[v.key] = String(defaultVariableValues[v.key] ?? v.defaultValue);
    }
    setValues(initial);
    setDate(getTodayIso());
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method]);

  // اگر روش «دقیقه‌ای» بود و گزارش روزانهٔ واقعی رسید، مقدار «minutes» را با
  // زمان مفید واقعی همان روز پر می‌کنیم — دقیقاً همان اتصال به حضور و غیاب
  // که طبق نیاز درخواست شده بود. کاربر همچنان می‌تواند این مقدار را دستی تغییر دهد.
  useEffect(() => {
    if (isPerMinuteMethod && dailyReport) {
      setValues((prev) => ({ ...prev, minutes: String(dailyReport.usefulMinutes) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyReport]);

  const numericValues = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v) || 0]));

  const { data: preview } = useQuery({
    queryKey: ["wage-preview", assignmentId, numericValues],
    queryFn: () => wageCalculationApi.preview(assignmentId, numericValues),
    enabled: open && !!method,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      wageCalculationApi.calculateAndSave({
        workerId: worker.id,
        wageAssignmentId: assignmentId,
        date,
        variableValues: numericValues,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wage-calculations", worker.id] });
      showToast(t("wageDialog.calcSaved"), "success");
      onClose();
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  if (!method) return null;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" fontWeight={700}>
            {t("wageDialog.calcTitle", { label: assignmentLabel })}
          </Typography>
          <IconButton onClick={onClose} size="small" aria-label={t("common.close")}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <TextField
              label={t("wageDialog.dateLabel")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            {isPerMinuteMethod && dailyReport && (
              <Typography variant="caption" color="text.secondary">
                {t("wageDialog.usefulTimeHint", { date: toJalaliDisplay(date), minutes: dailyReport.usefulMinutes })}
              </Typography>
            )}

            {method.formula.variables.map((v) => (
              <TextField
                key={v.key}
                label={`${v.label} (${v.unit})`}
                type="number"
                inputProps={{ min: 0 }}
                value={values[v.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [v.key]: e.target.value }))}
              />
            ))}

            <TextField label={t("wageDialog.noteLabel")} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />

            {preview && !preview.error && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    {t("wageDialog.computedAmount")}
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={800} color="primary.main">
                    {formatCurrency(preview.value)}
                  </Typography>
                </Stack>
                <Button size="small" onClick={() => setExplanationOpen(true)} sx={{ mt: 0.5 }}>
                  {t("wageDialog.viewExplanation")}
                </Button>
              </Box>
            )}
            {preview?.error && (
              <Typography variant="caption" color="error">
                {preview.error}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} color="inherit" disabled={saveMutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            variant="contained"
            disabled={saveMutation.isPending || !preview || !!preview.error}
          >
            {saveMutation.isPending ? t("wageDialog.saving") : t("wageDialog.saveCalc")}
          </Button>
        </Stack>
      </Dialog>

      {preview && (
        <CalculationExplanationDialog
          open={explanationOpen}
          onClose={() => setExplanationOpen(false)}
          formulaText={preview.formulaText}
          variables={method.formula.variables}
          variableValues={numericValues}
          steps={preview.steps}
          finalAmount={preview.value}
          error={preview.error}
        />
      )}
    </>
  );
}
