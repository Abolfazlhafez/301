import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PaidIcon from "@mui/icons-material/Paid";
import DeleteIcon from "@mui/icons-material/Delete";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { workersApi } from "../../shared/api/workersApi";
import { ledgerApi } from "../../shared/api/ledgerApi";
import { cashbookApi } from "../../shared/api/cashbookApi";
import { extractErrorMessage } from "../../shared/api/client";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { ExportMenuButton } from "../../shared/components/ExportMenuButton";
import { LedgerEntryFormDialog, ManualLedgerType } from "../../widgets/ledger-form/LedgerEntryFormDialog";
import { formatCurrency } from "../../shared/utils/format";
import { useLanguage } from "../../shared/hooks/useLanguage";
import { getCurrencyInfo } from "../../shared/i18n/languages";
import { getTodayIso, toJalaliShort, toJalaliWithWeekday } from "../../shared/utils/jalaliDate";
import { exportElementAsShareableImage, saveElementAsImageToDevice } from "../../shared/utils/exportCard";
import { exportRowsAsCsv, saveRowsAsCsvToDevice } from "../../shared/utils/exportCsv";
import { WorkerAvatar } from "../../widgets/worker-form/WorkerAvatar";

interface WorkerAccountSectionProps {
  /** وقتی از یک نیروی مشخص (مثلاً از دیالوگ پروفایل نیرو) فراخوانی می‌شود، این
   * نیرو از قبل انتخاب‌شده در نظر گرفته می‌شود و انتخاب‌گر «نیرو را انتخاب
   * کنید» اصلاً نمایش داده نمی‌شود — چون کاربر از قبل یک نیروی مشخص را باز
   * کرده و نیازی به انتخاب دوباره از یک فهرست همهٔ نیروها نیست. */
  fixedWorkerId?: string;
  /** فقط وقتی fixedWorkerId داده شده کاربرد دارد: اگر کاربر همان نیروی ثابت
   * را (بعد از حذف همهٔ سابقه‌اش) واقعاً حذف کند، این کال‌بک صدا زده می‌شود
   * تا مثلاً دیالوگ بیرونی (پروفایل نیرو) بسته شود — چون دیگر نیرویی برای
   * نمایش نیست. */
  onFixedWorkerDeleted?: () => void;
}

