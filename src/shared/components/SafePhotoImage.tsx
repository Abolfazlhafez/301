import { useState } from "react";
import { Box, CircularProgress, IconButton, Stack, SxProps, Theme, Tooltip, Typography } from "@mui/material";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import type { Photo } from "../../entities/Photo";
import { photosApi, getPhotoUrl } from "../api/photosApi";
import { useLazyPhotoSrc } from "../hooks/useLazyPhotoSrc";

interface SafePhotoImageProps {
  photo: Photo;
  alt?: string;
  sx?: SxProps<Theme>;
  imgSx?: SxProps<Theme>;
  onClick?: () => void;
  /** بعد از تلاش مجدد موفق برای تبدیل HEIC، برای رفرش کردن لیست فراخوانی می‌شود. */
  onRetried?: (photo: Photo) => void;
  showRetryButton?: boolean;
  /**
   * "thumb" (پیش‌فرض): پیش‌نمایش کم‌حجم + بارگذاری تنبل + آزادسازی خارج از دید — برای لیست/گرید.
   * "full": عکس اصلی؛ فقط برای نمای بزرگ (لایت‌باکس) که کاربر صراحتاً عکس را باز کرده است.
   */
  quality?: "thumb" | "full";
  /** وقتی عکس اصلی کاملاً بارگذاری شد (فقط در حالت full). */
  onFullLoaded?: () => void;
}

/**
 * نمایش امن یک عکس. هرگز باعث کرش برنامه نمی‌شود:
 * - اگر تبدیل HEIC ناموفق بوده، به‌جای <img> شکسته یک کاشی جایگزین با دکمهٔ
 *   «تلاش مجدد» نشان می‌دهد.
 * - اگر خودِ بارگذاری تصویر هم (به هر دلیل دیگری) شکست بخورد، onError آن را
 *   می‌گیرد و همان کاشی جایگزین را نشان می‌دهد؛ فایل اصلی کاربر در هر دو حالت
 *   دست‌نخورده در پایگاه‌داده باقی می‌ماند.
 */
export function SafePhotoImage({
  photo,
  alt,
  sx,
  imgSx,
  onClick,
  onRetried,
  showRetryButton = true,
  quality = "thumb",
  onFullLoaded,
}: SafePhotoImageProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const lazy = useLazyPhotoSrc(photo);
  const isThumb = quality === "thumb";

  const shouldShowFallback = photo.displayConversionFailed || loadFailed;

  async function handleRetry(e: React.MouseEvent) {
    e.stopPropagation();
    setIsRetrying(true);
    try {
      const updated = await photosApi.retryDisplayConversion(photo.id);
      setLoadFailed(false);
      onRetried?.(updated);
    } catch {
      // بی‌صدا نادیده گرفته می‌شود؛ کاربر می‌تواند دوباره تلاش کند.
    } finally {
      setIsRetrying(false);
    }
  }

  if (shouldShowFallback) {
    return (
      <Box
        onClick={onClick}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          bgcolor: "action.hover",
          borderRadius: 1.5,
          p: 1,
          cursor: onClick ? "pointer" : "default",
          ...sx,
        }}
      >
        {isRetrying ? (
          <CircularProgress size={22} />
        ) : (
          <BrokenImageOutlinedIcon color="disabled" fontSize="medium" />
        )}
        <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ fontSize: "0.65rem" }}>
          پیش‌نمایش HEIC در دسترس نیست
        </Typography>
        {showRetryButton && !isRetrying && (
          <Tooltip title="تلاش مجدد برای ساخت پیش‌نمایش">
            <IconButton size="small" onClick={handleRetry}>
              <ReplayIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }

  return (
    <Stack sx={sx}>
      <Box
        component="img"
        ref={isThumb ? lazy.ref : undefined}
        src={isThumb ? lazy.src : getPhotoUrl(photo.filename)}
        alt={alt || photo.caption || "عکس"}
        decoding="async"
        onClick={onClick}
        onLoad={isThumb ? undefined : onFullLoaded}
        onError={() => {
          // خطای بارگذاری تصویر شفاف جایگزین نباید «عکس خراب» حساب شود.
          if (!isThumb || !lazy.isPlaceholder) setLoadFailed(true);
        }}
        sx={{
          cursor: onClick ? "pointer" : "default",
          ...(isThumb && lazy.isPlaceholder ? { bgcolor: "action.hover", minHeight: lazy.minHeight } : null),
          ...imgSx,
        }}
      />
    </Stack>
  );
}
