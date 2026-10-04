import { useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Slider, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

export interface PhotoCropAdjustValue {
  focalX: number;
  focalY: number;
  zoom: number;
}

const DEFAULT_VALUE: PhotoCropAdjustValue = { focalX: 50, focalY: 50, zoom: 1 };

interface PhotoCropAdjustDialogProps {
  open: boolean;
  photoUrl: string | null;
  initialValue?: PhotoCropAdjustValue | null;
  onClose: () => void;
  onSave: (value: PhotoCropAdjustValue) => void;
}

/**
 * دیالوگ «تنظیم کادر عکس»: کاربر روی خودِ عکس لمس/کلیک می‌کند تا کانون کادر
 * (همان نقطه‌ای که هنگام object-fit:cover همیشه داخل قاب می‌ماند) را جابه‌جا
 * کند، و با اسلایدر می‌تواند زوم کند. چون خروجی نهایی با html2canvas گرفته
 * می‌شود، از object-position + transform:scale استفاده شده (نه یک کتابخانهٔ
 * کراپ کامل) تا هم روی موبایل سبک باشد و هم در خروجی تصویر درست رندر شود.
 */
export function PhotoCropAdjustDialog({ open, photoUrl, initialValue, onClose, onSave }: PhotoCropAdjustDialogProps) {
  const [value, setValue] = useState<PhotoCropAdjustValue>(initialValue ?? DEFAULT_VALUE);

  // مقداردهی اولیه هر بار که دیالوگ برای عکس جدیدی باز می‌شود (transition
  // onEnter، نه useEffect، چون این دیالوگ بین چند عکس مختلف mount شده باقی
  // می‌ماند و فقط props.photoUrl/initialValue عوض می‌شود).
  function handleEnter() {
    setValue(initialValue ?? DEFAULT_VALUE);
  }

  function applyPointFromEvent(clientX: number, clientY: number, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    setValue((prev) => ({ ...prev, focalX: Math.round(x), focalY: Math.round(y) }));
  }

  function handleClick(e: ReactMouseEvent<HTMLDivElement>) {
    applyPointFromEvent(e.clientX, e.clientY, e.currentTarget);
  }

  function handleTouch(e: ReactTouchEvent<HTMLDivElement>) {
    const touch = e.touches[0] ?? e.changedTouches[0];
    if (!touch) return;
    applyPointFromEvent(touch.clientX, touch.clientY, e.currentTarget);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      TransitionProps={{ onEnter: handleEnter }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          تنظیم کادر عکس
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="بستن">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          روی عکس لمس کنید تا کانون کادر جابه‌جا شود؛ با اسلایدر زوم کنید.
        </Typography>
        <Box
          onClick={handleClick}
          onTouchStart={handleTouch}
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 2,
            overflow: "hidden",
            cursor: "crosshair",
            bgcolor: "rgba(0,0,0,0.06)",
            touchAction: "none",
          }}
        >
          {photoUrl && (
            <Box
              component="img"
              src={photoUrl}
              alt=""
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `${value.focalX}% ${value.focalY}%`,
                transform: value.zoom !== 1 ? `scale(${value.zoom})` : undefined,
                transformOrigin: `${value.focalX}% ${value.focalY}%`,
                display: "block",
                pointerEvents: "none",
              }}
            />
          )}
          <Box
            sx={{
              position: "absolute",
              top: `${value.focalY}%`,
              insetInlineStart: `${value.focalX}%`,
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: "2px solid #fff",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
          <ZoomOutIcon fontSize="small" color="action" />
          <Slider
            value={value.zoom}
            min={1}
            max={2.5}
            step={0.05}
            onChange={(_, v) => setValue((prev) => ({ ...prev, zoom: v as number }))}
            size="small"
          />
          <ZoomInIcon fontSize="small" color="action" />
        </Stack>

        <Button
          size="small"
          startIcon={<RestartAltIcon fontSize="small" />}
          onClick={() => setValue(DEFAULT_VALUE)}
          sx={{ mt: 0.5 }}
        >
          بازنشانی
        </Button>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          انصراف
        </Button>
        <Button onClick={() => onSave(value)} variant="contained">
          ذخیره
        </Button>
      </DialogActions>
    </Dialog>
  );
}
