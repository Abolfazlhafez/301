import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import RestoreIcon from "@mui/icons-material/Restore";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Capacitor } from "@capacitor/core";
import { settingsApi } from "../../shared/api/settingsApi";
import { extractErrorMessage } from "../../shared/api/client";
import { useToast } from "../../shared/components/ToastProvider";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import {
  backupService,
  EXTERNAL_BACKUP_RETENTION_DAYS,
  type AutoBackupInfo,
} from "../../core/services/backupService";
import { formatNumber } from "../../shared/utils/format";

const INTERVAL_OPTIONS = [
  { labelKey: "settings.autoBackup.interval6h", hours: 6 },
  { labelKey: "settings.autoBackup.interval12h", hours: 12 },
  { labelKey: "settings.autoBackup.interval24h", hours: 24 },
  { labelKey: "settings.autoBackup.interval3d", hours: 72 },
  { labelKey: "settings.autoBackup.intervalWeekly", hours: 168 },
] as const;

const VERSION_OPTIONS = [3, 5, 7, 10, 15];

// شناسه بستهٔ اندروید اپ (از capacitor.config.ts) — برای نمایش دقیق مسیر
// پوشهٔ بکاپ قابل‌مشاهده به کاربر، بدون نیاز به import مستقیم فایل کانفیگ.
const APP_PACKAGE_ID = "ir.karegahyar.app";

/** تاریخ/ساعت را با locale زبان فعلی برنامه فرمت می‌کند (نه همیشه fa-IR). */
function formatDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale || "fa", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * آیا از آخرین بکاپ خودکار موفق، بیش از حد معمول گذشته (۲ برابر فاصلهٔ
 * تنظیم‌شده)؟ این یعنی چند بار متوالی اجرای بکاپ یا رد شده یا شکست خورده،
 * بدون این‌که لزوماً خطای صریحی هم ثبت شده باشد (مثلاً چون مدتی برنامه اصلاً
 * باز نشده). صرفاً یک هشدار محافظه‌کارانه است، نه تشخیص قطعی خرابی.
 */
function isAutoBackupOverdue(settings: {
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  lastAutoBackupAt?: string;
}): boolean {
  if (!settings.autoBackupEnabled) return false;
  if (!settings.lastAutoBackupAt) return false;
  const intervalMs = settings.autoBackupIntervalHours * 60 * 60 * 1000;
  const last = new Date(settings.lastAutoBackupAt).getTime();
  if (isNaN(last)) return false;
  return Date.now() - last > intervalMs * 2;
}

function formatSize(bytes: number | undefined, t: TFunction, lang: string): string {
  if (!bytes) return "";
  if (bytes < 1024) return t("settings.autoBackup.sizeBytes", { value: formatNumber(bytes, lang) });
  const kb = bytes / 1024;
  if (kb < 1024) return t("settings.autoBackup.sizeKb", { value: kb.toFixed(1) });
  return t("settings.autoBackup.sizeMb", { value: (kb / 1024).toFixed(1) });
}

