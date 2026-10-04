import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import HistoryIcon from "@mui/icons-material/History";
import { wageCalculationApi } from "../../shared/api/wageCalculationApi";
import { getHistoryDayLabel, toJalaliDisplay } from "../../shared/utils/jalaliDate";
import { formatCurrency } from "../../shared/utils/format";
import { useToast } from "../../shared/components/ToastProvider";
import { extractErrorMessage } from "../../shared/api/client";
import { EmptyState } from "../../shared/components/EmptyState";
import { LoadingState } from "../../shared/components/LoadingState";
import { AnimatedList } from "../../shared/components/AnimatedList";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import type { WageCalculationRecord } from "../../entities/WageAssignment";
import type { WageVariableDefinition } from "../../core/wageFormula";
import { CalculationExplanationDialog } from "./CalculationExplanationDialog";

interface WageCalculationHistoryDialogProps {
  open: boolean;
  wageAssignmentId: string | null;
  assignmentLabel: string;
  /** برای بازسازی برچسب/واحد متغیرها در نمایش «نحوه محاسبه» یک رکورد قدیمی — ممکن است روش دستمزد بعداً تغییر کرده باشد، بنابراین این‌ها همان تعریف فعلی روش‌اند و صرفاً برای نام‌گذاری بهتر مقادیر استفاده می‌شوند، نه برای اجرای دوبارهٔ فرمول. */
  variableDefinitions: WageVariableDefinition[];
  onClose: () => void;
}

/**
 * تاریخچهٔ محاسبات ثبت‌شدهٔ یک آیتم دستمزد. هر ردیف مستقیماً از
 * WageCalculationRecord خوانده می‌شود — یعنی حتی اگر خودِ روش دستمزد بعداً
 * ویرایش یا حذف شود، این تاریخچه دست‌نخورده و قابل‌فهم باقی می‌ماند، چون
 * formulaSnapshot و مقادیر واقعی همان لحظهٔ محاسبه در خودِ رکورد ذخیره شده‌اند
 * (نه به‌صورت رفرنس به روش فعلی).
 */
export function WageCalculationHistoryDialog({
  open,
  wageAssignmentId,
  assignmentLabel,
  variableDefinitions,
  onClose,
}: WageCalculationHistoryDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [explainingRecord, setExplainingRecord] = useState<WageCalculationRecord | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["wage-calculations", "by-assignment", wageAssignmentId],
    queryFn: () => wageCalculationApi.listByAssignment(wageAssignmentId!),
    enabled: open && !!wageAssignmentId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wageCalculationApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wage-calculations", "by-assignment", wageAssignmentId] });
      queryClient.invalidateQueries({ queryKey: ["wage-calculations"] });
      showToast(t("wageHistory.deleted"), "success");
      setDeletingRecordId(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const totalAmount = records.reduce((sum, r) => sum + r.payableAmount, 0);
  const deletingRecord = records.find((r) => r.id === deletingRecordId) ?? null;

  // برچسب/واحد هر متغیر برای نمایش بهتر در فهرست («طول: ۲۰ متر» به‌جای «length: 20»).
  const variableLabelByKey = Object.fromEntries(variableDefinitions.map((v) => [v.key, v]));

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {t("wageHistory.title")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {assignmentLabel}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label={t("common.close")}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {isLoading && <LoadingState message={t("wageHistory.loading")} />}

          {!isLoading && records.length === 0 && (
            <EmptyState
              icon={<HistoryIcon fontSize="inherit" />}
              title={t("wageHistory.emptyTitle")}
              description={t("wageHistory.emptyDesc")}
            />
          )}

          {!isLoading && records.length > 0 && (
            <Stack spacing={2}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "action.hover",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t("wageHistory.totalLine", { n: records.length })}
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} color="primary.main">
                  {formatCurrency(totalAmount)}
                </Typography>
              </Box>

              <AnimatedList spacing={1}>
                {records.map((record) => (
                  <Box
                    key={record.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "background.paper",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {getHistoryDayLabel(record.date)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {toJalaliDisplay(record.date)}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                        {formatCurrency(record.payableAmount)}
                      </Typography>
                    </Stack>

                    <Stack direction="row" flexWrap="wrap" gap={0.75} mt={1}>
                      {Object.entries(record.variableValues).map(([key, value]) => {
                        const def = variableLabelByKey[key];
                        return (
                          <Box
                            key={key}
                            sx={{
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              bgcolor: "action.hover",
                              fontSize: "0.75rem",
                            }}
                          >
                            {def?.label ?? key}: {value} {def?.unit ?? ""}
                          </Box>
                        );
                      })}
                    </Stack>

                    {record.note && (
                      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                        {t("wageHistory.note", { note: record.note })}
                      </Typography>
                    )}

                    <Stack direction="row" spacing={1} mt={1}>
                      <Button size="small" onClick={() => setExplainingRecord(record)}>
                        {t("wageHistory.viewExplanation")}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteOutlineIcon fontSize="small" />}
                        onClick={() => setDeletingRecordId(record.id)}
                      >
                        {t("common.delete")}
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </AnimatedList>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* توضیح یک رکورد گذشته: از formulaSnapshot و مقادیر ذخیره‌شدهٔ همان رکورد
          استفاده می‌کند، نه از فرمول فعلی روش دستمزد — چون فرمول ممکن است از آن
          زمان تغییر کرده باشد و این تاریخچه باید دقیقاً همان محاسبهٔ اصلی را نشان دهد. */}
      {explainingRecord && (
        <CalculationExplanationDialog
          open={!!explainingRecord}
          onClose={() => setExplainingRecord(null)}
          formulaText={explainingRecord.formulaSnapshot}
          variables={variableDefinitions}
          variableValues={explainingRecord.variableValues}
          steps={[]}
          finalAmount={explainingRecord.payableAmount}
          error={null}
        />
      )}

      <ConfirmDialog
        open={!!deletingRecordId}
        title={t("wageHistory.deleteTitle")}
        description={
          deletingRecord
            ? t("wageHistory.deleteConfirm", {
                amount: formatCurrency(deletingRecord.payableAmount),
                date: toJalaliDisplay(deletingRecord.date),
              })
            : ""
        }
        confirmLabel={t("common.delete")}
        loading={deleteMutation.isPending}
        onCancel={() => setDeletingRecordId(null)}
        onConfirm={() => deletingRecordId && deleteMutation.mutate(deletingRecordId)}
      />
    </>
  );
}
