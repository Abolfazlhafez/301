import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import PaidIcon from "@mui/icons-material/Paid";
import { groupWagePaymentApi } from "../../shared/api/groupWagePaymentApi";
import { workersApi } from "../../shared/api/workersApi";
import { extractErrorMessage } from "../../shared/api/client";
import { useToast } from "../../shared/components/ToastProvider";
import { EmptyState } from "../../shared/components/EmptyState";
import { AnimatedList } from "../../shared/components/AnimatedList";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { getTodayIso, toJalaliDisplay } from "../../shared/utils/jalaliDate";
import { formatCurrency } from "../../shared/utils/format";
import { useLanguage } from "../../shared/hooks/useLanguage";
import { getCurrencyInfo } from "../../shared/i18n/languages";
import { GroupPaymentSplitCalculator } from "./GroupPaymentSplitCalculator";
import type { WorkerGroup } from "../../entities/WorkerGroup";

interface GroupPaymentsDialogProps {
  open: boolean;
  group: WorkerGroup | null;
  onClose: () => void;
}

/**
 * تاریخچهٔ پرداخت‌های جمعی یک اکیپ + فرم ثبت پرداخت جدید. هر پرداخت یک
 * مبلغ کلی برای کل اکیپ است — نه سرانه — و این دیالوگ عمداً هیچ محاسبه یا
 * نمایشی از «سهم هرکس» ندارد، چون تقسیم مبلغ کاملاً داخلی خود اکیپ است.
 */
export function GroupPaymentsDialog({ open, group, onClose }: GroupPaymentsDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [addFormOpen, setAddFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: payments = [] } = useQuery({
    queryKey: ["group-wage-payments", group?.id],
    queryFn: () => groupWagePaymentApi.listByGroup(group!.id),
    enabled: open && !!group,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-for-groups"],
    queryFn: () => workersApi.list({ isActive: true }),
    enabled: open,
  });

  const members = (group?.memberWorkerIds ?? [])
    .map((id) => workers.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => !!w)
    .map((w) => ({ id: w.id, name: `${w.firstName} ${w.lastName}` }));

  const total = payments.reduce((sum, p) => sum + p.totalAmount, 0);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => groupWagePaymentApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-wage-payments", group?.id] });
      queryClient.invalidateQueries({ queryKey: ["cashbook"] });
      showToast(t("groupPayments.deleted"), "success");
      setDeletingId(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deletingPayment = payments.find((p) => p.id === deletingId) ?? null;

  if (!group) return null;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {t("groupPayments.title", { name: group.name })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("groupPayments.subtitle", { n: group.memberWorkerIds.length, total: formatCurrency(total) })}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label={t("common.close")}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="caption" color="text.secondary">
              {t("groupPayments.intro")}
            </Typography>

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAddFormOpen(true)}
              sx={{ alignSelf: "flex-start" }}
            >
              {t("groupPayments.addNew")}
            </Button>

            {payments.length === 0 ? (
              <EmptyState
                icon={<PaidIcon fontSize="inherit" />}
                title={t("groupPayments.emptyTitle")}
                description={t("groupPayments.emptyDesc")}
              />
            ) : (
              <AnimatedList spacing={1}>
                {payments.map((p) => (
                  <Box
                    key={p.id}
                    sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
                  >
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {p.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {toJalaliDisplay(p.date)}
                          {p.note ? ` — ${p.note}` : ""}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle2" fontWeight={800} color="primary.main" whiteSpace="nowrap">
                        {formatCurrency(p.totalAmount)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="flex-end" mt={0.5}>
                      <Button size="small" color="error" onClick={() => setDeletingId(p.id)}>
                        {t("common.delete")}
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </AnimatedList>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      <AddGroupPaymentDialog
        open={addFormOpen}
        groupId={group.id}
        members={members}
        onClose={() => setAddFormOpen(false)}
      />

      <ConfirmDialog
        open={!!deletingId}
        title={t("groupPayments.deleteTitle")}
        description={
          deletingPayment
            ? t("groupPayments.deleteConfirm", {
                label: deletingPayment.label,
                amount: formatCurrency(deletingPayment.totalAmount),
              })
            : ""
        }
        confirmLabel={t("common.delete")}
        loading={deleteMutation.isPending}
        onCancel={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
      />
    </>
  );
}

interface AddGroupPaymentDialogProps {
  open: boolean;
  groupId: string;
  members: { id: string; name: string }[];
  onClose: () => void;
}

export function AddGroupPaymentDialog({ open, groupId, members, onClose }: AddGroupPaymentDialogProps) {
  const { t } = useTranslation();
  const { currency } = useLanguage();
  const currencySymbol = getCurrencyInfo(currency).symbol;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [label, setLabel] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [date, setDate] = useState(getTodayIso());
  const [note, setNote] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      groupWagePaymentApi.create({
        groupId,
        label: label.trim(),
        totalAmount: Number(totalAmount) || 0,
        date,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-wage-payments", groupId] });
      queryClient.invalidateQueries({ queryKey: ["cashbook"] });
      showToast(t("groupPayments.created"), "success");
      setLabel("");
      setTotalAmount("");
      setNote("");
      setDate(getTodayIso());
      onClose();
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" fontWeight={700}>
          {t("groupPayments.formTitle")}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t("common.close")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            label={t("groupPayments.labelField")}
            placeholder={t("groupPayments.labelPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
          <TextField
            label={t("groupPayments.amountLabel", { symbol: currencySymbol })}
            type="number"
            inputProps={{ min: 0 }}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            helperText={t("groupPayments.amountHelper")}
          />
          <TextField
            label={t("groupPayments.dateLabel")}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField label={t("groupPayments.noteLabel")} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />

          <GroupPaymentSplitCalculator
            members={members}
            totalAmount={Number(totalAmount) || 0}
            onApplyToNote={(text) => setNote((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))}
          />
        </Stack>
      </DialogContent>
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit" disabled={createMutation.isPending}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={() => createMutation.mutate()}
          variant="contained"
          disabled={createMutation.isPending || !label.trim() || !(Number(totalAmount) > 0) || !date}
        >
          {createMutation.isPending ? t("groupPayments.saving") : t("groupPayments.save")}
        </Button>
      </Stack>
    </Dialog>
  );
}