export function AutoBackupCard() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const fmtDate = (iso: string) => formatDateTime(iso, lang);
  const isNative = Capacitor.isNativePlatform();

  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const { data: autoBackups = [], isLoading: isLoadingList } = useQuery({
    queryKey: ["auto-backups"],
    queryFn: () => backupService.listAutoBackups(),
    enabled: isNative,
  });

  const [restoreTarget, setRestoreTarget] = useState<AutoBackupInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutoBackupInfo | null>(null);
  const [isRunningNow, setIsRunningNow] = useState(false);

  const updateAutoBackupMutation = useMutation({
    mutationFn: (input: {
      autoBackupEnabled: boolean;
      autoBackupIntervalHours: number;
      autoBackupMaxVersions: number;
    }) => settingsApi.updateAutoBackupSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      showToast(t("settings.autoBackup.toastSettingsSaved"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const restoreMutation = useMutation({
    mutationFn: (fileName: string) => backupService.restoreFromAutoBackup(fileName),
    onSuccess: () => {
      showToast(t("settings.autoBackup.toastRestored"), "success");
      setTimeout(() => window.location.reload(), 1200);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
    onSettled: () => setRestoreTarget(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileName: string) => backupService.deleteAutoBackup(fileName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-backups"] });
      showToast(t("settings.autoBackup.toastDeleted"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
    onSettled: () => setDeleteTarget(null),
  });

  if (!isNative) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <HistoryIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              {t("settings.autoBackup.title")}
            </Typography>
          </Stack>
          <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
            {t("settings.autoBackup.webOnly")}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  async function handleRunNow() {
    try {
      setIsRunningNow(true);
      await backupService.createAutoBackup();
      queryClient.invalidateQueries({ queryKey: ["auto-backups"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      showToast(t("settings.autoBackup.toastCreated"), "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    } finally {
      setIsRunningNow(false);
    }
  }

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <HistoryIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              {t("settings.autoBackup.title")}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t("settings.autoBackup.description")}
          </Typography>

          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={700} gutterBottom>
              {t("settings.autoBackup.whereTitle")}
            </Typography>
            <Typography variant="body2" component="div">
              <Trans i18nKey="settings.autoBackup.whereIntro" components={{ strong: <strong /> }} />
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, mt: 0.5 }}>
              <li>
                <Typography variant="body2">
                  <Trans i18nKey="settings.autoBackup.internalCopy" components={{ strong: <strong /> }} />
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <Trans i18nKey="settings.autoBackup.visibleCopyBefore" components={{ strong: <strong /> }} />{" "}
                  <Typography component="code" variant="body2" sx={{ fontFamily: "monospace", direction: "ltr", unicodeBidi: "isolate" }}>
                    Android/data/{APP_PACKAGE_ID}/files/KaregahYar/backups
                  </Typography>{" "}
                  {t("settings.autoBackup.visibleCopyAfter", {
                    days: formatNumber(EXTERNAL_BACKUP_RETENTION_DAYS, lang),
                  })}
                </Typography>
              </li>
            </Box>
          </Alert>

          {isLoadingSettings ? (
            <CircularProgress size={20} />
          ) : (
            settings && (
              <Stack spacing={2}>
                {settings.lastAutoBackupErrorMessage && (
                  <Alert severity="error" variant="outlined">
                    <Typography variant="body2" fontWeight={700} gutterBottom>
                      {t("settings.autoBackup.lastFailed")}
                      {settings.lastAutoBackupErrorAt && ` (${fmtDate(settings.lastAutoBackupErrorAt)})`}
                    </Typography>
                    <Typography variant="body2">{settings.lastAutoBackupErrorMessage}</Typography>
                  </Alert>
                )}

                {!settings.lastAutoBackupErrorMessage && isAutoBackupOverdue(settings) && (
                  <Alert severity="warning" variant="outlined">
                    {t("settings.autoBackup.overdue")}
                  </Alert>
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoBackupEnabled}
                      onChange={(e) =>
                        updateAutoBackupMutation.mutate({
                          autoBackupEnabled: e.target.checked,
                          autoBackupIntervalHours: settings.autoBackupIntervalHours,
                          autoBackupMaxVersions: settings.autoBackupMaxVersions,
                        })
                      }
                    />
                  }
                  label={t("settings.autoBackup.enableLabel")}
                />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    select
                    label={t("settings.autoBackup.intervalLabel")}
                    value={settings.autoBackupIntervalHours}
                    disabled={!settings.autoBackupEnabled}
                    onChange={(e) =>
                      updateAutoBackupMutation.mutate({
                        autoBackupEnabled: settings.autoBackupEnabled,
                        autoBackupIntervalHours: Number(e.target.value),
                        autoBackupMaxVersions: settings.autoBackupMaxVersions,
                      })
                    }
                    fullWidth
                  >
                    {INTERVAL_OPTIONS.map((opt) => (
                      <MenuItem key={opt.hours} value={opt.hours}>
                        {t(opt.labelKey)}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    label={t("settings.autoBackup.maxVersionsLabel")}
                    value={settings.autoBackupMaxVersions}
                    disabled={!settings.autoBackupEnabled}
                    onChange={(e) =>
                      updateAutoBackupMutation.mutate({
                        autoBackupEnabled: settings.autoBackupEnabled,
                        autoBackupIntervalHours: settings.autoBackupIntervalHours,
                        autoBackupMaxVersions: Number(e.target.value),
                      })
                    }
                    fullWidth
                  >
                    {VERSION_OPTIONS.map((v) => (
                      <MenuItem key={v} value={v}>
                        {t("settings.autoBackup.versionsOption", { n: formatNumber(v, lang) })}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                {settings.lastAutoBackupAt && (
                  <Typography variant="caption" color="text.secondary">
                    {t("settings.autoBackup.lastBackupAt", { date: fmtDate(settings.lastAutoBackupAt) })}
                  </Typography>
                )}

                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleRunNow}
                  disabled={isRunningNow}
                  startIcon={isRunningNow ? <CircularProgress size={16} /> : undefined}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {t("settings.autoBackup.runNow")}
                </Button>
              </Stack>
            )
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={700} mb={1}>
            {t("settings.autoBackup.savedListTitle")}
          </Typography>

          {isLoadingList && <CircularProgress size={18} />}

          {!isLoadingList && autoBackups.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {t("settings.autoBackup.emptyList")}
            </Typography>
          )}

          {!isLoadingList && autoBackups.length > 0 && (
            <List dense disablePadding>
              {autoBackups.map((b, idx) => (
                <ListItem
                  key={b.fileName}
                  divider={idx < autoBackups.length - 1}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        edge="end"
                        size="small"
                        color="primary"
                        onClick={() => setRestoreTarget(b)}
                        aria-label={t("settings.autoBackup.restore")}
                      >
                        <RestoreIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        edge="end"
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(b)}
                        aria-label={t("common.delete")}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{fmtDate(b.createdAt)}</Typography>
                        {idx === 0 && <Chip label={t("settings.autoBackup.newest")} size="small" color="primary" />}
                      </Stack>
                    }
                    secondary={formatSize(b.sizeBytes, t, lang) || undefined}
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Box mt={2}>
            <Alert severity="info" variant="outlined">
              {t("settings.autoBackup.footerNote")}
            </Alert>
          </Box>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!restoreTarget}
        title={t("settings.autoBackup.restoreDialogTitle")}
        description={
          restoreTarget
            ? t("settings.autoBackup.restoreDialogDescription", { date: fmtDate(restoreTarget.createdAt) })
            : ""
        }
        confirmLabel={t("settings.autoBackup.restore")}
        confirmColor="warning"
        loading={restoreMutation.isPending}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.fileName)}
        onCancel={() => setRestoreTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("settings.autoBackup.deleteDialogTitle")}
        description={
          deleteTarget
            ? t("settings.autoBackup.deleteDialogDescription", { date: fmtDate(deleteTarget.createdAt) })
            : ""
        }
        confirmLabel={t("common.delete")}
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.fileName)}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
