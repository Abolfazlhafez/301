import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AppBar,
  Box,
  Checkbox,
  Fab,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Toolbar,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import { useEffect, useMemo, useRef, useState } from "react";
import { photosApi } from "../../shared/api/photosApi";
import { extractErrorMessage } from "../../shared/api/client";
import { PhotoRelatedType, Photo } from "../../entities/Photo";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { SafePhotoImage } from "../../shared/components/SafePhotoImage";
import { useToast } from "../../shared/components/ToastProvider";
import { PhotoUploadDialog } from "./PhotoUploadDialog";
import { PhotoLightbox } from "./PhotoLightbox";
import { toJalaliShort } from "../../shared/utils/jalaliDate";

interface PhotoGalleryProps {
  relatedType: PhotoRelatedType;
  relatedId?: string | null;
  floorId?: string;
  stageId?: string;
  taskId?: string;
  issueId?: string;
  checklistItemId?: string;
  phase?: "before" | "during" | "after" | null;
  emptyTitle?: string;
  emptyDescription?: string;
  compact?: boolean; // در حالت فشرده، ارتفاع کمتر و بدون Fab شناور است
}

/**
 * گالری عکس قابل استفاده مجدد. بر اساس relatedType/relatedId، عکس‌های مرتبط
 * با یک نیرو، یک قلم لوازم، یک روز حضور خاص، یا گالری عمومی کارگاه (site) را نمایش می‌دهد.
 */
