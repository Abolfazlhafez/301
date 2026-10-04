import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Collapse, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import RefreshIcon from "@mui/icons-material/Refresh";
import RestoreIcon from "@mui/icons-material/Restore";
import { backupService, type AutoBackupInfo } from "../../core/services/backupService";
import { isRecoverableByBackup, restoreAfterMigrationFailure } from "../../core/storage/migrationRecovery";

interface StartupErrorScreenProps {
  error: unknown;
}

function formatBackupDate(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang || "fa", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * جایگزین صفحهٔ سفید وقتی دیتابیس باز نمی‌شود (مثلاً شکست مهاجرت از IndexedDB قدیمی).
 * دادهٔ قدیمی دست‌نخورده می‌ماند؛ کاربر می‌تواند دوباره تلاش کند یا از بکاپ خودکار بازیابی کند.
 * بازیابی فقط برای شکست مهاجرت پیشنهاد می‌شود، چون فقط در آن حالت دیتابیس نیتیو قطعاً خالی است.
 */
export function StartupErrorScreen({ error }: StartupErrorScreenProps) {
  const { t, i18n } = useTranslation();
  const canRestore = isRecoverableByBackup(error);
  const [backups, setBackups] = useState<AutoBackupInfo[] | null>(canRestore ? null : []);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!canRestore) return;
    let cancelled = false;
    backupService
      .listAutoBackups()
      .then((list) => !cancelled && setBackups(list))
      .catch(() => !cancelled && setBackups([]));
    return () => {
      cancelled = true;
    };
  }, [canRestore]);

  async function restore(fileName: string) {
    setRestoring(true);
    setRestoreError(null);
    try {
      await restoreAfterMigrationFailure(fileName);
      window.location.reload();
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : String(e));
      setRestoring(false);
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  const [latest, ...others] = backups ?? [];

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
      <Stack spacing={2} sx={{ width: "100%", maxWidth: 480 }}>
        <Typography variant="h5" fontWeight={800}>
          {t("startupError.title")}
        </Typography>
        <Alert severity="warning">{canRestore ? t("startupError.migrationBody") : t("startupError.genericBody")}</Alert>

        {restoreError && (
          <Alert severity="error">
            {t("startupError.restoreFailed")}: {restoreError}
          </Alert>
        )}

        {canRestore && backups === null && <CircularProgress size={24} />}
        {canRestore && backups !== null && backups.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("startupError.noBackups")}
          </Typography>
        )}

        {latest && (
          <Stack spacing={1}>
            <Button
              variant="contained"
              size="large"
              disabled={restoring}
              startIcon={restoring ? <CircularProgress size={18} color="inherit" /> : <RestoreIcon />}
              onClick={() => void restore(latest.fileName)}
            >
              {restoring ? t("startupError.restoring") : t("startupError.restoreLatest")}
            </Button>
            <Typography variant="caption" color="text.secondary">
              {t("startupError.backupFrom", { date: formatBackupDate(latest.createdAt, i18n.language) })} ·{" "}
              {t("startupError.restoreNote")}
            </Typography>
          </Stack>
        )}

        {others.length > 0 && (
          <Box>
            <Button size="small" onClick={() => setShowAll((v) => !v)}>
              {t("startupError.restoreOther")} ({others.length})
            </Button>
            <Collapse in={showAll}>
              <Stack spacing={0.5} mt={0.5}>
                {others.map((b) => (
                  <Button key={b.fileName} variant="outlined" size="small" disabled={restoring} onClick={() => void restore(b.fileName)}>
                    {t("startupError.backupFrom", { date: formatBackupDate(b.createdAt, i18n.language) })}
                  </Button>
                ))}
              </Stack>
            </Collapse>
          </Box>
        )}

        <Button variant="outlined" disabled={restoring} startIcon={<RefreshIcon />} onClick={() => window.location.reload()}>
          {t("common.retry")}
        </Button>

        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {t("startupError.details")}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="pre" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", m: 0 }}>
            {message}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