export function WorkerAccountSection({ fixedWorkerId, onFixedWorkerDeleted }: WorkerAccountSectionProps = {}) {
  const { t } = useTranslation();
  const { currency } = useLanguage();
  const currencySymbol = getCurrencyInfo(currency).symbol;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const today = getTodayIso();

  const [selectedWorkerId, setSelectedWorkerId] = useState(fixedWorkerId ?? "");

  // اگر این کامپوننت داخل یک دیالوگ نگه‌داشته‌شده (mount ثابت) برای نیروی
  // دیگری دوباره باز شود، selectedWorkerId باید با fixedWorkerId جدید هماهنگ شود.
  useEffect(() => {
    if (fixedWorkerId) setSelectedWorkerId(fixedWorkerId);
  }, [fixedWorkerId]);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [settleConfirmOpen, setSettleConfirmOpen] = useState(false);
  const [recordInCashbook, setRecordInCashbook] = useState(true);
  // پس از حذف یک تراکنش، اگر نیرو دیگر هیچ سابقه‌ای نداشته باشد، این
  // state پر می‌شود تا دیالوگ سوال «آیا خودِ نیرو هم حذف شود؟» نمایش
  // داده شود. این هیچ‌وقت خودکار انجام نمی‌شود — کاملاً اختیاری و به
  // انتخاب کاربر است.
  const [offerDeleteWorker, setOfferDeleteWorker] = useState<{ workerId: string; workerName: string } | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: () => workersApi.list(),
  });

  const {
    data: balance,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["worker-balance", selectedWorkerId, today],
    queryFn: () => ledgerApi.getBalance(selectedWorkerId, today),
    enabled: !!selectedWorkerId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["worker-balance"] });
  }

  function invalidateCashbook() {
    queryClient.invalidateQueries({ queryKey: ["cashbook"] });
    queryClient.invalidateQueries({ queryKey: ["cashbook-summary"] });
  }

  const createMutation = useMutation({
    mutationFn: async (input: {
      type: ManualLedgerType;
      amount: number;
      date: string;
      description: string | null;
      recordInCashbook: boolean;
    }) => {
      const { recordInCashbook: shouldRecord, ...ledgerInput } = input;
      const entry = await ledgerApi.create({ workerId: selectedWorkerId, ...ledgerInput });

      if (shouldRecord) {
        // «مساعده» یک پرداخت حقوق است؛ «کسر دستی» یک هزینه (خرج) است — مثلاً
        // بیمه یا جریمه‌ای که کارگاه از حقوق نیرو کم و خودش پرداخت می‌کند.
        const isDeduction = input.type === "deduction";
        await cashbookApi.create({
          type: isDeduction ? "expense" : "salary",
          title: isDeduction
            ? t("workerAccount.cbDeductionTitle", { name: balance?.workerFullName ?? "" })
            : t("workerAccount.cbAdvanceTitle", { name: balance?.workerFullName ?? "" }),
          amount: input.amount,
          date: input.date,
          description: input.description || t("workerAccount.cbAutoDesc"),
          workerId: selectedWorkerId,
        });
      }
      return entry;
    },
    onSuccess: (_data, variables) => {
      invalidate();
      if (variables.recordInCashbook) invalidateCashbook();
      showToast(
        variables.recordInCashbook
          ? variables.type === "deduction"
            ? t("workerAccount.toastCreatedExpense")
            : t("workerAccount.toastCreatedSalary")
          : t("workerAccount.toastCreated"),
        "success"
      );
      setFormOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ledgerApi.remove(id),
    onSuccess: (result) => {
      invalidate();
      showToast(t("workerAccount.toastDeleted"), "success");
      setDeletingEntryId(null);
      // اگر با حذف این تراکنش، نیرو دیگر هیچ سابقه‌ای نداشت، به‌صورت
      // اختیاری از کاربر می‌پرسیم که آیا خودِ نیرو هم حذف شود. خودِ نیرو
      // هرگز به‌طور خودکار حذف نمی‌شود.
      if (result.workerHasNoRemainingHistory && balance) {
        setOfferDeleteWorker({ workerId: result.workerId, workerName: balance.workerFullName });
      }
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteWorkerMutation = useMutation({
    mutationFn: (id: string) => workersApi.remove(id),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      showToast(t("workerAccount.toastWorkerDeleted"), "success");
      setOfferDeleteWorker(null);
      setSelectedWorkerId("");
      if (fixedWorkerId) onFixedWorkerDeleted?.();
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const settleMutation = useMutation({
    mutationFn: async () => {
      const settledBalance = balance?.balance ?? 0;
      const workerName = balance?.workerFullName ?? "";
      const entry = await ledgerApi.settle(selectedWorkerId, today);

      if (recordInCashbook && settledBalance !== 0) {
        await cashbookApi.create({
          type: settledBalance > 0 ? "salary" : "deposit",
          title:
            settledBalance > 0
              ? t("workerAccount.cbSettlePayTitle", { name: workerName })
              : t("workerAccount.cbSettleReceiveTitle", { name: workerName }),
          amount: Math.abs(settledBalance),
          date: today,
          description: t("workerAccount.cbSettleDesc"),
          workerId: selectedWorkerId,
        });
      }
      return entry;
    },
    onSuccess: () => {
      invalidate();
      if (recordInCashbook) invalidateCashbook();
      showToast(
        recordInCashbook
          ? t("workerAccount.toastSettledCashbook")
          : t("workerAccount.toastSettled"),
        "success"
      );
      setSettleConfirmOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const balanceColor =
    balance && balance.balance > 0 ? "success.main" : balance && balance.balance < 0 ? "error.main" : "text.primary";
  const balanceLabel =
    balance && balance.balance > 0
      ? t("workerAccount.balanceOwedToWorker")
      : balance && balance.balance < 0
      ? t("workerAccount.balanceWorkerOwes")
      : t("workerAccount.balanceSettled");

  // نام فایل خروجی و سرستون‌های CSV از زبان فعلی اپ می‌آیند (تصمیم کاربر).
  const exportFileBase = balance ? `${t("workerAccount.fileBase")}-${balance.workerFullName}-${toJalaliShort(today)}` : "";
  const csvHeaders = [
    t("workerAccount.csvType"),
    t("workerAccount.csvDate"),
    t("workerAccount.csvAmount", { symbol: currencySymbol }),
    t("workerAccount.csvNotes"),
  ];

  // «خروجی عکس» از همان کارت مانده حساب + لیست تراکنش‌های دیده‌شده روی صفحه
  // عکس می‌گیرد — مثلاً برای فرستادن سریع وضعیت حساب یک نیرو در پیام‌رسان.
  async function handleExportImage() {
    if (!printableRef.current || !balance) return;
    try {
      await exportElementAsShareableImage(
        printableRef.current,
        `${exportFileBase}.png`,
        t("workerAccount.shareTitle")
      );
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }

  // «خروجی اکسل» یک CSV از تراکنش‌های دستی این نیرو در همین بازه می‌سازد.
  async function handleExportExcel() {
    if (!balance) return;
    try {
      const rows = balance.entries.map((e) => [
        t(`workerAccount.ledgerType.${e.type}`),
        toJalaliWithWeekday(e.date),
        e.amount,
        e.description ?? "",
      ]);
      await exportRowsAsCsv(csvHeaders, rows, `${exportFileBase}.csv`);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }

  // نسخهٔ «ذخیره در گوشی» همین دو خروجی — بدون بازکردن منوی اشتراک‌گذاری،
  // مستقیماً در پوشهٔ اسناد قابل‌دسترس گوشی نوشته می‌شود.
  async function handleSaveImageToDevice() {
    if (!printableRef.current || !balance) return;
    try {
      await saveElementAsImageToDevice(printableRef.current, `${exportFileBase}.png`);
      showToast(t("workerAccount.toastImageSaved"), "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }

  async function handleSaveExcelToDevice() {
    if (!balance) return;
    try {
      const rows = balance.entries.map((e) => [
        t(`workerAccount.ledgerType.${e.type}`),
        toJalaliWithWeekday(e.date),
        e.amount,
        e.description ?? "",
      ]);
      await saveRowsAsCsvToDevice(csvHeaders, rows, `${exportFileBase}.csv`);
      showToast(t("workerAccount.toastExcelSaved"), "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {!fixedWorkerId && (
        <TextField
          select
          label={t("workerAccount.selectWorker")}
          value={selectedWorkerId}
          onChange={(e) => setSelectedWorkerId(e.target.value)}
          disabled={workersLoading}
          size="small"
        >
          <MenuItem value="" disabled>
            {workersLoading ? t("common.loading") : t("workerAccount.pickWorker")}
          </MenuItem>
          {workers?.map((w) => (
            <MenuItem key={w.id} value={w.id}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <WorkerAvatar
                  avatarPhotoId={w.avatarPhotoId}
                  initials={`${w.firstName.charAt(0)}${w.lastName.charAt(0)}`}
                  size={24}
                />
                <span>
                  {w.firstName} {w.lastName}
                </span>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
      )}

      {!fixedWorkerId && !selectedWorkerId && (
        <EmptyState
          icon={<AccountBalanceWalletIcon fontSize="inherit" />}
          title={t("workerAccount.emptyTitle")}
          description={t("workerAccount.emptyDesc")}
        />
      )}

      {selectedWorkerId && isLoading && <LoadingState />}
      {selectedWorkerId && isError && (
        <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />
      )}

      {balance && (
        <>
          <Stack direction="row" justifyContent="flex-end">
            <ExportMenuButton
              onExportImage={handleExportImage}
              onExportExcel={handleExportExcel}
              onSaveImageToDevice={handleSaveImageToDevice}
              onSaveExcelToDevice={handleSaveExcelToDevice}
            />
          </Stack>

          <Box ref={printableRef} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary">
                  {t("workerAccount.balanceOf", { name: balance.workerFullName })}
                </Typography>
                <Typography variant="h4" fontWeight={800} color={balanceColor} mt={0.5}>
                  {formatCurrency(Math.abs(balance.balance))}
                </Typography>
                <Chip
                  label={balanceLabel}
                  size="small"
                  color={balance.balance > 0 ? "success" : balance.balance < 0 ? "error" : "default"}
                  sx={{ mt: 1 }}
                />

                <Divider sx={{ my: 1.5 }} />

                <Stack spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {t("workerAccount.earnedSince", { date: toJalaliShort(balance.sinceDate) })}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} color="success.main">
                      +{formatCurrency(balance.totalEarned)}
                    </Typography>
                  </Stack>
                  {balance.totalGuardDutyEarned > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {balance.guardDutyMerged ? t("workerAccount.guardDutyMerged") : t("workerAccount.guardDutySeparate")}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ color: balance.guardDutyMerged ? "success.main" : "#7B4FA0" }}
                      >
                        {balance.guardDutyMerged ? "+" : ""}
                        {formatCurrency(balance.totalGuardDutyEarned)}
                      </Typography>
                    </Stack>
                  )}
                  {balance.totalCredits > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {t("workerAccount.credit")}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        +{formatCurrency(balance.totalCredits)}
                      </Typography>
                    </Stack>
                  )}
                  {balance.totalAdvances > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {t("workerAccount.advances")}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="error.main">
                        -{formatCurrency(balance.totalAdvances)}
                      </Typography>
                    </Stack>
                  )}
                  {balance.totalDeductions > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {t("workerAccount.deductions")}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="error.main">
                        -{formatCurrency(balance.totalDeductions)}
                      </Typography>
                    </Stack>
                  )}
                </Stack>

                {balance.lastSettlementDate && (
                  <Typography variant="caption" color="text.disabled" display="block" mt={1.5}>
                    {t("workerAccount.lastSettlement", { date: toJalaliShort(balance.lastSettlementDate) })}
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} mb={1}>
                  {t("workerAccount.entriesTitle")}
                </Typography>
                {balance.entries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t("workerAccount.entriesEmpty")}
                  </Typography>
                ) : (
                  <List disablePadding>
                    {balance.entries.map((entry) => (
                      <ListItem
                        key={entry.id}
                        disableGutters
                        secondaryAction={
                          <IconButton size="small" color="error" onClick={() => setDeletingEntryId(entry.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={t("workerAccount.entryPrimary", {
                            type: t(`workerAccount.ledgerType.${entry.type}`),
                            amount: formatCurrency(entry.amount),
                          })}
                          secondary={`${toJalaliWithWeekday(entry.date)}${entry.description ? " — " + entry.description : ""}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setFormOpen(true)} fullWidth>
              {t("workerAccount.addEntry")}
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<PaidIcon />}
              onClick={() => {
                setRecordInCashbook(true);
                setSettleConfirmOpen(true);
              }}
              disabled={balance.balance === 0}
              fullWidth
            >
              {t("workerAccount.settle")}
            </Button>
          </Stack>

          {balance.balance !== 0 && (
            <Alert severity="info" variant="outlined">
              {t("workerAccount.settleHint")}
            </Alert>
          )}
        </>
      )}

      <LedgerEntryFormDialog
        open={formOpen}
        workerName={balance?.workerFullName}
        loading={createMutation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={(input) => createMutation.mutate(input)}
      />

      <Dialog
        open={settleConfirmOpen}
        onClose={() => !settleMutation.isPending && setSettleConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle fontWeight={700}>{t("workerAccount.settle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {balance
                ? t(balance.balance > 0 ? "workerAccount.settleDescPay" : "workerAccount.settleDescReceive", {
                    amount: formatCurrency(Math.abs(balance.balance)),
                  })
                : ""}
            </Typography>

            {balance && balance.balance !== 0 && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={recordInCashbook}
                    onChange={(e) => setRecordInCashbook(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    {balance.balance > 0
                      ? t("workerAccount.settleCheckPay")
                      : t("workerAccount.settleCheckReceive")}
                  </Typography>
                }
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setSettleConfirmOpen(false)} color="inherit" disabled={settleMutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => settleMutation.mutate()}
            variant="contained"
            disabled={settleMutation.isPending}
          >
            {t("workerAccount.settleConfirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deletingEntryId}
        title={t("workerAccount.deleteTitle")}
        description={t("workerAccount.deleteDesc")}
        confirmLabel={t("common.delete")}
        loading={deleteMutation.isPending}
        onConfirm={() => deletingEntryId && deleteMutation.mutate(deletingEntryId)}
        onCancel={() => setDeletingEntryId(null)}
      />

      {/* پس از حذف تراکنش، اگر نیرو دیگر هیچ سابقه‌ای نداشت، اختیاری
          می‌پرسیم آیا خودِ نیرو هم حذف شود — پیش‌فرض «نه»، کاملاً به
          انتخاب کاربر. */}
      <ConfirmDialog
        open={!!offerDeleteWorker}
        title={t("workerAccount.deleteWorkerTitle")}
        description={
          offerDeleteWorker
            ? t("workerAccount.deleteWorkerDesc", { name: offerDeleteWorker.workerName })
            : ""
        }
        confirmLabel={t("workerAccount.deleteWorkerConfirm")}
        cancelLabel={t("workerAccount.deleteWorkerCancel")}
        loading={deleteWorkerMutation.isPending}
        onConfirm={() => offerDeleteWorker && deleteWorkerMutation.mutate(offerDeleteWorker.workerId)}
        onCancel={() => setOfferDeleteWorker(null)}
      />
    </Box>
  );
}
