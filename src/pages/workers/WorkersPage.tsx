import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AppBar,
  Box,
  Chip,
  Dialog,
  Divider,
  Fab,
  IconButton,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import GroupsIcon from "@mui/icons-material/Groups";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import SortIcon from "@mui/icons-material/Sort";
import SortByAlphaIcon from "@mui/icons-material/SortByAlpha";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import CheckIcon from "@mui/icons-material/Check";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import { workersApi } from "../../shared/api/workersApi";
import { AttendancePage } from "../attendance/AttendancePage";
import { projectsApi } from "../../shared/api/projectsApi";
import { photosApi } from "../../shared/api/photosApi";
import { extractErrorMessage } from "../../shared/api/client";
import { HasDependenciesError } from "../../core/errors";
import { Worker, CreateWorkerInput, UpdateWorkerInput } from "../../entities/Worker";
import { matchesSearchTerm } from "../../shared/utils/format";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import { AvatarPickerAction } from "../../widgets/worker-form/WorkerAvatarPicker";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { WorkerCard } from "../../widgets/worker-form/WorkerCard";
import { WorkerFormDialog } from "../../widgets/worker-form/WorkerFormDialog";
import { WorkerProfileDialog } from "../../widgets/worker-form/WorkerProfileDialog";
import { PhotoGalleryDialog } from "../../widgets/photo-gallery/PhotoGalleryDialog";
import { WorkerWageDialog } from "../../widgets/wage-system/WorkerWageDialog";
import { WorkerGroupsDialog } from "../../widgets/worker-groups/WorkerGroupsDialog";
import { AnimatedList } from "../../shared/components/AnimatedList";
import { ScrollToTopFab } from "../../shared/components/ScrollToTopFab";
import { SkeletonList } from "../../shared/components/SkeletonList";
import { PullToRefresh } from "../../shared/components/PullToRefresh";
import { SwipeToDelete } from "../../shared/components/SwipeToDelete";

interface WorkersPageProps {
  /** وقتی درون صفحه «منابع» به‌صورت زیرتب نمایش داده می‌شود، عنوان تکراری مخفی می‌گردد. */
  embedded?: boolean;
  /** اگر داده شود، یک چیپ «حضور گروهی» کنار چیپ‌های زیر نوار جستجو نمایش داده می‌شود. */
  onOpenBulkAttendance?: () => void;
}

// گزینه‌های مرتب‌سازی فهرست نیروها. «فعال‌ها اول» پیش‌فرض است چون معمولاً
// همان چیزی است که سرپرست روزانه بیشتر به آن نیاز دارد (کارگرانی که دیگر
// فعال نیستند را از دیدرس اول فهرست دور می‌کند، بدون این‌که مخفی‌شان کند).
type WorkerSortOption = "active-first" | "name-asc" | "wage-desc" | "wage-asc" | "newest";

const SORT_OPTION_VALUES: WorkerSortOption[] = ["active-first", "name-asc", "wage-desc", "wage-asc", "newest"];
const SORT_OPTION_ICONS: Record<WorkerSortOption, JSX.Element> = {
  "active-first": <ToggleOnIcon fontSize="small" />,
  "name-asc": <SortByAlphaIcon fontSize="small" />,
  "wage-desc": <TrendingUpIcon fontSize="small" />,
  "wage-asc": <TrendingDownIcon fontSize="small" />,
  newest: <NewReleasesIcon fontSize="small" />,
};
const SORT_OPTION_KEY: Record<WorkerSortOption, string> = {
  "active-first": "workers.sort.activeFirst",
  "name-asc": "workers.sort.nameAsc",
  "wage-desc": "workers.sort.wageDesc",
  "wage-asc": "workers.sort.wageAsc",
  newest: "workers.sort.newest",
};

