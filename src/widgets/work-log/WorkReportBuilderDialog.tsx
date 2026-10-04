import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import CropIcon from "@mui/icons-material/Crop";
import { getPhotoUrl } from "../../shared/api/photosApi";
import { PhotoThumbImg } from "../../shared/components/PhotoThumbImg";
import { Photo } from "../../entities/Photo";
import { PhotoCropAdjustDialog, PhotoCropAdjustValue } from "../../features/picture-cards/PhotoCropAdjustDialog";
import { EmptyState } from "../../shared/components/EmptyState";
import { AnimatedList } from "../../shared/components/AnimatedList";

export interface ReportPhotoSelection {
  photoId: string;
  caption: string;
  /** درصد افقی کانون کادر عکس در پیکچر کارت (۰ تا ۱۰۰)؛ نبود آن یعنی وسط. */
  focalX?: number | null;
  /** درصد عمودی کانون کادر عکس در پیکچر کارت (۰ تا ۱۰۰)؛ نبود آن یعنی وسط. */
  focalY?: number | null;
  /** ضریب زوم عکس داخل خانهٔ خودش در پیکچر کارت؛ نبود آن یعنی بدون زوم. */
  zoom?: number | null;
}

interface WorkReportBuilderDialogProps {
  open: boolean;
  date: string;
  dayPhotos: Photo[];
  /** انتخاب اولیه عکس‌ها (اگر کاربر قبلاً یک بار گزارش ساخته و دوباره برگشته). */
  initialSelection?: ReportPhotoSelection[];
  saving?: boolean;
  onClose: () => void;
  onConfirm: (selection: ReportPhotoSelection[]) => void;
}

/**
 * دیالوگ «ساخت گزارش کار»: کاربر از بین همهٔ عکس‌های ثبت‌شدهٔ همان روز،
 * فقط عکس‌های موردنظرش را برای گزارش نهایی انتخاب می‌کند (نه لزوماً همهٔ
 * عکس‌های روز)، ترتیب نمایش را با دکمه‌های بالا/پایین تنظیم می‌کند، و برای
 * هر عکس یک توضیح مستقل (که همان چیزی است که در گزارش نهایی زیر همان عکس
 * نمایش داده می‌شود) می‌نویسد.
 *
 * چرا دکمهٔ بالا/پایین به‌جای Drag & Drop؟ روی موبایل، درگ کردن آیتم‌های
 * یک لیست قابل‌اسکرول معمولاً با خودِ اسکرول تداخل پیدا می‌کند و بدون یک
 * کتابخانهٔ اختصاصی (که هنوز به این پروژه اضافه نشده) پیاده‌سازی درست‌ودرمانش
 * پیچیده و شکننده است؛ دکمه‌های صریح بالا/پایین از نظر تعامل، از قوانین
 * لمسی به‌مراتب قابل‌اعتمادتر و در دسترس‌تر هستند.
 */
