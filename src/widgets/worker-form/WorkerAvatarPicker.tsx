import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Box, CircularProgress, IconButton, Typography } from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CloseIcon from "@mui/icons-material/Close";
import { detectImageKind, convertHeicToJpeg } from "../../shared/utils/imageFormat";
import { usePhotoPicker } from "../../shared/hooks/usePhotoPicker";
import { WorkerAvatar } from "./WorkerAvatar";

export type AvatarPickerAction = { type: "set"; file: File } | { type: "remove" } | { type: "none" };

interface WorkerAvatarPickerProps {
  resetKey: string;
  persistedAvatarPhotoId: string | null;
  initials: string;
  onChange: (action: AvatarPickerAction) => void;
}

const SIZE = 88;

/**
 * انتخاب/تغییر/حذف عکس پروفایل نیرو، با پیش‌نمایش فوری (شامل تبدیل امن HEIC).
 * این کامپوننت فقط فایل انتخاب‌شده را از طریق onChange به بیرون گزارش می‌دهد؛
 * آپلود واقعی و ذخیره‌سازی پس از ثبت فرم توسط صفحه فراخواننده انجام می‌شود.
 */
export function WorkerAvatarPicker({
  resetKey,
  persistedAvatarPhotoId,
  initials,
  onChange,
}: WorkerAvatarPickerProps) {
  const { t } = useTranslation();
  const { pickPhoto, fileInputProps } = usePhotoPicker();
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [isMarkedRemoved, setIsMarkedRemoved] = useState(false);

  useEffect(() => {
    setPendingPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIsPreparingPreview(false);
    setPreviewUnavailable(false);
    setIsMarkedRemoved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  async function handlePickAvatar() {
    const file = await pickPhoto();
    if (!file) return;

    setIsMarkedRemoved(false);
    setPreviewUnavailable(false);
    setIsPreparingPreview(true);

    try {
      const kind = await detectImageKind(file);
      if (kind === "unknown") {
        setIsPreparingPreview(false);
        setPreviewUnavailable(true);
        return;
      }
      if (kind !== "heic") {
        setPendingPreviewUrl(URL.createObjectURL(file));
        setIsPreparingPreview(false);
        onChange({ type: "set", file });
        return;
      }
      const conversion = await convertHeicToJpeg(file);
      setIsPreparingPreview(false);
      if (conversion.ok) {
        setPendingPreviewUrl(URL.createObjectURL(conversion.blob));
      } else {
        setPreviewUnavailable(true);
      }
      onChange({ type: "set", file });
    } catch {
      setIsPreparingPreview(false);
      setPreviewUnavailable(true);
      onChange({ type: "set", file });
    }
  }

  function handleRemove() {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(null);
      setPreviewUnavailable(false);
      onChange({ type: "none" });
      return;
    }
    if (previewUnavailable) {
      setPreviewUnavailable(false);
      onChange({ type: "none" });
      return;
    }
    if (persistedAvatarPhotoId && !isMarkedRemoved) {
      setIsMarkedRemoved(true);
      onChange({ type: "remove" });
    }
  }

  const hasRemovableContent =
    !!pendingPreviewUrl || previewUnavailable || (!!persistedAvatarPhotoId && !isMarkedRemoved);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
      <input {...fileInputProps} accept="image/*,.heic,.heif" />

      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        badgeContent={
          <IconButton
            size="small"
            onClick={handlePickAvatar}
            sx={{ bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" }, width: 28, height: 28 }}
          >
            <CameraAltIcon sx={{ fontSize: 15 }} />
          </IconButton>
        }
      >
        <Box sx={{ position: "relative", width: SIZE, height: SIZE }}>
          {isPreparingPreview ? (
            <Box
              sx={{
                width: SIZE,
                height: SIZE,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "action.hover",
              }}
            >
              <CircularProgress size={26} />
            </Box>
          ) : pendingPreviewUrl ? (
            <Box
              component="img"
              src={pendingPreviewUrl}
              alt={t("workers.avatarPicker.previewAlt")}
              sx={{ width: SIZE, height: SIZE, borderRadius: "50%", objectFit: "cover", display: "block" }}
            />
          ) : previewUnavailable ? (
            <Box
              sx={{
                width: SIZE,
                height: SIZE,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "action.hover",
              }}
            >
              <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ px: 1, fontSize: "0.6rem" }}>
                {t("workers.avatarPicker.previewInvalid")}
              </Typography>
            </Box>
          ) : (
            <WorkerAvatar
              avatarPhotoId={isMarkedRemoved ? null : persistedAvatarPhotoId}
              initials={initials}
              size={SIZE}
            />
          )}

          {hasRemovableContent && (
            <IconButton
              size="small"
              onClick={handleRemove}
              sx={{
                position: "absolute",
                top: -4,
                right: -4,
                bgcolor: "error.main",
                color: "#fff",
                width: 22,
                height: 22,
                "&:hover": { bgcolor: "error.dark" },
              }}
            >
              <CloseIcon sx={{ fontSize: 13 }} />
            </IconButton>
          )}
        </Box>
      </Badge>

      <Typography variant="caption" color="text.secondary">
        {t("workers.avatarPicker.profilePhoto")}
      </Typography>
    </Box>
  );
}
