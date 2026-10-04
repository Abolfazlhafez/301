import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  Fab,
  Grid,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import IosShareIcon from "@mui/icons-material/IosShare";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PaidIcon from "@mui/icons-material/Paid";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { cashbookApi } from "../../shared/api/cashbookApi";
import { cashboxFundApi } from "../../shared/api/cashboxFundApi";
import { workersApi } from "../../shared/api/workersApi";
import { settingsApi } from "../../shared/api/settingsApi";
import { getPhotoUrl, photosApi } from "../../shared/api/photosApi";
import { PhotoThumbImg } from "../../shared/components/PhotoThumbImg";
import { extractErrorMessage } from "../../shared/api/client";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { ExportMenuButton } from "../../shared/components/ExportMenuButton";
import { TimeRangeFilter, TimeRangeValue } from "../../shared/components/TimeRangeFilter";
import { useLanguage } from "../../shared/hooks/useLanguage";
import { getCurrencyInfo } from "../../shared/i18n/languages";
import { formatCurrency, formatNumber } from "../../shared/utils/format";
import {
  toJalaliDisplay,
  toJalaliShort,
  getTodayIso,
  addDaysIso,
  getCurrentJalaliMonthRange,
  addJalaliMonthsIso,
} from "../../shared/utils/jalaliDate";
import { exportElementAsShareableImage, saveElementAsImageToDevice } from "../../shared/utils/exportCard";
import { exportRowsAsCsv, saveRowsAsCsvToDevice } from "../../shared/utils/exportCsv";
import { CashbookEntryFormDialog, CashbookFormValues } from "../../widgets/cashbook-form/CashbookEntryFormDialog";
import { CashboxFundManagerDialog } from "../../widgets/cashbox-form/CashboxFundManagerDialog";
import { CashbookReceiptCard } from "../../widgets/cashbook/CashbookReceiptCard";
import { AnimatedList } from "../../shared/components/AnimatedList";
import { SwipeToDelete } from "../../shared/components/SwipeToDelete";
import {
  CASHBOOK_ENTRY_TYPE_COLORS,
  CashbookEntry,
  CashbookEntryType,
} from "../../entities/Cashbook";

const FILTER_OPTIONS: { value: CashbookEntryType | "all"; labelKey: string }[] = [
  { value: "all", labelKey: "cashbook.section.filterAll" },
  { value: "expense", labelKey: "cashbook.section.filterExpense" },
  { value: "salary", labelKey: "cashbook.section.filterSalary" },
  { value: "deposit", labelKey: "cashbook.section.filterDeposit" },
];

// بازه‌های سریع تاریخ برای فیلتر کردن دفترحساب — مستقل از فیلتر «نوع»
// می‌توانند هم‌زمان اعمال شوند (مثلاً «فقط خرج‌های این هفته»). «همه» یعنی
// بدون محدودیت تاریخ، همان رفتار قبلی صفحه.
type DateRangeOption = TimeRangeValue;