export function WorkReportBuilderDialog({
  open,
  dayPhotos,
  initialSelection,
  saving,
  onClose,
  onConfirm,
}: WorkReportBuilderDialogProps) {
  // ترتیب انتخاب = همان ترتیب نمایش در گزارش نهایی. آرایه‌ای از photoId است،
  // نه Set، چون Set ترتیب را تضمین نمی‌کند.
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [cropValues, setCropValues] = useState<Record<string, PhotoCropAdjustValue>>({});
  const [cropDialogPhotoId, setCropDialogPhotoId] = useState<string | null>(null);

  // ترتیب نمایش گرید عکس‌ها: پیش‌فرض همان ترتیب دریافتی، یا بر اساس زمان
  // ثبت (جدید→قدیم / قدیم→جدید).
  const [photoSort, setPhotoSort] = useState<"default" | "newest" | "oldest">("default");

  useEffect(() => {
    if (!open) return;
    const existingPhotoIds = new Set(dayPhotos.map((p) => p.id));
    if (initialSelection && initialSelection.length > 0) {
      // فیلتر کردن نسبت به عکس‌های واقعاً موجود — اگر عکسی که قبلاً در یک
      // گزارش انتخاب شده بود، از آن زمان تا حالا حذف شده باشد (مثلاً از
      // طریق حذف گروهی در گالری)، شناسهٔ آن نباید در انتخاب باقی بماند؛
      // وگرنه شمارش «X عکس انتخاب‌شده» با تعداد واقعی تیک‌خورده در گرید
      // ناهماهنگ می‌شود.
      const validSelection = initialSelection.filter((s) => existingPhotoIds.has(s.photoId));
      setOrderedIds(validSelection.map((s) => s.photoId));
      setCaptions(Object.fromEntries(validSelection.map((s) => [s.photoId, s.caption])));
    } else {
      // پیش‌فرض: هیچ عکسی از پیش انتخاب نشده — کاربر خودش تعیین می‌کند، نه
      // این‌که همهٔ عکس‌های روز به‌طور خودکار در گزارش قرار بگیرند.
      setOrderedIds([]);
      setCaptions(
        Object.fromEntries(dayPhotos.map((p) => [p.id, p.caption ?? ""]))
      );
    }
    setCropValues(
      Object.fromEntries(
        (initialSelection ?? [])
          .filter((s) => s.focalX != null || s.focalY != null || s.zoom != null)
          .map((s) => [s.photoId, { focalX: s.focalX ?? 50, focalY: s.focalY ?? 50, zoom: s.zoom ?? 1 }])
      )
    );
    setPhotoSort("default");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSelection]);

  const photosById = new Map(dayPhotos.map((p) => [p.id, p]));
  const allSelected = dayPhotos.length > 0 && orderedIds.length === dayPhotos.length;

  // ترتیب نمایش گرید عکس‌ها بر اساس photoSort — فقط روی نمایش تأثیر دارد،
  // نه روی ترتیب انتخاب نهایی (که همان orderedIds و ترتیب کلیک کاربر است).
  const displayedPhotos = useMemo(() => {
    if (photoSort === "default") return dayPhotos;
    const sorted = [...dayPhotos].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return photoSort === "newest" ? sorted.reverse() : sorted;
  }, [dayPhotos, photoSort]);

  function toggleSelected(photoId: string) {
    setOrderedIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  }

  function selectAll() {
    setOrderedIds(dayPhotos.map((p) => p.id));
  }

  function clearAll() {
    setOrderedIds([]);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setOrderedIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setOrderedIds((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(
      orderedIds.map((id) => {
        const crop = cropValues[id];
        return {
          photoId: id,
          caption: (captions[id] ?? "").trim(),
          focalX: crop?.focalX,
          focalY: crop?.focalY,
          zoom: crop?.zoom,
        };
      })
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700}>
            محتوای گزارش
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {orderedIds.length === 0 ? "هنوز عکسی برای گزارش انتخاب نشده" : `${orderedIds.length} عکس انتخاب شده`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="بستن">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 2 }}>
        {dayPhotos.length === 0 ? (
          <EmptyState
            icon={<PhotoLibraryIcon fontSize="inherit" />}
            title="عکسی برای این روز ثبت نشده"
            description="ابتدا از دکمهٔ + عکس اضافه کنید، سپس گزارش بسازید."
          />
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
              <Typography variant="body2" color="text.secondary">
                {orderedIds.length === 0
                  ? `از بین ${dayPhotos.length} عکس این روز، عکس‌های موردنظر برای گزارش را انتخاب کنید.`
                  : `${orderedIds.length} از ${dayPhotos.length} عکس برای گزارش انتخاب شده.`}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton
                  size="small"
                  onClick={() =>
                    setPhotoSort((prev) => (prev === "newest" ? "oldest" : prev === "oldest" ? "default" : "newest"))
                  }
                  aria-label="ترتیب نمایش عکس‌ها بر اساس زمان ثبت"
                  title={
                    photoSort === "default"
                      ? "ترتیب: پیش‌فرض"
                      : photoSort === "newest"
                      ? "ترتیب: جدید به قدیم"
                      : "ترتیب: قدیم به جدید"
                  }
                >
                  <SwapVertIcon fontSize="small" color={photoSort === "default" ? "action" : "primary"} />
                </IconButton>
                <Button
                  size="small"
                  onClick={allSelected ? clearAll : selectAll}
                  startIcon={allSelected ? <CheckBoxIcon fontSize="small" /> : <CheckBoxOutlineBlankIcon fontSize="small" />}
                >
                  {allSelected ? "لغو انتخاب همه" : "انتخاب همه"}
                </Button>
              </Stack>
            </Stack>

            {/* گرید انتخاب — همهٔ عکس‌های روز، با چک‌باکس روی هرکدام. */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
                gap: 1,
              }}
            >
              {displayedPhotos.map((photo) => {
                const selected = orderedIds.includes(photo.id);
                return (
                  <Box
                    key={photo.id}
                    onClick={() => toggleSelected(photo.id)}
                    sx={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      borderRadius: 1.5,
                      overflow: "hidden",
                      cursor: "pointer",
                      outline: selected ? "3px solid" : "1px solid",
                      outlineColor: selected ? "primary.main" : "divider",
                      transition: "outline-color 120ms ease-out, transform 120ms ease-out",
                      "&:active": { transform: "scale(0.96)" },
                    }}
                  >
                    <PhotoThumbImg
                      photo={photo}
                      alt={photo.caption ?? ""}
                      sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <Checkbox
                      checked={selected}
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 2,
                        insetInlineStart: 2,
                        p: 0.25,
                        bgcolor: "rgba(0,0,0,0.55)",
                        borderRadius: "50%",
                        "& .MuiSvgIcon-root": { color: "#fff", fontSize: 18 },
                        "&.Mui-checked .MuiSvgIcon-root": { color: "primary.main" },
                      }}
                    />
                    {selected && (
                      <Box
                        sx={{
                          position: "absolute",
                          bottom: 2,
                          insetInlineEnd: 2,
                          bgcolor: "primary.main",
                          color: "primary.contrastText",
                          borderRadius: 999,
                          minWidth: 18,
                          height: 18,
                          fontSize: 11,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          px: 0.5,
                        }}
                      >
                        {orderedIds.indexOf(photo.id) + 1}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>

            {orderedIds.length > 0 && (
              <>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>
                  ترتیب و توضیحات ({orderedIds.length} عکس انتخاب‌شده)
                </Typography>
                <AnimatedList spacing={1.25}>
                  {orderedIds.map((id, index) => {
                    const photo = photosById.get(id);
                    if (!photo) return null;
                    return (
                      <Stack
                        key={id}
                        direction="row"
                        spacing={1}
                        sx={{
                          p: 1,
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: "background.paper",
                        }}
                      >
                        <PhotoThumbImg
                          photo={photo}
                          alt=""
                          sx={{ width: 56, height: 56, borderRadius: 1, objectFit: "cover", flexShrink: 0 }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary">
                            عکس {index + 1}
                          </Typography>
                          <TextField
                            placeholder="توضیح این عکس در گزارش (اختیاری)..."
                            value={captions[id] ?? ""}
                            onChange={(e) => setCaptions((prev) => ({ ...prev, [id]: e.target.value }))}
                            size="small"
                            fullWidth
                            multiline
                            maxRows={3}
                            variant="standard"
                          />
                        </Box>
                        <Stack spacing={0.25} justifyContent="center">
                          <IconButton
                            size="small"
                            onClick={() => moveUp(index)}
                            disabled={index === 0}
                            aria-label="جابه‌جایی به بالا"
                          >
                            <KeyboardArrowUpIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => moveDown(index)}
                            disabled={index === orderedIds.length - 1}
                            aria-label="جابه‌جایی به پایین"
                          >
                            <KeyboardArrowDownIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => setCropDialogPhotoId(id)}
                            aria-label="تنظیم کادر عکس"
                            title="تنظیم کادر عکس در پیکچر کارت"
                          >
                            <CropIcon fontSize="small" color={cropValues[id] ? "primary" : "action"} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    );
                  })}
                </AnimatedList>
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          انصراف
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={saving || orderedIds.length === 0}
        >
          {saving ? "در حال ساخت..." : "ساخت گزارش"}
        </Button>
      </DialogActions>

      <PhotoCropAdjustDialog
        open={!!cropDialogPhotoId}
        photoUrl={cropDialogPhotoId ? getPhotoUrl(photosById.get(cropDialogPhotoId)?.filename ?? "") : null}
        initialValue={cropDialogPhotoId ? cropValues[cropDialogPhotoId] ?? null : null}
        onClose={() => setCropDialogPhotoId(null)}
        onSave={(value) => {
          if (!cropDialogPhotoId) return;
          setCropValues((prev) => ({ ...prev, [cropDialogPhotoId]: value }));
          setCropDialogPhotoId(null);
        }}
      />
    </Dialog>
  );
}
