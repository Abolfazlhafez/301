import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import { useFormDraft } from "../../shared/hooks/useFormDraft";
import { usePhotoPicker } from "../../shared/hooks/usePhotoPicker";
import { CashbookEntry, CashbookEntryType } from "../../entities/Cashbook";
import { CashboxFund } from "../../entities/CashboxFund";
import { Worker } from "../../entities/Worker";
import { WorkerAvatar } from "../worker-form/WorkerAvatar";
import { formatCurrency, toPlainDigitsOnly } from "../../shared/utils/format";
import { useLanguage } from "../../shared/hooks/useLanguage";
import { getCurrencyInfo } from "../../shared/i18n/languages";

const TYPE_OPTIONS: { value: CashbookEntryType; color: "error" | "warning" | "success" }[] = [
  { value: "expense", color: "error" },
  { value: "salary", color: "warning" },
  { value: "deposit", color: "success" },
];

const AMOUNT_PRESETS = [100_000, 500_000, 1_000_000, 5_000_000];

export interface CashbookFormValues {
  type: CashbookEntryType;
  title: string;
  amount: number;
  date: string;
  description: string | null;
  fundId: string;
  workerId: string | null;
  /**
   * undefined = بدون تغییر در ویرایش (عکس فعلی، اگر باشد، دست‌نخورده می‌ماند)
   * File     = عکس جدید جایگزین می‌شود (یا در ساخت، اولین‌بار آپلود می‌شود)
   * null     = عکس فعلی صراحتاً حذف می‌شود (کاربر روی «حذف عکس» زده است)
   */
  receiptFile?: File | null;
  /** فقط برای حالت ویرایش: آیا کاربر عکس رسید موجود را حذف کرده؟ */
  removeExistingReceipt?: boolean;
}

interface CashbookEntryFormDialogProps {
  open: boolean;
  loading?: boolean;
  workers: Worker[];
  funds: CashboxFund[];
  /** صندوقی که در حال حاضر در صفحهٔ دفتر حساب انتخاب شده — به‌عنوان مقدار پیش‌فرض فرم استفاده می‌شود. */
  defaultFundId?: string;
  /**
   * برای «کپی تراکنش»: وقتی پر باشد، فرم با همین مقادیر پر می‌شود (تاریخ
   * همیشه امروز است، نه تاریخ تراکنش اصلی) — مناسب برای هزینه‌های تکرارشونده
   * مثل خرید هفتگی گازوئیل که فقط تاریخ و شاید مبلغش کمی فرق دارد.
   */
  duplicateFrom?: { type: CashbookEntryType; title: string; amount: number; description: string | null; fundId: string } | null;
  /**
   * برای «ویرایش»: وقتی پر باشد، فرم با مقادیر همین تراکنش موجود پر می‌شود
   * و عکس رسید فعلی آن (در صورت وجود) با existingReceiptUrl نمایش داده می‌شود.
   */
  editingEntry?: CashbookEntry | null;
  /** آدرس قابل‌نمایش عکس رسید فعلیِ editingEntry، اگر وجود داشته باشد (باید از قبل resolve شده باشد). */
  existingReceiptUrl?: string | null;
  onClose: () => void;
  onSubmit: (input: CashbookFormValues) => void;
}

