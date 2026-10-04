import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Fab,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AssignmentIcon from "@mui/icons-material/Assignment";
import IosShareIcon from "@mui/icons-material/IosShare";
import EditIcon from "@mui/icons-material/Edit";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { photosApi, getPhotoUrl } from "../../shared/api/photosApi";
import { PhotoThumbImg } from "../../shared/components/PhotoThumbImg";
import { workLogNoteApi } from "../../shared/api/workLogNoteApi";
import { settingsApi } from "../../shared/api/settingsApi";
import { extractErrorMessage } from "../../shared/api/client";
import { Photo } from "../../entities/Photo";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { SkeletonList } from "../../shared/components/SkeletonList";
import { PullToRefresh } from "../../shared/components/PullToRefresh";
import { SwipeToDelete } from "../../shared/components/SwipeToDelete";
import { useToast } from "../../shared/components/ToastProvider";
import { PhotoLightbox } from "../photo-gallery/PhotoLightbox";
import { EditTextDialog } from "../../shared/components/EditTextDialog";
import { MAX_WORK_LOG_PHOTOS_PER_DAY, WorkLogEntryDialog, WorkLogEntrySubmission } from "./WorkLogEntryDialog";
import {
  WorkReportBuilderDialog,
  ReportPhotoSelection,
} from "./WorkReportBuilderDialog";
import { toJalaliDisplay, toJalaliWithWeekday } from "../../shared/utils/jalaliDate";
import { exportElementAsShareableImage } from "../../shared/utils/exportCard";
import { PictureCardFrame } from "../../features/picture-cards/PictureCardFrame";

interface WorkLogDayEntriesProps {
  date: string; // تاریخ ISO میلادی روز انتخاب‌شده
}

const EXPORT_WIDTH = 1000;

/**
 * فهرست گزارش‌های کار ثبت‌شده برای یک روز مشخص: عکس + توضیح متنی برای هر
 * ورودی، به همراه امکان اشتراک‌گذاری تصویری خلاصهٔ کل روز با یک لمس (کارت
 * «گزارش کار» که از قالب PictureCardFrame داخلی برنامه استفاده می‌کند، ولی
 * بخش مستقل «پیکچر کارت» با قالب/چیدمان دستی از برنامه حذف شده است).
 */