export function WorkersPage({ embedded = false, onOpenBulkAttendance }: WorkersPageProps = {}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const SORT_OPTIONS = useMemo(
    () =>
      SORT_OPTION_VALUES.map((value) => ({
        value,
        label: t(SORT_OPTION_KEY[value]),
        icon: SORT_OPTION_ICONS[value],
      })),
    [t]
  );

  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<WorkerSortOption>("active-first");
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [deletingWorker, setDeletingWorker] = useState<Worker | null>(null);
  const [galleryWorker, setGalleryWorker] = useState<Worker | null>(null);
  const [wageDialogWorker, setWageDialogWorker] = useState<Worker | null>(null);
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [profileWorker, setProfileWorker] = useState<Worker | null>(null);
  // حضور و غیاب طبق ادغام دیگر تب جدا نیست؛ با تپ روی دکمهٔ کارت هر نیرو،
  // همین‌جا به‌صورت دیالوگ تمام‌صفحه باز می‌شود، قفل‌شده روی همان نیرو.
  const [attendanceWorker, setAttendanceWorker] = useState<Worker | null>(null);
  // وقتی حذف به‌خاطر وجود سابقه (حضور/دفتر حساب/...) رد شود، دیالوگ حذف به
  // یک پیشنهاد «غیرفعال کردن» تبدیل می‌شود؛ این state پیام دقیق را نگه می‌دارد.
  const [blockedDeleteMessage, setBlockedDeleteMessage] = useState<string | null>(null);

  // ایزوله‌سازی چندپروژه‌ای (مورد ۲ فهرست کارها): تا پیش از این، سوییچ
  // پروژه هیچ اثری روی فهرست نیروها نداشت چون این کوئری همیشه بدون فیلتر
  // پروژه صدا زده می‌شد. حالا با پاس‌دادن پروژهٔ فعال، فقط نیروهای همان
  // پروژه (به‌علاوهٔ نیروهای قدیمی/بدون‌لینک، طبق منطق workerService)
  // دیده می‌شوند.
  const { data: activeProjectId } = useQuery({
    queryKey: ["projects", "active"],
    queryFn: () => projectsApi.getActiveProjectId(),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["workers", activeProjectId],
    queryFn: () => workersApi.list({ projectId: activeProjectId }),
    enabled: !!activeProjectId,
  });

  const filteredWorkers = useMemo(() => {
    if (!data) return [];
    const term = search.trim();
    const base = term
      ? data.filter((w) =>
          matchesSearchTerm(`${w.firstName} ${w.lastName} ${w.position} ${w.phoneNumber ?? ""}`, term)
        )
      : data.slice();

    // مرتب‌سازی بدون تغییر آرایهٔ اصلی (که ممکن است مستقیماً از کش
    // react-query باشد). چون createdAt/id به‌ترتیب ثبت هستند، برای «جدیدترین»
    // از id به‌عنوان معیار پشتیبان استفاده می‌شود اگر createdAt یکسان بود.
    switch (sortOption) {
      case "name-asc":
        return base.sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, i18n.language)
        );
      case "wage-desc":
        return base.sort((a, b) => b.dailyBaseSalary - a.dailyBaseSalary);
      case "wage-asc":
        return base.sort((a, b) => a.dailyBaseSalary - b.dailyBaseSalary);
      case "newest":
        return base.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      case "active-first":
      default:
        return base.sort((a, b) => Number(b.isActive) - Number(a.isActive));
    }
  }, [data, search, sortOption, i18n.language]);

  // شمار نیروهای فعال داخل همان فهرست فیلترشده — برای نمایش سریع «چند نفر
  // از این‌ها فعال هستند» بدون نیاز به اسکرول کردن کل فهرست.
  const activeInFilteredCount = useMemo(
    () => filteredWorkers.filter((w) => w.isActive).length,
    [filteredWorkers]
  );

  async function applyAvatarAction(
    workerId: string,
    previousAvatarPhotoId: string | null,
    action: AvatarPickerAction
  ): Promise<void> {
    if (action.type === "none") return;

    if (action.type === "set") {
      const newPhoto = await photosApi.upload({
        file: action.file,
        relatedType: "worker-avatar",
        relatedId: workerId,
        date: getTodayIso(),
        caption: null,
      });
      await workersApi.update(workerId, { avatarPhotoId: newPhoto.id });
    } else {
      await workersApi.update(workerId, { avatarPhotoId: null });
    }

    // پاک‌سازی عکس پروفایل قبلی که دیگر استفاده نمی‌شود (best-effort).
    if (previousAvatarPhotoId) {
      try {
        await photosApi.remove(previousAvatarPhotoId);
      } catch {
        // اگر حذف ناموفق بود، مشکلی نیست؛ فقط یک فایل یتیم در پایگاه‌داده باقی می‌ماند.
      }
    }
  }

  const createMutation = useMutation({
    mutationFn: async (vars: { input: CreateWorkerInput; avatarAction: AvatarPickerAction }) => {
      const created = await workersApi.create(vars.input);
      await applyAvatarAction(created.id, null, vars.avatarAction);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      showToast(t("workers.toastAdded"), "success");
      setFormOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      input: UpdateWorkerInput;
      avatarAction: AvatarPickerAction;
      previousAvatarPhotoId: string | null;
    }) => {
      const updated = await workersApi.update(vars.id, vars.input);
      await applyAvatarAction(vars.id, vars.previousAvatarPhotoId, vars.avatarAction);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      showToast(t("workers.toastUpdated"), "success");
      setFormOpen(false);
      setEditingWorker(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (worker: Worker) => {
      await workersApi.remove(worker.id);
      if (worker.avatarPhotoId) {
        try {
          await photosApi.remove(worker.avatarPhotoId);
        } catch {
          // پاک‌سازی عکس پروفایل صرفاً best-effort است؛ عدم موفقیت مانع حذف نیرو نمی‌شود.
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      showToast(t("workers.toastDeleted"), "success");
      setDeletingWorker(null);
    },
    onError: (err) => {
      if (err instanceof HasDependenciesError) {
        // به‌جای toast خطا، خود دیالوگ به پیشنهاد «غیرفعال کردن» تبدیل می‌شود.
        setBlockedDeleteMessage(err.message);
        return;
      }
      showToast(extractErrorMessage(err), "error");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => workersApi.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  function handleOpenCreate() {
    setEditingWorker(null);
    setFormOpen(true);
  }

  function handleOpenEdit(worker: Worker) {
    setEditingWorker(worker);
    setFormOpen(true);
  }

  async function handleCopyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(t("workers.toastCopiedGeneric", { label }), "success");
    } catch {
      showToast(t("workers.toastCopyUnsupported"), "error");
    }
  }

  // اشتراک‌گذاری خلاصهٔ اطلاعات تماس/بانکی یک نیرو به‌صورت یک متن آماده —
  // برای مواقعی که سرپرست باید این اطلاعات را (مثلاً برای واریز حقوق) به
  // کارفرما یا حسابدار ارسال کند، بدون این‌که مجبور باشد هرکدام از شماره‌ها
  // را جداگانه کپی و پیست کند. از همان منوی اشتراک‌گذاری بومی گوشی (یا
  // در نبود آن، کپی به کلیپ‌بورد) استفاده می‌کند — دقیقاً همان الگوی
  // «اشتراک‌گذاری خلاصهٔ امروز» در داشبورد.
  async function handleShareInfo(worker: Worker) {
    const lines = [
      `${t("workers.shareLabels.worker")}: ${worker.firstName} ${worker.lastName}`,
      `${t("workers.shareLabels.position")}: ${worker.position}`,
    ];
    if (worker.phoneNumber) lines.push(`${t("workers.shareLabels.phone")}: ${worker.phoneNumber}`);
    (worker.cardNumbers ?? []).forEach((num, idx) => {
      lines.push(`${t("workers.shareLabels.cardNumber")}${worker.cardNumbers.length > 1 ? ` ${idx + 1}` : ""}: ${num}`);
    });
    (worker.shebaNumbers ?? []).forEach((num, idx) => {
      lines.push(`${t("workers.shareLabels.sheba")}${worker.shebaNumbers.length > 1 ? ` ${idx + 1}` : ""}: IR${num}`);
    });
    const text = lines.join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // لغو کردن منوی اشتراک‌گذاری توسط کاربر یک رفتار عادی است.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast(t("workers.toastWorkerInfoCopied"), "success");
    } catch {
      showToast(t("workers.toastShareCopyUnsupported"), "error");
    }
  }

  function handleSubmit(input: CreateWorkerInput | UpdateWorkerInput, avatarAction: AvatarPickerAction) {
    if (editingWorker) {
      updateMutation.mutate({
        id: editingWorker.id,
        input,
        avatarAction,
        previousAvatarPhotoId: editingWorker.avatarPhotoId,
      });
    } else {
      createMutation.mutate({ input: input as CreateWorkerInput, avatarAction });
    }
  }

  function closeDeleteFlow() {
    setDeletingWorker(null);
    setBlockedDeleteMessage(null);
  }

  function handleDeactivateInstead() {
    if (deletingWorker) {
      toggleActiveMutation.mutate(deletingWorker.id);
      showToast(t("workers.toastDeactivated"), "success");
    }
    closeDeleteFlow();
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {!embedded && (
        <Typography variant="h5" fontWeight={700}>
          {t("workers.pageTitle")}
        </Typography>
      )}

      {/* نوار ابزار «نیروها» بازطراحی شد: قبلاً یک TextField مستقل و دو
          IconButton با کادر جدا کنار هم بودند (سه عنصر بصری مجزا). حالا در
          یک قاب یکپارچهٔ هم‌شکل با زبان بصری pill بقیهٔ اپ (نوار تب‌های
          سگمنتی، نوار ناوبری پایین) ادغام شده‌اند، به‌علاوهٔ دکمهٔ پاک‌کردن
          سریع متن جست‌وجو که قبلاً اصلاً وجود نداشت. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(17,19,24,0.045)"),
          borderRadius: 999,
          pr: 1.5,
          pl: 0.5,
          py: 0.5,
        }}
      >
        <SearchIcon fontSize="small" sx={{ color: "text.secondary", ml: 1 }} />
        <InputBase
          placeholder={t("workers.searchPlaceholder") as string}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ "aria-label": t("workers.searchPlaceholder") as string }}
          sx={{ flex: 1, fontSize: 14, mx: 1 }}
        />
        {search && (
          <IconButton
            size="small"
            onClick={() => setSearch("")}
            aria-label={t("common.clearSearch") as string}
            sx={{ p: 0.5 }}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
        <Divider orientation="vertical" flexItem sx={{ my: 0.75, mx: 0.25 }} />
        <Tooltip title={t("workers.sortTooltip") as string}>
          <IconButton
            size="small"
            onClick={(e) => setSortMenuAnchor(e.currentTarget)}
            aria-label={t("workers.sortAriaLabel") as string}
            color={sortOption !== "active-first" ? "primary" : "default"}
          >
            <SortIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {/* میان‌بر «شغل‌ها و دستمزد» — قبلاً فقط از داخل تنظیمات پیدا می‌شد
            (کاملاً بی‌ربط به بقیهٔ محتوای آن صفحه)، درحالی‌که مستقیماً به
            همین‌جا (تیپ‌های نیرو و نحوهٔ محاسبهٔ دستمزدشان) مرتبط است؛ طبق
            ادغام منوها به همین تب منتقل شد تا کاربر مجبور به حدس‌زدن مسیرش
            در تنظیمات نباشد. */}
        <Tooltip title={t("workers.wageSettingsTooltip") as string}>
          <IconButton
            size="small"
            onClick={() => navigate("/wage-settings")}
            aria-label={t("workers.wageSettingsTooltip") as string}
          >
            <WorkOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {/* دسترسی به مدیریت اکیپ‌ها (پرداخت جمعی) — برای نیروهایی که گروهی
            کار می‌کنند و دستمزدشان به‌صورت یک مبلغ کلی به کل اکیپ پرداخت
            می‌شود، نه سرانه. */}
        <Tooltip title="اکیپ‌ها (پرداخت جمعی)">
          <IconButton size="small" onClick={() => setGroupsDialogOpen(true)} aria-label="اکیپ‌ها (پرداخت جمعی)">
            <GroupWorkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={sortMenuAnchor} open={!!sortMenuAnchor} onClose={() => setSortMenuAnchor(null)}>
          {SORT_OPTIONS.map((opt) => (
            <MenuItem
              key={opt.value}
              selected={sortOption === opt.value}
              onClick={() => {
                setSortOption(opt.value);
                setSortMenuAnchor(null);
              }}
            >
              <ListItemIcon>{opt.icon}</ListItemIcon>
              <ListItemText>{opt.label}</ListItemText>
              {sortOption === opt.value && <CheckIcon fontSize="small" color="primary" />}
            </MenuItem>
          ))}
        </Menu>
      </Box>

      {data && filteredWorkers.length > 0 && (
        <Stack direction="row" spacing={1}>
          <Chip
            size="small"
            variant="outlined"
            label={t("workers.activeCountChip", { active: activeInFilteredCount, total: filteredWorkers.length })}
          />
          <Chip
            size="small"
            variant="outlined"
            color="primary"
            label={SORT_OPTIONS.find((o) => o.value === sortOption)?.label}
          />
          {onOpenBulkAttendance && (
            <Chip
              size="small"
              color="primary"
              icon={<GroupsIcon />}
              label={t("attendance.bulk.entryChip")}
              aria-label={t("attendance.bulk.entryAria") as string}
              onClick={onOpenBulkAttendance}
              sx={{ borderRadius: "16px", fontWeight: 700 }}
            />
          )}
        </Stack>
      )}

      {isLoading && <SkeletonList count={5} />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {data && filteredWorkers.length === 0 && (
        <EmptyState
          icon={<GroupsIcon fontSize="inherit" />}
          title={search ? t("workers.emptyNoResults") : t("workers.emptyNone")}
          description={search ? t("workers.emptyNoResultsDesc") : t("workers.emptyNoneDesc")}
        />
      )}

      {data && filteredWorkers.length > 0 && (
        <PullToRefresh onRefresh={() => refetch()}>
          <AnimatedList>
            {filteredWorkers.map((worker) => (
              <SwipeToDelete
                key={worker.id}
                onDelete={() => setDeletingWorker(worker)}
                ariaLabel={t("workers.deleteAriaLabel", { name: `${worker.firstName} ${worker.lastName}` }) as string}
              >
                <WorkerCard
                  worker={worker}
                  onEdit={handleOpenEdit}
                  onDelete={setDeletingWorker}
                  onToggleActive={(w) => toggleActiveMutation.mutate(w.id)}
                  onOpenGallery={setGalleryWorker}
                  onOpenWageDialog={setWageDialogWorker}
                  onCopyValue={handleCopyValue}
                  onShareInfo={handleShareInfo}
                  onOpenProfile={setProfileWorker}
                  onOpenAttendance={setAttendanceWorker}
                />
              </SwipeToDelete>
            ))}
          </AnimatedList>
        </PullToRefresh>
      )}

      <ScrollToTopFab />

      <Fab
        color="primary"
        onClick={handleOpenCreate}
        sx={{ position: "fixed", bottom: 84, left: 20, zIndex: 5 }}
        aria-label={t("workers.addAriaLabel") as string}
      >
        <AddIcon />
      </Fab>

      <WorkerFormDialog
        open={formOpen}
        worker={editingWorker}
        loading={createMutation.isPending || updateMutation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deletingWorker}
        title={blockedDeleteMessage ? t("workers.deleteDialog.blockedTitle") : t("workers.deleteDialog.title")}
        description={
          blockedDeleteMessage
            ? blockedDeleteMessage
            : deletingWorker
            ? (t("workers.deleteDialog.confirmText", { name: `${deletingWorker.firstName} ${deletingWorker.lastName}` }) as string)
            : ""
        }
        confirmLabel={blockedDeleteMessage ? t("workers.deleteDialog.confirmDeactivate") : t("workers.deleteDialog.confirmDelete")}
        confirmColor={blockedDeleteMessage ? "primary" : "error"}
        loading={deleteMutation.isPending || toggleActiveMutation.isPending}
        onConfirm={() => {
          if (blockedDeleteMessage) {
            handleDeactivateInstead();
          } else if (deletingWorker) {
            deleteMutation.mutate(deletingWorker);
          }
        }}
        onCancel={closeDeleteFlow}
      />

      <PhotoGalleryDialog
        open={!!galleryWorker}
        title={galleryWorker ? (t("workers.galleryTitle", { name: `${galleryWorker.firstName} ${galleryWorker.lastName}` }) as string) : ""}
        relatedType="worker"
        relatedId={galleryWorker?.id ?? null}
        onClose={() => setGalleryWorker(null)}
      />

      <WorkerWageDialog open={!!wageDialogWorker} worker={wageDialogWorker} onClose={() => setWageDialogWorker(null)} />

      <WorkerGroupsDialog open={groupsDialogOpen} onClose={() => setGroupsDialogOpen(false)} />

      <WorkerProfileDialog
        open={!!profileWorker}
        worker={profileWorker}
        onClose={() => setProfileWorker(null)}
      />

      {/* حضور و غیاب ادغام‌شده: صفحهٔ حضور که قبلاً تب مستقل «منابع» بود،
          اینجا به‌صورت دیالوگ تمام‌صفحه و قفل‌شده روی همین یک نیرو بازآفرینی
          می‌شود؛ سربرگ دیالوگ (نام نیرو + دکمهٔ بستن) جای همان تیتر/انتخابگر
          نیرو که در حالت مستقل بالای صفحه بود را می‌گیرد. */}
      <Dialog fullScreen open={!!attendanceWorker} onClose={() => setAttendanceWorker(null)}>
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={() => setAttendanceWorker(null)} aria-label={t("common.close") as string}>
              <CloseIcon />
            </IconButton>
            <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }} noWrap>
              {attendanceWorker ? `حضور و غیاب — ${attendanceWorker.firstName} ${attendanceWorker.lastName}` : "حضور و غیاب"}
            </Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 2, overflowY: "auto" }}>
          {attendanceWorker && <AttendancePage embedded lockedWorkerId={attendanceWorker.id} />}
        </Box>
      </Dialog>
    </Box>
  );
}