export function PhotoGallery({
  relatedType,
  relatedId, floorId, stageId, taskId, issueId, checklistItemId, phase,
  emptyTitle,
  emptyDescription,
  compact = false,
}: PhotoGalleryProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<Photo | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  // --- حالت انتخاب چندتایی (با فشردن طولانی وارد می‌شویم) ---
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);
  // اگر فشردن طولانی واقعاً باعث ورود به حالت انتخاب شده باشد، باید جلوی
  // رویداد onClick معمولی که بلافاصله بعدش (روی موبایل) شلیک می‌شود گرفته
  // شود — وگرنه هم لایت‌باکس عکس باز می‌شود و هم وارد حالت انتخاب می‌شویم.
  const suppressNextClick = useRef(false);

  const LONG_PRESS_MS = 500;
  const MOVE_CANCEL_THRESHOLD_PX = 10;

  function clearLongPressTimer() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startLongPress(photoId: string, x: number, y: number) {
    longPressStartPos.current = { x, y };
    clearLongPressTimer();
    longPressTimer.current = setTimeout(() => {
      setSelectionMode(true);
      setSelectedIds([photoId]);
      suppressNextClick.current = true;
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(x: number, y: number) {
    if (!longPressStartPos.current) return;
    const dx = Math.abs(x - longPressStartPos.current.x);
    const dy = Math.abs(y - longPressStartPos.current.y);
    if (dx > MOVE_CANCEL_THRESHOLD_PX || dy > MOVE_CANCEL_THRESHOLD_PX) {
      clearLongPressTimer();
    }
  }

  function endLongPress() {
    clearLongPressTimer();
    longPressStartPos.current = null;
  }

  // اگر کاربر وسط نگه‌داشتن انگشت از این صفحه خارج شود (مثلاً با ناوبری)،
  // تایمر فشردن طولانی باید پاک شود تا بعد از unmount شدن کامپوننت اجرا نشود.
  useEffect(() => {
    return () => clearLongPressTimer();
  }, []);

  function toggleSelected(photoId: string) {
    setSelectedIds((prev) => (prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]));
  }

  function handlePhotoTap(photo: Photo) {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    if (selectionMode) {
      // حتی اگر با لغو انتخاب آخرین عکس، انتخاب کاملاً خالی شود، از حالت
      // انتخاب خودکار خارج نمی‌شویم — چون «لغو انتخاب» طبق نیاز، خودش یک
      // دکمهٔ صریح و جداست (آیکون × در نوار بالا)، نه رفتاری که به‌طور
      // ضمنی از صفر شدن تعداد انتخاب‌شده‌ها نتیجه شود.
      toggleSelected(photo.id);
      return;
    }
    setSelectedPhoto(photo);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  const queryKey = ["photos", relatedType, relatedId, floorId, stageId, taskId, issueId, checklistItemId, phase];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => photosApi.list({ relatedType, relatedId: relatedId || undefined, floorId, stageId, taskId, issueId, checklistItemId, phase }),
    enabled: relatedType === "site" || !!relatedId,
  });

  // رندر تدریجی: فقط دسته‌ای از عکس‌ها وارد DOM می‌شود و با نزدیک شدن به انتهای لیست، دستهٔ بعد اضافه می‌شود.
  // (بارگذاری تنبل/آزادسازی عکس هر آیتم در SafePhotoImage دست‌نخورده است.)
  const PAGE_SIZE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const total = data?.length ?? 0;
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [relatedType, relatedId, floorId, stageId, taskId, issueId, checklistItemId, phase]);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= total || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + PAGE_SIZE);
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, total]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function selectAll() {
    if (!data) return;
    setSelectedIds(data.map((p) => p.id));
  }

  const uploadMutation = useMutation({
    mutationFn: async (input: { files: File[]; date: string; caption: string | null }) => {
      let failCount = 0;
      setUploadProgress({ done: 0, total: input.files.length });
      for (let i = 0; i < input.files.length; i++) {
        try {
          await photosApi.upload({
            file: input.files[i],
            date: input.date,
            caption: input.caption,
            relatedType,
            relatedId, floorId, stageId, taskId, issueId, checklistItemId, phase,
          });
        } catch {
          failCount++;
        }
        setUploadProgress({ done: i + 1, total: input.files.length });
      }
      return { total: input.files.length, failCount };
    },
    onSuccess: ({ total, failCount }) => {
      queryClient.invalidateQueries({ queryKey });
      setUploadOpen(false);
      setUploadProgress(null);
      if (failCount === 0) {
        showToast(
          total > 1 ? (t("photoGallery.gallery.uploadedMultiple", { count: total }) as string) : (t("photoGallery.gallery.uploadedSingle") as string),
          "success"
        );
      } else {
        showToast(
          t("photoGallery.gallery.uploadedPartial", { success: total - failCount, total, failed: failCount }) as string,
          "error"
        );
      }
    },
    onError: (err) => {
      setUploadProgress(null);
      showToast(extractErrorMessage(err), "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => photosApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showToast(t("photoGallery.gallery.deletedSingle") as string, "success");
      setDeletingPhoto(null);
      setSelectedPhoto(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      let failCount = 0;
      for (const id of ids) {
        try {
          await photosApi.remove(id);
        } catch {
          failCount++;
        }
      }
      return { total: ids.length, failCount };
    },
    onSuccess: ({ total, failCount }) => {
      queryClient.invalidateQueries({ queryKey });
      setBulkDeleteOpen(false);
      exitSelectionMode();
      if (failCount === 0) {
        showToast(t("photoGallery.gallery.deletedMultiple", { count: total }) as string, "success");
      } else {
        showToast(
          t("photoGallery.gallery.deletedPartial", { success: total - failCount, total, failed: failCount }) as string,
          "error"
        );
      }
    },
    onError: (err) => {
      setBulkDeleteOpen(false);
      showToast(extractErrorMessage(err), "error");
    },
  });

  return (
    <Box sx={{ position: "relative", minHeight: compact ? 120 : 200 }}>
      {selectionMode && (
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{ top: 0, zIndex: 4, borderRadius: 1.5, mb: 1 }}
        >
          <Toolbar variant="dense" sx={{ gap: 0.5, minHeight: 48 }}>
            <IconButton onClick={exitSelectionMode} size="small" aria-label={t("photoGallery.gallery.cancelSelection") as string}>
              <CloseIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
              {t("photoGallery.gallery.selectedCount", { count: selectedIds.length })}
            </Typography>
            <IconButton
              onClick={selectedIds.length === (data?.length ?? 0) ? () => setSelectedIds([]) : selectAll}
              size="small"
              aria-label={t("photoGallery.gallery.selectAll") as string}
            >
              {selectedIds.length === (data?.length ?? 0) ? (
                <CheckBoxIcon fontSize="small" />
              ) : (
                <CheckBoxOutlineBlankIcon fontSize="small" />
              )}
            </IconButton>
            <IconButton
              onClick={() => setBulkDeleteOpen(true)}
              size="small"
              color="error"
              disabled={selectedIds.length === 0}
              aria-label={t("photoGallery.gallery.deleteSelected") as string}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      {isLoading && <LoadingState message={t("photoGallery.gallery.loading") as string} />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={<PhotoLibraryIcon fontSize="inherit" />}
          title={emptyTitle ?? (t("photoGallery.gallery.emptyTitle") as string)}
          description={emptyDescription ?? (t("photoGallery.gallery.emptyDescription") as string)}
        />
      )}

      {data && data.length > 0 && (
        <ImageList cols={3} gap={6} sx={{ mb: 0 }}>
          {data.slice(0, visibleCount).map((photo) => {
            const isSelected = selectedSet.has(photo.id);
            return (
              <ImageListItem
                key={photo.id}
                sx={{
                  borderRadius: 1.5,
                  overflow: "hidden",
                  position: "relative",
                  outline: isSelected ? "3px solid" : "none",
                  outlineColor: "primary.main",
                  transition: "outline-color 120ms ease-out",
                }}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  startLongPress(photo.id, t.clientX, t.clientY);
                }}
                onTouchMove={(e) => {
                  const t = e.touches[0];
                  handlePointerMove(t.clientX, t.clientY);
                }}
                onTouchEnd={endLongPress}
                onTouchCancel={endLongPress}
                onMouseDown={(e) => startLongPress(photo.id, e.clientX, e.clientY)}
                onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
                onMouseUp={endLongPress}
                onMouseLeave={endLongPress}
              >
                <SafePhotoImage
                  photo={photo}
                  onClick={() => handlePhotoTap(photo)}
                  onRetried={() => queryClient.invalidateQueries({ queryKey })}
                  sx={{ width: "100%", height: "100%" }}
                  imgSx={{ width: "100%", aspectRatio: "1", objectFit: "cover" }}
                />
                {selectionMode && (
                  <Checkbox
                    checked={isSelected}
                    onClick={(e) => {
                      // چون خودِ Checkbox روی عکس نشسته، اگر کلیک آن هم به
                      // SafePhotoImage زیرش برسد، هندلر onClick دوبار (یک‌بار
                      // از خودِ چک‌باکس، یک‌بار از تصویر) اجرا می‌شود.
                      e.stopPropagation();
                      toggleSelected(photo.id);
                    }}
                    size="small"
                    sx={{
                      position: "absolute",
                      top: 2,
                      insetInlineStart: 2,
                      p: 0.25,
                      bgcolor: "rgba(0,0,0,0.55)",
                      borderRadius: "50%",
                      pointerEvents: "auto",
                      "& .MuiSvgIcon-root": { color: "#fff", fontSize: 18 },
                      "&.Mui-checked .MuiSvgIcon-root": { color: "primary.main" },
                    }}
                  />
                )}
                {!selectionMode && (
                  <ImageListItemBar
                    title={<Typography variant="caption">{toJalaliShort(photo.date)}</Typography>}
                    sx={{
                      pointerEvents: "none",
                      "& .MuiImageListItemBar-title": { fontSize: "0.65rem" },
                      background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
                    }}
                  />
                )}
              </ImageListItem>
            );
          })}
        </ImageList>
      )}
      {data && visibleCount < data.length && <Box ref={sentinelRef} sx={{ height: 1 }} />}

      {!selectionMode && (
        <Fab
          color="primary"
          size={compact ? "small" : "medium"}
          onClick={() => setUploadOpen(true)}
          sx={
            compact
              ? { position: "absolute", bottom: 0, left: 0 }
              : { position: "fixed", bottom: 84, left: 20, zIndex: 5 }
          }
          aria-label={t("photoGallery.gallery.addPhotoAria") as string}
        >
          <AddIcon />
        </Fab>
      )}

      <PhotoUploadDialog
        open={uploadOpen}
        loading={uploadMutation.isPending}
        progressLabel={
          uploadProgress
            ? (t("photoGallery.gallery.uploadingProgress", { done: uploadProgress.done, total: uploadProgress.total }) as string)
            : undefined
        }
        onClose={() => setUploadOpen(false)}
        onSubmit={(input) => uploadMutation.mutate(input)}
      />

      <PhotoLightbox
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        onDelete={(p) => setDeletingPhoto(p)}
        onRetried={() => queryClient.invalidateQueries({ queryKey })}
      />

      <ConfirmDialog
        open={!!deletingPhoto}
        title={t("photoGallery.gallery.deleteConfirmTitle") as string}
        description={t("photoGallery.gallery.deleteConfirmDescription") as string}
        confirmLabel={t("photoGallery.gallery.deleteAction") as string}
        loading={deleteMutation.isPending}
        onConfirm={() => deletingPhoto && deleteMutation.mutate(deletingPhoto.id)}
        onCancel={() => setDeletingPhoto(null)}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={t("photoGallery.gallery.bulkDeleteConfirmTitle", { count: selectedIds.length }) as string}
        description={t("photoGallery.gallery.bulkDeleteConfirmDescription", { count: selectedIds.length }) as string}
        confirmLabel={t("photoGallery.gallery.bulkDeleteConfirmAction", { count: selectedIds.length }) as string}
        loading={bulkDeleteMutation.isPending}
        onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </Box>
  );
}