export function WorkLogDayEntries({ date }: WorkLogDayEntriesProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("sm"));
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<Photo | null>(null);
  const [editingCaptionPhoto, setEditingCaptionPhoto] = useState<Photo | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);

  // کلید کوئری باید شامل خودِ تاریخ باشد؛ در غیر این صورت React Query همه روزها
  // را زیر یک کش مشترک می‌بیند و با تغییر روز (یا mount مجدد صفحه با روز
  // پیش‌فرض متفاوت پس از بستن/بازکردن اپ)، داده تازه‌ای برای روز جدید
  // نمی‌گیرد و نتیجه کش‌شدهٔ روز قبلی (که می‌تواند خالی باشد) نمایش داده
  // می‌شود — این ریشهٔ باگ «عکس‌ها بعد از بازگشت به اپ ناپدید می‌شوند» بود.
  const photosQueryKey = ["photos", "site", "day", date];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: photosQueryKey,
    queryFn: () => photosApi.list({ relatedType: "site", from: date, to: date }),
    refetchOnMount: "always",
  });

  const { data: workLogNote } = useQuery({
    queryKey: ["work-log-note", date],
    queryFn: () => workLogNoteApi.getByDate(date),
  });

  // آخرین توضیح متنیِ ثبت‌شده برای روزی قبل از امروز — فقط به‌عنوان
  // پیشنهاد در دیالوگ ویرایش توضیحات نشان داده می‌شود (وقتی خودِ امروز
  // هنوز چیزی ندارد)، نه این‌که خودکار جایگزین شود. برای یادداشت‌های
  // زیاد listAll کمی بیش‌ازحد است، اما این جدول همیشه کوچک است (حداکثر
  // یک ردیف به‌ازای هر روز کاری پروژه) و همین الگو (listAll + فیلتر در
  // کلاینت) جای دیگری از برنامه هم استفاده شده.
  const { data: allWorkLogNotes } = useQuery({
    queryKey: ["work-log-note", "all"],
    queryFn: () => workLogNoteApi.listAll(),
  });
  const previousDescription = useMemo(() => {
    const prior = (allWorkLogNotes ?? [])
      .filter((n) => n.date < date && n.description.trim() !== "")
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return prior[0]?.description;
  }, [allWorkLogNotes, date]);

  const { data: appSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const updateCaptionMutation = useMutation({
    mutationFn: (input: { id: string; caption: string }) => photosApi.updateCaption(input.id, input.caption),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: photosQueryKey });
      setEditingCaptionPhoto(null);
      showToast(t("workLog.dayEntries.captionSaved"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateDescriptionMutation = useMutation({
    mutationFn: (description: string) => workLogNoteApi.upsert(date, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-log-note", date] });
      setEditingDescription(false);
      showToast(t("workLog.dayEntries.descriptionSaved"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const allDayPhotos = data ?? [];
  const entries = allDayPhotos;

  function invalidatePhotos() {
    queryClient.invalidateQueries({ queryKey: ["photos", "site"] });
  }

  const uploadMutation = useMutation({
    mutationFn: async (input: WorkLogEntrySubmission) => {
      for (const file of input.files) {
        await photosApi.upload({ file, caption: input.caption, relatedType: "site", relatedId: null, date });
      }
      return { count: input.files.length };
    },
    onSuccess: (result) => {
      invalidatePhotos();
      showToast(
        result.count > 1 ? t("workLog.dayEntries.uploadedMany", { n: result.count }) : t("workLog.dayEntries.uploadedOne"),
        "success"
      );
      setAddOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => photosApi.remove(id),
    onSuccess: () => {
      invalidatePhotos();
      showToast(t("workLog.dayEntries.deleted"), "success");
      setDeletingPhoto(null);
      setSelectedPhoto(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  // --- جهش‌های پیکچر کارت ---
  const reportCardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [reportBuilderOpen, setReportBuilderOpen] = useState(false);
  const [reportSelection, setReportSelection] = useState<ReportPhotoSelection[]>([]);

  // چون html2canvas نیاز دارد که خودِ عنصر واقعاً روی صفحه رندر شده باشد،
  // نمی‌توان بلافاصله بعد از تغییر state عکس گرفت — باید یک فریم صبر کرد تا
  // React رندر جدید (با عکس‌ها/توضیحات تازه) را واقعاً روی DOM اعمال کند.
  async function handleReportBuilderConfirm(selection: ReportPhotoSelection[]) {
    setReportSelection(selection);
    setReportBuilderOpen(false);
    setIsSharing(true);
    try {
      // توضیحاتی که کاربر برای هر عکس نوشته، واقعاً روی همان عکس ذخیره
      // می‌شود (نه فقط برای همین یک گزارش موقتاً استفاده شود) — چون طبق
      // نیاز، این محل، محل اصلی ثبت توضیح آن عکس است، نه یک فیلد یک‌بارمصرف.
      // فقط عکس‌هایی که توضیح‌شان واقعاً عوض شده به‌روزرسانی می‌شوند تا
      // درخواست‌های شبکه/دیتابیس غیرضروری زده نشود.
      await Promise.all(
        selection.map((sel) => {
          const current = allDayPhotos.find((p) => p.id === sel.photoId);
          const nextCaption = sel.caption || null;
          if (!current || current.caption === nextCaption) return Promise.resolve();
          return photosApi.updateCaption(sel.photoId, nextCaption);
        })
      );
      invalidatePhotos();

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!reportCardRef.current) return;
      const jalali = toJalaliDisplay(date).replace(/\s/g, "-");
      await exportElementAsShareableImage(
        reportCardRef.current,
        `${t("workLog.dayEntries.reportFilePrefix")}-${jalali}.png`,
        t("workLog.dayEntries.shareTitle", { date: toJalaliDisplay(date) })
      );
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setIsSharing(false);
    }
  }

  const isLoadingAny = isLoading;
  const hasNothing = !isLoadingAny && !isError && entries.length === 0;

  return (
    <Box sx={{ position: "relative", minHeight: 160 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {toJalaliWithWeekday(date)}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            onClick={() => setEditingDescription(true)}
            aria-label={t("workLog.dayEntries.editDescription")}
          >
            <EditNoteIcon />
          </IconButton>
          <IconButton
            onClick={() => setReportBuilderOpen(true)}
            disabled={isSharing || allDayPhotos.length === 0}
            color="primary"
            aria-label={t("workLog.dayEntries.buildReport")}
          >
            {isSharing ? <CircularProgress size={20} /> : <IosShareIcon />}
          </IconButton>
        </Stack>
      </Stack>

      {isLoadingAny && <SkeletonList count={3} rowHeight={110} withAvatar={false} />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {hasNothing && (
        <EmptyState
          icon={<AssignmentIcon fontSize="inherit" />}
          title={t("workLog.dayEntries.emptyTitle")}
          description={t("workLog.dayEntries.emptyDesc")}
        />
      )}

      {/* بخش گزارش‌های ساده (عکس + توضیح) */}
      {entries.length > 0 && (
        <PullToRefresh onRefresh={() => refetch()}>
        <Stack spacing={1.5} sx={{ mb: 9 }}>
          {entries.map((photo) => (
            <SwipeToDelete key={photo.id} onDelete={() => setDeletingPhoto(photo)} ariaLabel={t("workLog.dayEntries.deleteSwipeAria")}>
            <Card variant="outlined">
              <CardContent sx={{ p: "0 !important" }}>
                <Stack direction={isNarrow ? "column" : "row"} sx={{ alignItems: "stretch" }}>
                  <Box
                    sx={{
                      flex: isNarrow ? "none" : "0 0 70%",
                      p: 1.5,
                      display: "flex",
                      alignItems: "center",
                      order: isNarrow ? 2 : 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                      color={photo.caption ? "text.primary" : "text.secondary"}
                    >
                      {photo.caption || t("workLog.dayEntries.noCaption")}
                    </Typography>
                  </Box>

                  <Box
                    onClick={() => setSelectedPhoto(photo)}
                    sx={{
                      flex: isNarrow ? "none" : "0 0 30%",
                      order: isNarrow ? 1 : 2,
                      cursor: "pointer",
                      minHeight: isNarrow ? 160 : "auto",
                      position: "relative",
                    }}
                  >
                    <PhotoThumbImg
                      photo={photo}
                      alt={photo.caption || t("workLog.dayEntries.photoAlt")}
                      sx={{
                        width: "100%",
                        height: "100%",
                        minHeight: isNarrow ? 160 : 110,
                        objectFit: "cover",
                        display: "block",
                        borderRadius: isNarrow ? "8px 8px 0 0" : "0 8px 8px 0",
                      }}
                    />
                  </Box>
                </Stack>
                <Stack direction="row" justifyContent="flex-end" sx={{ px: 1, py: 0.25 }}>
                  <IconButton size="small" onClick={() => setEditingCaptionPhoto(photo)} aria-label={t("workLog.dayEntries.editCaption")}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => setDeletingPhoto(photo)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
            </SwipeToDelete>
          ))}
        </Stack>
        </PullToRefresh>
      )}

      <Fab
        color="primary"
        onClick={() => setAddOpen(true)}
        disabled={allDayPhotos.length >= MAX_WORK_LOG_PHOTOS_PER_DAY}
        sx={{ position: "fixed", bottom: 84, left: 20, zIndex: 5 }}
        aria-label={t("workLog.dayEntries.addAria")}
      >
        <AddIcon />
      </Fab>

      <WorkLogEntryDialog
        open={addOpen}
        loading={uploadMutation.isPending}
        existingCount={allDayPhotos.length}
        onClose={() => setAddOpen(false)}
        onSubmit={(input) => uploadMutation.mutate(input)}
      />

      <PhotoLightbox
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        onDelete={(p) => setDeletingPhoto(p)}
      />

      <ConfirmDialog
        open={!!deletingPhoto}
        title={t("workLog.dayEntries.deleteTitle")}
        description={t("workLog.dayEntries.deleteConfirm")}
        confirmLabel={t("common.delete")}
        loading={deleteMutation.isPending}
        onConfirm={() => deletingPhoto && deleteMutation.mutate(deletingPhoto.id)}
        onCancel={() => setDeletingPhoto(null)}
      />

      <EditTextDialog
        open={!!editingCaptionPhoto}
        title={t("workLog.dayEntries.editCaption")}
        label={t("workLog.dayEntries.captionLabel")}
        initialValue={editingCaptionPhoto?.caption ?? ""}
        saving={updateCaptionMutation.isPending}
        onClose={() => setEditingCaptionPhoto(null)}
        onSave={(value) => {
          if (!editingCaptionPhoto) return;
          updateCaptionMutation.mutate({ id: editingCaptionPhoto.id, caption: value });
        }}
      />

      <EditTextDialog
        open={editingDescription}
        title={t("workLog.dayEntries.editDescription")}
        label={t("workLog.dayEntries.descriptionLabel")}
        initialValue={workLogNote?.description ?? ""}
        saving={updateDescriptionMutation.isPending}
        suggestion={previousDescription}
        suggestionLabel={t("workLog.dayEntries.suggestionLabel")}
        onClose={() => setEditingDescription(false)}
        onSave={(value) => updateDescriptionMutation.mutate(value)}
      />

      {/* رندر مخفی برای خروجی تصویر «گزارش کار» — دیگر همهٔ عکس‌های روز به‌طور
          خودکار نیست؛ دقیقاً همان زیرمجموعه، همان ترتیب و همان توضیحاتی است
          که کاربر در دیالوگ «انتخاب تصاویر گزارش» تعیین کرده. نکتهٔ مهم:
          هرگز از opacity:0 برای مخفی‌کردن استفاده نمی‌شود، چون html2canvas
          افت شفافیت را در تصویر خروجی هم اعمال می‌کند و نتیجه یک عکس کاملاً
          خالی/بی‌رنگ خواهد بود؛ به‌جای آن فقط با مختصات منفی از صفحه بیرون
          برده می‌شود. */}
      <Box sx={{ position: "fixed", top: 0, insetInlineStart: -9999, zIndex: -1 }} aria-hidden>
        <Box ref={reportCardRef} sx={{ display: "inline-block" }}>
          <PictureCardFrame
            title={null}
            subtitle={appSettings?.projectName}
            dateLabel={toJalaliWithWeekday(date)}
            location={appSettings?.projectLocation}
            description={workLogNote?.description}
            photos={reportSelection
              .map((sel) => {
                const photo = allDayPhotos.find((p) => p.id === sel.photoId);
                if (!photo) return null;
                return {
                  id: photo.id,
                  url: getPhotoUrl(photo.filename),
                  caption: sel.caption || null,
                  focalX: sel.focalX,
                  focalY: sel.focalY,
                  zoom: sel.zoom,
                };
              })
              .filter((p): p is NonNullable<typeof p> => !!p)}
            width={EXPORT_WIDTH}
          />
        </Box>
      </Box>

      <WorkReportBuilderDialog
        open={reportBuilderOpen}
        date={date}
        dayPhotos={allDayPhotos}
        initialSelection={reportSelection.length > 0 ? reportSelection : undefined}
        saving={isSharing}
        onClose={() => setReportBuilderOpen(false)}
        onConfirm={handleReportBuilderConfirm}
      />
    </Box>
  );
}