export function CashbookSection() {
  const { currency } = useLanguage();
  const { t, i18n } = useTranslation();
  const currencySymbol = getCurrencyInfo(currency).symbol;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [chosenFundId, setSelectedFundId] = useState<string>("");
  const [fundManagerOpen, setFundManagerOpen] = useState(false);
  const [filter, setFilter] = useState<CashbookEntryType | "all">("all");
  const [dateRange, setDateRange] = useState<DateRangeOption>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [duplicatingEntry, setDuplicatingEntry] = useState<CashbookEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<CashbookEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<CashbookEntry | null>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string>("");
  const [receiptEntry, setReceiptEntry] = useState<CashbookEntry | null>(null);
  const [isSharingReceipt, setIsSharingReceipt] = useState(false);
  const [menuEntry, setMenuEntry] = useState<{ entry: CashbookEntry; anchor: HTMLElement } | null>(null);
  const receiptCardRef = useRef<HTMLDivElement>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const {
    data: funds,
    isLoading: fundsLoading,
    isError: fundsIsError,
    error: fundsError,
    refetch: refetchFunds,
  } = useQuery({
    queryKey: ["cashbox-funds"],
    queryFn: () => cashboxFundApi.list(),
  });

  // Until the user picks a fund, the default fund (or the first one) is used. Derived during
  // render instead of an effect so the first paint already has a fund (same value the old
  // effect would set; the user's own choice always wins).
  const selectedFundId = chosenFundId || ((funds ?? []).find((f) => f.isDefault)?.id ?? (funds ?? [])[0]?.id ?? "");

  const { data: entries, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["cashbook", selectedFundId],
    queryFn: () => cashbookApi.list({ fundId: selectedFundId }),
    enabled: !!selectedFundId,
  });

  // برای گرم کردن کش آدرس نمایش عکس‌های رسید و دسترسی به نام فایل آن‌ها
  const { data: receiptPhotos, isLoading: receiptPhotosLoading } = useQuery({
    queryKey: ["photos", "receipt"],
    queryFn: () => photosApi.list({ relatedType: "receipt" }),
  });

  const receiptPhotoById = useMemo(() => {
    const map = new Map<string, string>();
    (receiptPhotos ?? []).forEach((p) => map.set(p.id, p.filename));
    return map;
  }, [receiptPhotos]);

  const { data: workers } = useQuery({
    queryKey: ["workers"],
    queryFn: () => workersApi.list(),
  });

  const summaryQuery = useQuery({
    queryKey: ["cashbook-summary", selectedFundId],
    queryFn: () => cashbookApi.getSummary({ fundId: selectedFundId }),
    enabled: !!selectedFundId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["cashbook"] });
    queryClient.invalidateQueries({ queryKey: ["cashbook-summary"] });
  }

  // به‌محض این‌که رسید یک تراکنش برای اشتراک‌گذاری انتخاب می‌شود، کارت مخفی
  // آن رندر می‌شود. اگر تراکنش عکس رسید دارد، قبل از گرفتن خروجی صبر می‌کنیم
  // تا خودِ <img> واقعاً decode/لود شده باشد — چون html2canvas از عکس‌هایی که
  // هنوز کامل بارگذاری نشده‌اند (complete=false) یک تصویر خالی/سفید می‌سازد؛
  // این همان ریشهٔ باگ «عکس رسید در خروجی نهایی نمایش داده نمی‌شود» است وقتی
  // خروجی بلافاصله بعد از انتخاب تراکنش (قبل از رسیدن blob از IndexedDB به
  // مرورگر) گرفته می‌شد.
  useEffect(() => {
    if (!receiptEntry) return;
    let cancelled = false;

    async function waitForCardImage(): Promise<void> {
      const node = receiptCardRef.current;
      if (!node) return;
      const img = node.querySelector("img");
      if (!img) return; // این رسید عکس ندارد، چیزی برای انتظار نیست.
      if (img.complete && img.naturalWidth > 0) return; // از قبل لود شده.
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        // سقف ایمنی: اگر عکس هرگز رویداد load/error نداد (حالت غیرمنتظره)،
        // بعد از ۳ ثانیه به‌هرحال ادامه بده تا صفحه در حالت انتظار ابدی گیر نکند.
        setTimeout(done, 3000);
      });
    }

    const timer = setTimeout(async () => {
      if (cancelled || !receiptCardRef.current) return;
      setIsSharingReceipt(true);
      try {
        await waitForCardImage();
        if (cancelled || !receiptCardRef.current) return;
        await exportElementAsShareableImage(
          receiptCardRef.current,
          `${t("cashbook.section.receiptFileBase")}-${receiptEntry.id.slice(0, 8)}.png`,
          t("cashbook.section.receiptShareTitle")
        );
      } catch (err) {
        showToast(extractErrorMessage(err), "error");
      } finally {
        if (!cancelled) {
          setIsSharingReceipt(false);
          setReceiptEntry(null);
        }
      }
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptEntry]);

  const createMutation = useMutation({
    mutationFn: (input: CashbookFormValues) => {
      const { removeExistingReceipt: _removeExistingReceipt, ...rest } = input;
      return cashbookApi.create(rest);
    },
    onSuccess: () => {
      invalidate();
      showToast(t("cashbook.section.toastCreated"), "success");
      setFormOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CashbookFormValues }) => {
      // removeExistingReceipt فقط برای هماهنگی داخلی فرم بود؛ آنچه سرویس
      // می‌خواهد صرفاً receiptFile است (undefined/File/null).
      const { removeExistingReceipt: _removeExistingReceipt, ...rest } = input;
      return cashbookApi.update(id, rest);
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["photos", "receipt"] });
      showToast(t("cashbook.section.toastUpdated"), "success");
      setFormOpen(false);
      setEditingEntry(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cashbookApi.remove(id),
    onSuccess: () => {
      invalidate();
      showToast(t("cashbook.section.toastDeleted"), "success");
      setDeletingEntry(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = useMemo(() => {
    let list = entries ?? [];
    if (filter !== "all") list = list.filter((e) => e.type === filter);

    if (dateRange !== "all") {
      const today = getTodayIso();
      let fromIso: string;
      // برخلاف بقیهٔ بازه‌ها (که همیشه تا «امروز» ادامه دارند)، «ماه قبل»
      // بازه‌ای است که در گذشته تمام شده — پس toIso هم باید جداگانه
      // محاسبه شود، نه همیشه today.
      let toIso: string = today;
      if (dateRange === "today") fromIso = today;
      else if (dateRange === "week") fromIso = addDaysIso(today, -6);
      else if (dateRange === "lastMonth") {
        const lastMonthRange = getCurrentJalaliMonthRange(addJalaliMonthsIso(today, -1));
        fromIso = lastMonthRange.from;
        toIso = lastMonthRange.to;
      } else fromIso = getCurrentJalaliMonthRange(today).from;
      list = list.filter((e) => e.date >= fromIso && e.date <= toIso);
    }

    const q = searchQuery.trim();
    if (q) {
      list = list.filter(
        (e) => e.title.includes(q) || (e.description ?? "").includes(q)
      );
    }
    return list;
  }, [entries, filter, dateRange, searchQuery]);

  // جمع مبلغ همان تراکنش‌هایی که الان روی صفحه دیده می‌شوند (بعد از فیلتر
  // نوع/بازه/جستجو) — چون کارت‌های خلاصهٔ بالای صفحه همیشه کل صندوق را نشان
  // می‌دهند و وقتی کاربر مثلاً فقط «خرج‌های این هفته» را فیلتر می‌کند، جایی
  // برای دیدن جمع همان زیرمجموعهٔ فیلترشده نداشت.
  const filteredSum = useMemo(
    () => filteredEntries.reduce((sum, e) => sum + e.amount, 0),
    [filteredEntries]
  );

  // مانده‌ی صندوق بلافاصله بعد از هر تراکنش — همیشه از روی کل تراکنش‌های
  // همین صندوق (entries خام، نه filteredEntries) محاسبه می‌شود، نه فقط
  // زیرمجموعه‌ی فیلترشده؛ وگرنه وقتی کاربر مثلاً فقط «برداشت‌ها» را فیلتر
  // می‌کند، مانده‌ی نمایش داده‌شده دیگر مانده‌ی واقعی صندوق نخواهد بود.
  // entries از سرویس نزولی (جدیدترین اول) برمی‌گردد؛ برای محاسبه‌ی مانده
  // باید زمانی/صعودی پیمایش شود، دقیقاً همان فرمول net در getSummary
  // (deposit مثبت، expense/salary منفی).
  const runningBalanceByEntryId = useMemo(() => {
    const map = new Map<string, number>();
    const chronological = [...(entries ?? [])].reverse();
    let balance = 0;
    for (const e of chronological) {
      balance += e.type === "deposit" ? e.amount : -e.amount;
      map.set(e.id, balance);
    }
    return map;
  }, [entries]);

  // تعداد هر دسته برای نمایش روی چیپ‌های فیلتر — بر اساس کل تراکنش‌های همین
  // صندوق (نه فیلترشده) تا کاربر قبل از کلیک بداند هر دسته چقدر آیتم دارد.
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: entries?.length ?? 0 };
    for (const opt of FILTER_OPTIONS) {
      if (opt.value === "all") continue;
      counts[opt.value] = (entries ?? []).filter((e) => e.type === opt.value).length;
    }
    return counts;
  }, [entries]);

  // آیا فهرست خالی به این دلیل است که اصلاً هیچ تراکنشی در این صندوق ثبت
  // نشده (پیام «هنوز تراکنشی ثبت نشده»)، یا این‌که تراکنش هست ولی جستجو/
  // فیلتر فعلی چیزی پیدا نکرده (که باید پیام متفاوتی بگیرد، وگرنه کاربر فکر
  // می‌کند کل دفترحساب خالی است در حالی که فقط نتیجهٔ جستجو خالی است).
  const isSearchOrFilterActive = filter !== "all" || dateRange !== "all" || searchQuery.trim().length > 0;

  const selectedFund = (funds ?? []).find((f) => f.id === selectedFundId);

  // Output file name base (follows the app language); fund name is user data and stays as typed.
  function exportFileName(): string {
    return `${t("cashbook.section.fileBase")}-${selectedFund?.name ?? ""}-${toJalaliShort(getTodayIso())}`;
  }

  // CSV headers/rows shared by the share and save-to-device exports.
  function buildCsvTable(): { headers: string[]; rows: (string | number)[][] } {
    const headers = [
      t("cashbook.section.csvType"),
      t("cashbook.section.csvTitle"),
      t("cashbook.section.csvDate"),
      t("cashbook.section.csvAmount", { symbol: currencySymbol }),
      t("cashbook.section.csvWorker"),
      t("cashbook.section.csvNotes"),
    ];
    const rows = filteredEntries.map((e) => {
      const worker = workers?.find((w) => w.id === e.workerId);
      return [
        t(`cashbook.entryType.${e.type}`),
        e.title,
        toJalaliDisplay(e.date),
        e.amount,
        worker ? `${worker.firstName} ${worker.lastName}` : "",
        e.description ?? "",
      ];
    });
    return { headers, rows };
  }

  // «خروجی عکس» از همان محتوای دیده‌شده (کارت‌های خلاصه + لیست فیلترشده)
  // با html2canvas عکس می‌گیرد — دقیقاً همان چیزی که کاربر روی صفحه می‌بیند.
  async function handleExportImage() {
    if (!printableRef.current) return;
    try {
      await exportElementAsShareableImage(
        printableRef.current,
        `${exportFileName()}.png`,
        t("cashbook.section.exportShareTitle")
      );
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }

  // «خروجی اکسل» یک CSV از همان تراکنش‌های فیلترشده (با احترام به فیلتر نوع
  // فعلی) می‌سازد — تا خروجی همیشه با چیزی که کاربر روی صفحه انتخاب کرده هم‌خوان باشد.
  async function handleExportExcel() {
    try {
      const { headers, rows } = buildCsvTable();
      await exportRowsAsCsv(headers, rows, `${exportFileName()}.csv`);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }

  // نسخهٔ «ذخیره در گوشی» همین دو خروجی — بدون بازکردن منوی اشتراک‌گذاری.
  async function handleSaveImageToDevice() {
    if (!printableRef.current) return;
    try {
      await saveElementAsImageToDevice(
        printableRef.current,
        `${exportFileName()}.png`
      );
      showToast(t("cashbook.section.toastImageSaved"), "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }

  async function handleSaveExcelToDevice() {
    try {
      const { headers, rows } = buildCsvTable();
      await saveRowsAsCsvToDevice(headers, rows, `${exportFileName()}.csv`);
      showToast(t("cashbook.section.toastExcelSaved"), "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    }
  }

  // این سه شرط باید *قبل* از منتظرماندن برای selectedFundId بررسی شوند: تا
  // وقتی صندوق‌ها هنوز در حال بارگذاری‌اند selectedFundId همیشه خالی است،
  // پس شرط بعدی (`!selectedFundId`) هم برای «در حال بارگذاری صندوق‌ها» و هم
  // برای «این پروژه اصلاً صندوقی ندارد» به‌اشتباه یک چیز واحد (لودینگ ابدی)
  // نشان می‌داد — دقیقاً همان باگی که کاربر گزارش داد: صفحه برای پروژه‌ای که
  // صفر صندوق دارد (مثلاً یک پروژهٔ تازه) برای همیشه روی «در حال بارگذاری»
  // می‌ماند، بدون هیچ خطا یا راهی برای ساختن اولین صندوق.
  if (fundsLoading) return <LoadingState />;
  if (fundsIsError) return <ErrorState message={extractErrorMessage(fundsError)} onRetry={refetchFunds} />;
  if ((funds ?? []).length === 0) {
    return (
      <>
        <EmptyState
          icon={<AccountBalanceWalletIcon fontSize="inherit" />}
          title={t("cashbook.section.noFundTitle")}
          description={t("cashbook.section.noFundDesc")}
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFundManagerOpen(true)}>
              {t("cashbook.section.createFund")}
            </Button>
          }
        />
        <CashboxFundManagerDialog open={fundManagerOpen} onClose={() => setFundManagerOpen(false)} />
      </>
    );
  }

  if (!selectedFundId || isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={extractErrorMessage(error)} onRetry={refetch} />;

  const summary = summaryQuery.data;

  return (
    <Box display="flex" flexDirection="column" gap={2} sx={{ position: "relative", pb: 8 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <AccountBalanceWalletIcon fontSize="small" color="action" />
        <Box sx={{ display: "flex", gap: 1, overflowX: "auto", flex: 1 }}>
          {(funds ?? []).map((fund) => (
            <Chip
              key={fund.id}
              label={fund.name}
              onClick={() => setSelectedFundId(fund.id)}
              color={selectedFundId === fund.id ? "primary" : "default"}
              variant={selectedFundId === fund.id ? "filled" : "outlined"}
            />
          ))}
        </Box>
        <IconButton size="small" onClick={() => setFundManagerOpen(true)} aria-label={t("cashbook.section.manageFundsAria")}>
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
        <ExportMenuButton
          onExportImage={handleExportImage}
          onExportExcel={handleExportExcel}
          onSaveImageToDevice={handleSaveImageToDevice}
          onSaveExcelToDevice={handleSaveExcelToDevice}
        />
      </Stack>

      {/* نوار موجودی چسبان: چون صفحهٔ دفترحساب می‌تواند طولانی شود، وقتی
          کاربر پایین می‌رود کارت‌های خلاصه (از جمله «مانده این صندوق») از
          دید خارج می‌شوند — این نوار کوچک همیشه بالای صفحه می‌ماند تا مانده
          فعلی صندوق در هر لحظه از اسکرول قابل مشاهده باشد. */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 3,
          bgcolor: "background.default",
          py: 1,
          mx: -2,
          px: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {t("cashbook.section.balanceOf", {
            name: (funds ?? []).find((f) => f.id === selectedFundId)?.name ?? t("cashbook.section.fundFallback"),
          })}
        </Typography>
        <Typography
          variant="subtitle2"
          fontWeight={800}
          dir="ltr"
          color={summary && summary.net >= 0 ? "success.main" : "error.main"}
        >
          {formatCurrency(summary?.net ?? 0)}
        </Typography>
      </Box>

      <Box ref={printableRef} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={6} sm={3}>
            <SummaryCard
              icon={<TrendingDownIcon color="error" />}
              label={t("cashbook.section.totalExpense")}
              value={summary?.totalExpense ?? 0}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <SummaryCard icon={<PaidIcon color="warning" />} label={t("cashbook.section.totalSalary")} value={summary?.totalSalary ?? 0} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <SummaryCard
              icon={<TrendingUpIcon color="success" />}
              label={t("cashbook.section.totalDeposit")}
              value={summary?.totalDeposit ?? 0}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <SummaryCard
              icon={<PaidIcon color={summary && summary.net >= 0 ? "success" : "error"} />}
              label={t("cashbook.section.fundBalance")}
              value={summary?.net ?? 0}
              emphasized
            />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
          {FILTER_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={
                filterCounts[opt.value]
                  ? t("cashbook.section.filterWithCount", {
                      label: t(opt.labelKey),
                      n: formatNumber(filterCounts[opt.value], i18n.language),
                    })
                  : t(opt.labelKey)
              }
              onClick={() => setFilter(opt.value)}
              color={filter === opt.value ? "primary" : "default"}
              variant={filter === opt.value ? "filled" : "outlined"}
            />
          ))}
        </Stack>

        {/* فیلتر سریع بازهٔ تاریخ — مستقل از فیلتر نوع، برای مواقعی که سرپرست
            فقط می‌خواهد تراکنش‌های اخیر (نه کل تاریخچهٔ صندوق) را ببیند. */}
        <TimeRangeFilter value={dateRange} onChange={setDateRange} weekLabelKey="last7Days" />

        <TextField
          size="small"
          placeholder={t("cashbook.section.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="disabled" />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery("")} aria-label={t("common.clearSearch")}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />

        {filteredEntries.length === 0 ? (
          <EmptyState
            title={
              isSearchOrFilterActive
                ? t("cashbook.section.emptyFilteredTitle")
                : t("cashbook.section.emptyNoneTitle")
            }
            description={isSearchOrFilterActive ? t("cashbook.section.emptyFilteredDesc") : undefined}
          />
        ) : (
          <>
            {/* جمع همین نتایج فیلترشده — فقط وقتی فیلتر/جستجویی فعال است نمایش
                داده می‌شود، چون در حالت پیش‌فرض (بدون فیلتر) این عدد دقیقاً با
                یکی از کارت‌های خلاصهٔ بالای صفحه یکی است و تکراری خواهد بود. */}
            {isSearchOrFilterActive && (
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 1.5,
                  bgcolor: "secondary.main",
                  color: "secondary.contrastText",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <CalendarMonthIcon fontSize="small" />
                  <Typography variant="caption" fontWeight={600}>
                    {t("cashbook.section.filteredSum", { n: formatNumber(filteredEntries.length, i18n.language) })}
                  </Typography>
                </Stack>
                <Typography variant="body2" fontWeight={800} dir="ltr">
                  {formatCurrency(filteredSum)}
                </Typography>
              </Stack>
            )}
            <AnimatedList>
            {filteredEntries.map((entry) => {
              const worker = workers?.find((w) => w.id === entry.workerId);
              const receiptFilename = entry.receiptPhotoId ? receiptPhotoById.get(entry.receiptPhotoId) : undefined;
              return (
                <SwipeToDelete
                  key={entry.id}
                  onDelete={() => setDeletingEntry(entry)}
                  ariaLabel={t("cashbook.section.deleteEntryAria", { title: entry.title })}
                >
                <Card sx={{ position: "relative", overflow: "hidden" }}>
                  <Box
                    sx={{
                      position: "absolute",
                      insetInlineStart: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      bgcolor: `${CASHBOOK_ENTRY_TYPE_COLORS[entry.type]}.main`,
                    }}
                  />
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 1.5, "&:last-child": { pb: 2 } }}>
                    {receiptFilename ? (
                      <PhotoThumbImg
                        photo={{ filename: receiptFilename }}
                        alt={t("cashbook.section.receiptAlt")}
                        onClick={() => setViewingReceiptUrl(getPhotoUrl(receiptFilename))}
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: 1.5,
                          objectFit: "cover",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: 1.5,
                          bgcolor: "action.hover",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <ReceiptLongIcon color="disabled" fontSize="small" />
                      </Box>
                    )}

                    <Box flex={1} minWidth={0}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {entry.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {toJalaliDisplay(entry.date)}
                        {worker ? ` • ${worker.firstName} ${worker.lastName}` : ""}
                        {entry.description ? ` • ${entry.description}` : ""}
                      </Typography>
                    </Box>

                    <Stack alignItems="flex-end" spacing={0.5}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color={`${CASHBOOK_ENTRY_TYPE_COLORS[entry.type]}.main`}
                        whiteSpace="nowrap"
                        dir="ltr"
                      >
                        {entry.type === "deposit" ? "+" : "-"}
                        {formatCurrency(entry.amount)}
                      </Typography>
                      {/* Fund balance right after this transaction (not the filtered sum).
                          The amount stays in its own Typography (not one dir="ltr" over
                          the whole line) so it matches the top "fund balance" pattern and
                          satisfies the amount-direction guard (which only checks the
                          Typography tag that contains formatCurrency). */}
                      <Stack direction="row" spacing={0.5} alignItems="baseline">
                        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                          {t("cashbook.section.runningBalance")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap" dir="ltr">
                          {formatCurrency(runningBalanceByEntryId.get(entry.id) ?? 0)}
                        </Typography>
                      </Stack>
                      {/* به‌جای ۴ آیکون همیشه‌نمایان (که ردیف هر تراکنش را
                          شلوغ می‌کرد)، فقط یک دکمهٔ «⋮» هست که منوی فشرده
                          را باز می‌کند؛ حذف هم از طریق سواپ روی خودِ کارت
                          انجام می‌شود (دکمهٔ قرمز که با کشیدن آشکار می‌شود). */}
                      <IconButton
                        size="small"
                        onClick={(e) => setMenuEntry({ entry, anchor: e.currentTarget })}
                        aria-label={t("cashbook.section.moreActionsAria")}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
                </SwipeToDelete>
              );
            })}
            </AnimatedList>
          </>
        )}
      </Box>

      <Fab
        color="primary"
        onClick={() => {
          setDuplicatingEntry(null);
          setFormOpen(true);
        }}
        sx={{ position: "fixed", bottom: 84, left: 20, zIndex: 5 }}
        aria-label={t("cashbook.section.addAria")}
      >
        <AddIcon />
      </Fab>

      <Menu
        open={!!menuEntry}
        anchorEl={menuEntry?.anchor ?? null}
        onClose={() => setMenuEntry(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <MenuItem
          onClick={() => {
            if (menuEntry) {
              setDuplicatingEntry(menuEntry.entry);
              setFormOpen(true);
            }
            setMenuEntry(null);
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("cashbook.section.menuCopy")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuEntry) {
              setEditingEntry(menuEntry.entry);
              setFormOpen(true);
            }
            setMenuEntry(null);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("cashbook.section.menuEdit")}</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={isSharingReceipt || receiptPhotosLoading}
          onClick={() => {
            if (menuEntry) setReceiptEntry(menuEntry.entry);
            setMenuEntry(null);
          }}
        >
          <ListItemIcon>
            <IosShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {receiptPhotosLoading ? t("cashbook.section.menuPreparing") : t("cashbook.section.menuReceipt")}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuEntry) setDeletingEntry(menuEntry.entry);
            setMenuEntry(null);
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t("common.delete")}</ListItemText>
        </MenuItem>
      </Menu>

      <CashbookEntryFormDialog
        open={formOpen}
        loading={createMutation.isPending || updateMutation.isPending}
        workers={workers ?? []}
        funds={funds ?? []}
        defaultFundId={selectedFundId}
        duplicateFrom={duplicatingEntry}
        editingEntry={editingEntry}
        existingReceiptUrl={
          editingEntry?.receiptPhotoId
            ? (() => {
                const filename = receiptPhotoById.get(editingEntry.receiptPhotoId);
                return filename ? getPhotoUrl(filename) : null;
              })()
            : null
        }
        onClose={() => {
          setFormOpen(false);
          setDuplicatingEntry(null);
          setEditingEntry(null);
        }}
        onSubmit={(input) => {
          if (editingEntry) {
            updateMutation.mutate({ id: editingEntry.id, input });
          } else {
            createMutation.mutate(input);
          }
        }}
      />

      <CashboxFundManagerDialog open={fundManagerOpen} onClose={() => setFundManagerOpen(false)} />

      <ConfirmDialog
        open={!!deletingEntry}
        title={t("cashbook.section.deleteTitle")}
        description={t("cashbook.section.deleteDesc")}
        confirmLabel={t("common.delete")}
        loading={deleteMutation.isPending}
        onConfirm={() => deletingEntry && deleteMutation.mutate(deletingEntry.id)}
        onCancel={() => setDeletingEntry(null)}
      />

      <Dialog open={!!viewingReceiptUrl} onClose={() => setViewingReceiptUrl("")} fullWidth maxWidth="sm">
        <Box sx={{ position: "relative", bgcolor: "black" }}>
          <Box
            component="img"
            src={viewingReceiptUrl}
            alt={t("cashbook.section.receiptAlt")}
            sx={{ width: "100%", maxHeight: "75vh", objectFit: "contain", display: "block" }}
          />
          <IconButton
            onClick={() => setViewingReceiptUrl("")}
            sx={{ position: "absolute", top: 8, left: 8, bgcolor: "rgba(0,0,0,0.5)", color: "white" }}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Dialog>

      {/* کارت رسید مخفی — فقط برای گرفتن خروجی عکس از تراکنش انتخاب‌شده.
          receiptImageUrl از همان کش گرم‌شدهٔ receiptPhotoById خوانده می‌شود که
          useQuery(['photos','receipt']) بالای همین کامپوننت آن را از قبل پر
          کرده — یعنی وقتی این کارت رندر می‌شود، آدرس عکس همیشه از قبل آماده است. */}
      {receiptEntry && (
        <Box sx={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }} aria-hidden>
          <CashbookReceiptCard
            ref={receiptCardRef}
            entry={receiptEntry}
            workerName={
              receiptEntry.workerId
                ? (() => {
                    const w = (workers ?? []).find((x) => x.id === receiptEntry.workerId);
                    return w ? `${w.firstName} ${w.lastName}` : null;
                  })()
                : null
            }
            projectName={settings?.projectName}
            receiptImageUrl={
              receiptEntry.receiptPhotoId
                ? (() => {
                    const filename = receiptPhotoById.get(receiptEntry.receiptPhotoId);
                    return filename ? getPhotoUrl(filename) : null;
                  })()
                : null
            }
          />
        </Box>
      )}
    </Box>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  emphasized,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" spacing={0.75} mb={0.5}>
          {icon}
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Stack>
        <Typography variant={emphasized ? "subtitle1" : "body2"} fontWeight={800} noWrap dir="ltr">
          {formatCurrency(value)}
        </Typography>
      </CardContent>
    </Card>
  );
}