export function CashbookEntryFormDialog({
  open,
  loading,
  workers,
  funds,
  defaultFundId,
  duplicateFrom,
  editingEntry,
  existingReceiptUrl,
  onClose,
  onSubmit,
}: CashbookEntryFormDialogProps) {
  const { t } = useTranslation();
  const { currency } = useLanguage();
  const currencySymbol = getCurrencyInfo(currency).symbol;
  const [type, setType] = useState<CashbookEntryType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayIso());
  const [description, setDescription] = useState("");
  const [fundId, setFundId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  // آیا کاربر عکس رسید موجود (در حالت ویرایش) را حذف کرده — جدا از انتخاب
  // فایل جدید، چون این دو حالت باید به‌صورت متفاوت به onSubmit اطلاع داده شوند.
  const [existingReceiptRemoved, setExistingReceiptRemoved] = useState(false);
  const [error, setError] = useState("");
  const { pickPhoto, fileInputProps } = usePhotoPicker();

  const isEditing = !!editingEntry;

  // پیش‌نویس فقط برای «ثبت تراکنش جدید» فعال است (نه ویرایش/کپی) — چون در
  // آن دو حالت، مقدار اولیهٔ فرم خودش دادهٔ واقعی موجود است و بازیابی یک
  // پیش‌نویس قدیمی روی آن می‌تواند به‌جای کمک، باعث سردرگمی یا از‌دست‌رفتن
  // یک ویرایش در حال انجام شود.
  const draftKey = open && !isEditing && !duplicateFrom ? "cashbook-entry-new" : null;
  const isDirtyForDraft = !!(title.trim() || amount.trim() || description.trim());
  const { loadDraft, clearDraft } = useFormDraft({
    draftKey,
    // فایل عکس در draft ذخیره نمی‌شود (قابل serialize نیست)؛ فقط فیلدهای متنی/عددی.
    currentValue: { type, title, amount, date, description, fundId, workerId },
    isDirty: isDirtyForDraft,
  });
  const [draftPrompt, setDraftPrompt] = useState<{
    type: CashbookEntryType;
    title: string;
    amount: string;
    date: string;
    description: string;
    fundId: string;
    workerId: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      if (editingEntry) {
        setType(editingEntry.type);
        setTitle(editingEntry.title);
        setAmount(String(editingEntry.amount));
        setDate(editingEntry.date);
        setDescription(editingEntry.description ?? "");
        setFundId(editingEntry.fundId);
        setWorkerId(editingEntry.workerId ?? "");
      } else {
        setType(duplicateFrom?.type ?? "expense");
        setTitle(duplicateFrom?.title ?? "");
        setAmount(duplicateFrom ? String(duplicateFrom.amount) : "");
        setDate(getTodayIso());
        setDescription(duplicateFrom?.description ?? "");
        setFundId(duplicateFrom?.fundId || defaultFundId || funds.find((f) => f.isDefault)?.id || funds[0]?.id || "");
        setWorkerId("");
      }
      setReceiptFile(null);
      setReceiptPreview("");
      setExistingReceiptRemoved(false);
      setError("");
      setDraftPrompt(null);

      // فقط برای حالت «ثبت تراکنش جدید» بررسی می‌کنیم که آیا پیش‌نویس
      // ذخیره‌شده‌ای (از یک بار قبل که کاربر وسط پر کردن فرم اپ را به
      // پس‌زمینه برده بود) وجود دارد یا نه.
      if (!editingEntry && !duplicateFrom) {
        loadDraft().then((draft) => {
          if (draft && (draft.title.trim() || draft.amount.trim())) {
            setDraftPrompt(draft);
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, duplicateFrom, editingEntry]);

  function applyDraft() {
    if (!draftPrompt) return;
    setType(draftPrompt.type);
    setTitle(draftPrompt.title);
    setAmount(draftPrompt.amount);
    setDate(draftPrompt.date);
    setDescription(draftPrompt.description);
    setFundId(draftPrompt.fundId);
    setWorkerId(draftPrompt.workerId);
    setDraftPrompt(null);
  }

  function dismissDraft() {
    setDraftPrompt(null);
    void clearDraft();
  }

  const currentOption = TYPE_OPTIONS.find((o) => o.value === type)!;

  // چه عکسی الان باید در پیش‌نمایش دیده شود: عکس تازه‌انتخاب‌شده در اولویت
  // است؛ در غیر این صورت، اگر کاربر عکس موجود را حذف نکرده، همان عکس فعلی رکورد.
  const displayedReceiptUrl = receiptPreview || (!existingReceiptRemoved ? existingReceiptUrl || "" : "");

  async function handlePickReceipt() {
    const file = await pickPhoto();
    if (!file) return;
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
    setExistingReceiptRemoved(false);
  }

  function handleRemoveReceipt() {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(null);
    setReceiptPreview("");
    // اگر عکسی که داشتیم حذف می‌کنیم همان عکس موجود رکورد بود (نه یک فایل
    // تازه‌انتخاب‌شده)، این حذف باید صراحتاً به onSubmit اطلاع داده شود.
    if (isEditing && existingReceiptUrl) {
      setExistingReceiptRemoved(true);
    }
  }

  function handleSubmit() {
    if (!title.trim()) {
      setError(t("cashbook.form.errTitle"));
      return;
    }
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError(t("cashbook.form.errAmount"));
      return;
    }
    if (!fundId) {
      setError(t("cashbook.form.errFund"));
      return;
    }
    onSubmit({
      type,
      title: title.trim(),
      amount: amt,
      date,
      description: description.trim() || null,
      fundId,
      workerId: type === "salary" ? workerId || null : null,
      // فایل تازه انتخاب‌شده → همان فایل. حذف صریح عکس موجود → null.
      // هیچ‌کدام (در ویرایش، بدون تغییر عکس) → undefined یعنی دست‌نخورده بماند.
      receiptFile: receiptFile ?? (existingReceiptRemoved ? null : undefined),
      removeExistingReceipt: existingReceiptRemoved,
    });

    // پیش‌نویس همین لحظه (نه بعد از تأیید موفقیت mutation) پاک می‌شود —
    // چون اگر ثبت به‌ندرت شکست بخورد، دیالوگ همچنان باز و دادهٔ کاربر در
    // state زندهٔ React موجود است؛ خطر واقعی («از دست رفتن کامل ورودی»)
    // فقط زمانی است که خودِ دیالوگ بسته/kill شود، نه وقتی هنوز روی صفحه است.
    if (draftKey) void clearDraft(draftKey);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {isEditing ? t("cashbook.form.titleEdit") : duplicateFrom ? t("cashbook.form.titleCopy") : t("cashbook.form.titleNew")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {draftPrompt && (
            <Alert
              severity="info"
              action={
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={applyDraft}>
                    {t("cashbook.form.draftRestore")}
                  </Button>
                  <Button size="small" color="inherit" onClick={dismissDraft}>
                    {t("cashbook.form.draftDismiss")}
                  </Button>
                </Stack>
              }
            >
              {t("cashbook.form.draftFound")}
            </Alert>
          )}
          <ToggleButtonGroup value={type} exclusive onChange={(_, v) => v && setType(v)} fullWidth size="small">
            {TYPE_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value} color={o.color}>
                {t(`cashbook.entryType.${o.value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <TextField
            label={t("cashbook.form.titleLabel")}
            placeholder={t("cashbook.form.titlePlaceholder")}
            value={title} onChange={(e) => setTitle(e.target.value)}
          />

          {funds.length > 1 && (
            <TextField select label={t("cashbook.form.fundLabel")} value={fundId} onChange={(e) => setFundId(e.target.value)} size="small">
              {funds.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.isDefault ? t("cashbook.form.fundOptionDefault", { name: f.name }) : f.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Box>
            <TextField
              label={t("cashbook.form.amountLabel")}
              value={amount}
              onChange={(e) => setAmount(toPlainDigitsOnly(e.target.value))}
              inputMode="numeric"
              fullWidth
              InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
            />
            {/* برای سرعت بیشتر در ثبت‌های پرتکرار — با یک تپ مبلغ رند پر می‌شود، همچنان قابل ویرایش دستی است. */}
            <Stack direction="row" spacing={0.75} mt={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
              {AMOUNT_PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  size="small"
                  variant="outlined"
                  label={formatCurrency(preset)}
                  onClick={() => setAmount(String(preset))}
                />
              ))}
            </Stack>
          </Box>

          <JalaliDatePicker label={t("cashbook.form.dateLabel")} value={date} onChange={setDate} size="small" />

          {type === "salary" && (
            <TextField
              select
              label={t("cashbook.form.workerLabel")}
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              size="small"
            >
              <MenuItem value="">{t("cashbook.form.noWorker")}</MenuItem>
              {workers.map((w) => (
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
          )}

          <TextField
            label={t("cashbook.form.descLabel")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />

          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
              {t("cashbook.form.receiptLabel")}
            </Typography>
            <input {...fileInputProps} />

            {displayedReceiptUrl ? (
              <Box sx={{ position: "relative", width: 120 }}>
                <Box
                  component="img"
                  src={displayedReceiptUrl}
                  alt={t("cashbook.form.receiptPreviewAlt")}
                  sx={{ width: 120, height: 120, objectFit: "cover", borderRadius: 1.5 }}
                />
                <IconButton
                  size="small"
                  onClick={handleRemoveReceipt}
                  sx={{
                    position: "absolute",
                    top: 2,
                    left: 2,
                    bgcolor: "rgba(0,0,0,0.55)",
                    color: "common.white",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ) : (
              <Button
                variant="outlined"
                startIcon={<ReceiptLongIcon />}
                onClick={handlePickReceipt}
                sx={{ borderStyle: "dashed" }}
              >
                {isEditing && existingReceiptRemoved ? t("cashbook.form.addReceiptNew") : t("cashbook.form.addReceipt")}
              </Button>
            )}
          </Box>

          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" color={currentOption.color} disabled={loading}>
          {loading ? t("cashbook.form.saving") : isEditing ? t("cashbook.form.saveEdit") : t("cashbook.form.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
