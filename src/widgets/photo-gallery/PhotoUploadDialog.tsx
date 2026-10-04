import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import { detectImageKind, convertHeicToJpeg } from "../../shared/utils/imageFormat";
import { usePhotoPicker } from "../../shared/hooks/usePhotoPicker";

interface PendingPhotoItem {
  key: string;
  file: File;
  previewUrl: string | null;
  isPreparing: boolean;
  previewUnavailable: boolean;
}

interface PhotoUploadDialogProps {
  open: boolean;
  loading?: boolean;
  /** پیشرفت آپلود فعلی (برای چند عکس هم‌زمان)، مثلاً "۲ از ۵". */
  progressLabel?: string;
  onClose: () => void;
  onSubmit: (input: { files: File[]; date: string; caption: string | null }) => void;
}

let keyCounter = 0;

/**
 * دیالوگ افزودن عکس، با پشتیبانی از انتخاب هم‌زمان چند عکس از گالری یا فایل‌های
 * دستگاه. هر عکس به‌صورت جداگانه پیش‌نمایش می‌شود (شامل تبدیل HEIC در صورت نیاز)
 * و قابل حذف از فهرست پیش از آپلود نهایی است.
 */
export function PhotoUploadDialog({ open, loading, progressLabel, onClose, onSubmit }: PhotoUploadDialogProps) {
  const { t } = useTranslation();
  const { pickMultiplePhotos, multiFileInputProps } = usePhotoPicker();
  const [items, setItems] = useState<PendingPhotoItem[]>([]);
  const itemsRef = useRef<PendingPhotoItem[]>([]);
  itemsRef.current = items;
  const [date, setDate] = useState(getTodayIso());
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      // پیش‌نمایش‌های باقی‌مانده از باز شدن قبلی دیالوگ را آزاد می‌کنیم.
      itemsRef.current.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
      setItems([]);
      setDate(getTodayIso());
      setCaption("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
    };
  }, []);

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setError("");

    const newItems: PendingPhotoItem[] = files.map((file) => ({
      key: `p${Date.now()}-${keyCounter++}`,
      file,
      previewUrl: null,
      isPreparing: true,
      previewUnavailable: false,
    }));
    setItems((prev) => [...prev, ...newItems]);

    // پیش‌نمایش هر فایل مستقل از بقیه ساخته می‌شود تا یک فایل خراب یا کند،
    // مانع نمایش بقیه نشود.
    for (const item of newItems) {
      (async () => {
        try {
          const kind = await detectImageKind(item.file);
          if (kind === "unknown") {
            setItems((prev) =>
              prev.map((it) => (it.key === item.key ? { ...it, isPreparing: false, previewUnavailable: true } : it))
            );
            return;
          }
          if (kind !== "heic") {
            const url = URL.createObjectURL(item.file);
            setItems((prev) =>
              prev.map((it) => (it.key === item.key ? { ...it, isPreparing: false, previewUrl: url } : it))
            );
            return;
          }
          const conversion = await convertHeicToJpeg(item.file);
          setItems((prev) =>
            prev.map((it) =>
              it.key === item.key
                ? conversion.ok
                  ? { ...it, isPreparing: false, previewUrl: URL.createObjectURL(conversion.blob) }
                  : { ...it, isPreparing: false, previewUnavailable: true }
                : it
            )
          );
        } catch {
          setItems((prev) =>
            prev.map((it) => (it.key === item.key ? { ...it, isPreparing: false, previewUnavailable: true } : it))
          );
        }
      })();
    }
  }

  function handleWebFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // اجازه انتخاب مجدد همان فایل‌ها در آینده
    addFiles(files);
  }

  async function handlePickPhotos() {
    const files = await pickMultiplePhotos();
    addFiles(files);
  }

  function removeItem(key: string) {
    setItems((prev) => {
      const target = prev.find((it) => it.key === key);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.key !== key);
    });
  }

  function handleSubmit() {
    if (items.length === 0) {
      setError(t("photoGallery.uploadDialog.noPhotoError") as string);
      return;
    }
    onSubmit({ files: items.map((it) => it.file), date, caption: caption.trim() || null });
  }

  const isBusy = loading || items.some((it) => it.isPreparing);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {t("photoGallery.uploadDialog.title")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <input {...multiFileInputProps} accept="image/*,.heic,.heif" onChange={handleWebFilesChange} />

          {items.length === 0 ? (
            <Button
              variant="outlined"
              startIcon={<PhotoCameraIcon />}
              onClick={handlePickPhotos}
              sx={{ height: 100, borderStyle: "dashed" }}
            >
              {t("photoGallery.uploadDialog.pickPhotos")}
            </Button>
          ) : (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="caption" color="text.secondary">
                  {t("photoGallery.uploadDialog.selectedCount", { count: items.length })}
                </Typography>
                <Button size="small" onClick={handlePickPhotos}>
                  {t("photoGallery.uploadDialog.addMore")}
                </Button>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 1,
                  maxHeight: 260,
                  overflowY: "auto",
                }}
              >
                {items.map((item) => (
                  <Box key={item.key} sx={{ position: "relative", borderRadius: 1.5, overflow: "hidden" }}>
                    {item.isPreparing ? (
                      <Box
                        sx={{
                          width: "100%",
                          aspectRatio: "1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "action.hover",
                        }}
                      >
                        <CircularProgress size={18} />
                      </Box>
                    ) : item.previewUrl ? (
                      <Box
                        component="img"
                        src={item.previewUrl}
                        alt={item.file.name}
                        sx={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: "100%",
                          aspectRatio: "1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "action.hover",
                        }}
                      >
                        <BrokenImageOutlinedIcon color="disabled" fontSize="small" />
                      </Box>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => removeItem(item.key)}
                      sx={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        bgcolor: "rgba(0,0,0,0.55)",
                        color: "#fff",
                        p: 0.3,
                        "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <JalaliDatePicker label={t("photoGallery.uploadDialog.dateLabel") as string} value={date} onChange={setDate} size="small" />

          <TextField
            label={t("photoGallery.uploadDialog.captionLabel")}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            multiline
            minRows={2}
          />

          {error && (
            <Alert severity="error" variant="outlined" sx={{ py: 0 }}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("photoGallery.uploadDialog.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isBusy}>
          {loading
            ? progressLabel || t("photoGallery.uploadDialog.uploading")
            : items.length > 1
              ? t("photoGallery.uploadDialog.addMultiple", { count: items.length })
              : t("photoGallery.uploadDialog.addSingle")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
