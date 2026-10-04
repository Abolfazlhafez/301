import { ChangeEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ImageList,
  ImageListItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import { usePhotoPicker } from "../../shared/hooks/usePhotoPicker";

export const MAX_WORK_LOG_PHOTOS_PER_DAY = 20;

export interface WorkLogEntrySubmission {
  files: File[];
  caption: string | null;
}

interface WorkLogEntryDialogProps {
  open: boolean;
  loading?: boolean;
  existingCount: number;
  onClose: () => void;
  onSubmit: (input: WorkLogEntrySubmission) => void;
}

interface PickedFile {
  file: File;
  previewUrl: string;
}

/**
 * دیالوگ افزودن گزارش کار روزانه: یک یا چند عکس از کار انجام‌شده + یک
 * توضیح متنی مشترک برای همان دسته عکس‌ها.
 */
export function WorkLogEntryDialog({
  open,
  loading,
  existingCount,
  onClose,
  onSubmit,
}: WorkLogEntryDialogProps) {
  const { t } = useTranslation();
  const { pickPhoto, pickMultiplePhotos, fileInputProps, multiFileInputProps } = usePhotoPicker();
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");

  const remainingSlots = Math.max(0, MAX_WORK_LOG_PHOTOS_PER_DAY - existingCount);

  useEffect(() => {
    if (open) {
      setPicked([]);
      setCaption("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    return () => {
      picked.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(newFiles: File[]) {
    if (newFiles.length === 0) return;

    setPicked((prev) => {
      const availableSlots = remainingSlots - prev.length;
      const accepted = newFiles.slice(0, Math.max(0, availableSlots));

      if (newFiles.length > accepted.length) {
        setError(t("workLog.entryDialog.maxPhotosError", { max: MAX_WORK_LOG_PHOTOS_PER_DAY }) as string);
      } else {
        setError("");
      }

      const additions = accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
      return [...prev, ...additions];
    });
  }

  function handleWebFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    addFiles(selected);
  }

  async function handlePickCamera() {
    const file = await pickPhoto({ forceCameraOnly: true });
    if (file) addFiles([file]);
  }

  async function handlePickGallery() {
    const files = await pickMultiplePhotos();
    addFiles(files);
  }

  function handleRemove(index: number) {
    setPicked((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
    setError("");
  }

  function handleSubmit() {
    if (picked.length === 0) {
      setError(t("workLog.entryDialog.noPhotoError") as string);
      return;
    }
    onSubmit({ files: picked.map((p) => p.file), caption: caption.trim() || null });
  }

  const limitReached = picked.length >= remainingSlots;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {t("workLog.entryDialog.title")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <input {...fileInputProps} accept="image/*,.heic,.heif" capture="environment" onChange={handleWebFileChange} />
          <input {...multiFileInputProps} accept="image/*,.heic,.heif" onChange={handleWebFileChange} />

          <Typography variant="caption" color="text.secondary">
            {t("workLog.entryDialog.countHint", {
              existing: existingCount,
              max: MAX_WORK_LOG_PHOTOS_PER_DAY,
              remaining: remainingSlots,
            })}
          </Typography>

          {picked.length > 0 && (
            <ImageList cols={4} gap={8} sx={{ m: 0 }}>
              {picked.map((p, index) => (
                <ImageListItem key={p.previewUrl} sx={{ position: "relative", borderRadius: 1, overflow: "hidden" }}>
                  <Box
                    component="img"
                    src={p.previewUrl}
                    alt={t("workLog.entryDialog.photoAlt", { index: index + 1 }) as string}
                    sx={{ width: "100%", height: 80, objectFit: "cover" }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(index)}
                    sx={{
                      position: "absolute",
                      top: 2,
                      left: 2,
                      bgcolor: "rgba(0,0,0,0.55)",
                      color: "common.white",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </ImageListItem>
              ))}
            </ImageList>
          )}

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<PhotoCameraIcon />}
              onClick={handlePickCamera}
              disabled={limitReached}
              sx={{ flex: 1, height: 60, borderStyle: "dashed" }}
            >
              {t("workLog.entryDialog.takePhoto")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<PhotoLibraryIcon />}
              onClick={handlePickGallery}
              disabled={limitReached}
              sx={{ flex: 1, height: 60, borderStyle: "dashed" }}
            >
              {t("workLog.entryDialog.pickFromGallery")}
            </Button>
          </Stack>

          <TextField
            label={t("workLog.entryDialog.captionLabel")}
            placeholder={t("workLog.entryDialog.captionPlaceholder") as string}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            multiline
            minRows={3}
            helperText={t("workLog.entryDialog.captionHelper")}
          />

          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("workLog.entryDialog.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || picked.length === 0}>
          {loading
            ? t("workLog.entryDialog.submitting")
            : picked.length > 1
              ? t("workLog.entryDialog.submitMultiple", { count: picked.length })
              : t("workLog.entryDialog.submitSingle")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
