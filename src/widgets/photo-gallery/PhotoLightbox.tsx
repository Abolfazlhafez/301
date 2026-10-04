import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, WheelEvent } from "react";
import { Box, Dialog, IconButton, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import IosShareIcon from "@mui/icons-material/IosShare";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { Photo } from "../../entities/Photo";
import { photosApi, getPhotoThumbUrl } from "../../shared/api/photosApi";
import { SafePhotoImage } from "../../shared/components/SafePhotoImage";
import { shareExistingBlob } from "../../shared/utils/exportCard";
import { toJalaliDisplay } from "../../shared/utils/jalaliDate";

interface PhotoLightboxProps {
  photo: Photo | null;
  onClose: () => void;
  onDelete: (photo: Photo) => void;
  onRetried?: (photo: Photo) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const WHEEL_STEP = 0.25;
const BUTTON_STEP = 0.5;

/**
 * محدودهٔ انتقال مجاز طبق مقیاس فعلی — با بزرگ‌نمایی بیشتر، عکس می‌تواند
 * بیشتر جابه‌جا شود اما هرگز کاملاً از دید خارج نمی‌شود.
 */
function clampTranslate(value: number, scale: number, containerSize: number): number {
  const maxOffset = (containerSize * (scale - 1)) / 2;
  if (maxOffset <= 0) return 0;
  return Math.max(-maxOffset, Math.min(maxOffset, value));
}

/**
 * لایت‌باکس نمایش عکس با بزرگ‌نمایی/جابه‌جایی (Pinch-to-zoom روی موبایل،
 * چرخ موس/دابل-کلیک روی دسکتاپ) — برای بازبینی دقیق جزئیات عکس/نقشهٔ
 * بارگذاری‌شده (مثلاً خواندن اعداد روی نقشه یا عیب جزئی در عکس). این همان
 * کامپوننت مشترکی است که هم گالری عکس عمومی و هم بخش نقشه‌های «دفترچهٔ
 * دیجیتال طبقه» از آن استفاده می‌کنند.
 */
export function PhotoLightbox({ photo, onClose, onDelete, onRetried }: PhotoLightboxProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  // تا وقتی عکس اصلی (کیفیت کامل) کاملاً بارگذاری نشده، پیش‌نمایش کم‌حجم (محو) زیرش دیده می‌شود.
  const [fullLoaded, setFullLoaded] = useState(false);

  // با تغییر عکس یا بسته‌شدن، بزرگ‌نمایی/جابه‌جایی همیشه صفر می‌شود — تا
  // عکس بعدی همیشه با نمای کامل و بدون زوم باقیمانده از عکس قبلی باز شود.
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setFullLoaded(false);
    pointers.current.clear();
    pinchStartDistance.current = null;
    panStart.current = null;
  }, [photo?.id]);

  if (!photo) return null;
  const previewUrl = getPhotoThumbUrl(photo.filename);

  async function handleShare() {
    if (!photo || isSharing) return;
    setIsSharing(true);
    try {
      const blob = await photosApi.getBlob(photo.id);
      if (blob) {
        await shareExistingBlob(blob, photo.filename, t("photoGallery.lightbox.shareTitle") as string);
      }
    } finally {
      setIsSharing(false);
    }
  }

  function applyScale(nextScaleRaw: number, anchor?: { x: number; y: number }) {
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScaleRaw));
    setScale((prevScale) => {
      if (nextScale === prevScale) return prevScale;
      const rect = containerRef.current?.getBoundingClientRect();
      if (anchor && rect) {
        // هنگام زوم، جابه‌جایی را طوری تنظیم می‌کنیم که نقطهٔ زیر انگشت/نشانگر
        // موس ثابت بماند (تجربهٔ زوم طبیعی، نه پرش ناگهانی تصویر).
        const cx = anchor.x - rect.left - rect.width / 2;
        const cy = anchor.y - rect.top - rect.height / 2;
        const ratio = nextScale / prevScale;
        setTranslate((prev) => ({
          x: clampTranslate(cx + (prev.x - cx) * ratio, nextScale, rect.width),
          y: clampTranslate(cy + (prev.y - cy) * ratio, nextScale, rect.height),
        }));
      } else if (nextScale === MIN_SCALE) {
        setTranslate({ x: 0, y: 0 });
      }
      return nextScale;
    });
  }

  function resetZoom() {
    setScale(MIN_SCALE);
    setTranslate({ x: 0, y: 0 });
  }

  function handleDoubleClick(e: MouseEvent<HTMLDivElement>) {
    if (scale > MIN_SCALE) {
      resetZoom();
    } else {
      applyScale(DOUBLE_TAP_SCALE, { x: e.clientX, y: e.clientY });
    }
  }

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
    applyScale(scale + delta, { x: e.clientX, y: e.clientY });
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.values());
      pinchStartDistance.current = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      pinchStartScale.current = scale;
      panStart.current = null;
    } else if (pointers.current.size === 1 && scale > MIN_SCALE) {
      panStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
      setIsPanning(true);
    }
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStartDistance.current) {
      const [p1, p2] = Array.from(pointers.current.values());
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const nextScale = pinchStartScale.current * (distance / pinchStartDistance.current);
      applyScale(nextScale, { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
      return;
    }

    if (panStart.current && scale > MIN_SCALE) {
      const rect = containerRef.current?.getBoundingClientRect();
      const width = rect?.width ?? 0;
      const height = rect?.height ?? 0;
      setTranslate({
        x: clampTranslate(panStart.current.tx + (e.clientX - panStart.current.x), scale, width),
        y: clampTranslate(panStart.current.ty + (e.clientY - panStart.current.y), scale, height),
      });
    }
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStartDistance.current = null;
    if (pointers.current.size === 0) {
      panStart.current = null;
      setIsPanning(false);
    }
  }

  return (
    <Dialog open={!!photo} onClose={onClose} fullWidth maxWidth="sm">
      <Box
        ref={containerRef}
        sx={{
          position: "relative",
          bgcolor: "black",
          overflow: "hidden",
          touchAction: scale > MIN_SCALE ? "none" : "pan-y",
          cursor: scale > MIN_SCALE ? (isPanning ? "grabbing" : "grab") : "zoom-in",
        }}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <Box
          sx={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: isPanning ? "none" : "transform 0.15s ease-out",
            willChange: "transform",
          }}
        >
          <Box sx={{ position: "relative" }}>
            {previewUrl && !fullLoaded && (
              <Box
                component="img"
                src={previewUrl}
                alt=""
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "blur(6px)",
                  pointerEvents: "none",
                }}
              />
            )}
            <SafePhotoImage
              photo={photo}
              quality="full"
              onFullLoaded={() => setFullLoaded(true)}
              onRetried={onRetried}
              sx={{ width: "100%", minHeight: 220, maxHeight: "70vh" }}
              imgSx={{
                width: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                display: "block",
                pointerEvents: "none",
              }}
            />
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", top: 8, left: 8, bgcolor: "rgba(0,0,0,0.5)", color: "white" }}
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <Stack direction="row" spacing={0.5} sx={{ position: "absolute", bottom: 8, insetInlineEnd: 8 }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              applyScale(scale - BUTTON_STEP);
            }}
            disabled={scale <= MIN_SCALE}
            sx={{ bgcolor: "rgba(0,0,0,0.5)", color: "white" }}
            size="small"
          >
            <ZoomOutIcon fontSize="small" />
          </IconButton>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              applyScale(scale + BUTTON_STEP);
            }}
            disabled={scale >= MAX_SCALE}
            sx={{ bgcolor: "rgba(0,0,0,0.5)", color: "white" }}
            size="small"
          >
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {toJalaliDisplay(photo.date)}
          </Typography>
          {photo.caption && (
            <Typography variant="caption" color="text.secondary">
              {photo.caption}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.5}>
          <IconButton onClick={handleShare} disabled={isSharing}>
            <IosShareIcon />
          </IconButton>
          <IconButton color="error" onClick={() => onDelete(photo)}>
            <DeleteIcon />
          </IconButton>
        </Stack>
      </Stack>
    </Dialog>
  );
}
