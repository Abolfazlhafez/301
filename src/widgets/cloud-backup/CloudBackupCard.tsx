import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Link,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import { settingsApi } from "../../shared/api/settingsApi";
import { cloudBackupApi } from "../../shared/api/cloudBackupApi";
import { extractErrorMessage } from "../../shared/api/client";
import { useToast } from "../../shared/components/ToastProvider";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useLanguage } from "../../shared/hooks/useLanguage";

/**
 * تاریخ/ساعت را با locale واقعیِ زبان فعلی برنامه فرمت می‌کند — قبلاً این
 * تابع همیشه locale را هاردکد "fa-IR" می‌گذاشت، یعنی حتی وقتی کاربر زبان
 * را به انگلیسی/عربی/... عوض می‌کرد، «آخرین بکاپ ابری موفق» باز هم به فرمت
 * فارسی نمایش داده می‌شد.
 */
function formatDateTimeForLocale(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * کارت تنظیمات «بکاپ ابری» — یک لایهٔ کاملاً اختیاری و افزوده روی بکاپ
 * محلی موجود. برنامه بدون این کارت هم کاملاً آفلاین و کارکردی می‌ماند؛
 * این فقط برای کاربرانی است که می‌خواهند علاوه بر بکاپ محلی، یک نسخهٔ
 * رمزنگاری‌شده هم روی حساب شخصی Supabase خودشان (رایگان) نگه دارند —
 * مثلاً برای بازیابی سریع روی گوشی جدید بدون نیاز به انتقال دستی فایل.
 */
export function CloudBackupCard() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const INTERVAL_OPTIONS = [
    { label: t("cloudBackup.interval12h"), hours: 12 },
    { label: t("cloudBackup.interval24h"), hours: 24 },
    { label: t("cloudBackup.interval3d"), hours: 72 },
    { label: t("cloudBackup.intervalWeekly"), hours: 168 },
  ];

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const [enabled, setEnabled] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [intervalHours, setIntervalHours] = useState(24);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.cloudBackupEnabled);
      setSupabaseUrl(settings.cloudBackupSupabaseUrl);
      setAnonKey(settings.cloudBackupSupabaseAnonKey);
      setIntervalHours(settings.cloudBackupIntervalHours);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateCloudBackupSettings({
        cloudBackupEnabled: enabled,
        cloudBackupSupabaseUrl: supabaseUrl,
        cloudBackupSupabaseAnonKey: anonKey,
        cloudBackupIntervalHours: intervalHours,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      showToast(t("cloudBackup.toastSettingsSaved") as string, "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const testMutation = useMutation({
    mutationFn: () => cloudBackupApi.testConnection(supabaseUrl.trim(), anonKey.trim()),
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ ok: false, message: extractErrorMessage(err) }),
  });

  const restoreMutation = useMutation({
    mutationFn: () => {
      if (!settings) throw new Error(t("cloudBackup.settingsNotLoadedError") as string);
      return cloudBackupApi.restoreFromCloud(supabaseUrl.trim(), anonKey.trim(), settings.cloudBackupDeviceId);
    },
    onSuccess: () => {
      showToast(t("cloudBackup.toastRestoreSuccess") as string, "success");
      setTimeout(() => window.location.reload(), 1200);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  if (isLoading || !settings) return null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <CloudSyncIcon fontSize="small" color="action" />
          <Typography variant="subtitle1" fontWeight={700}>
            {t("cloudBackup.title")}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {t("cloudBackup.descriptionBeforeLink")}{" "}
          <Link href="https://supabase.com" target="_blank" rel="noopener">
            Supabase
          </Link>{" "}
          {t("cloudBackup.descriptionAfterLink")}
        </Typography>

        <FormControlLabel
          control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
          label={t("cloudBackup.enableLabel") as string}
        />

        {enabled && (
          <Stack spacing={2} mt={1.5}>
            <TextField
              label={t("cloudBackup.urlLabel")}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => {
                setSupabaseUrl(e.target.value);
                setTestResult(null);
              }}
              size="small"
              fullWidth
              dir="ltr"
            />
            <TextField
              label={t("cloudBackup.keyLabel")}
              value={anonKey}
              onChange={(e) => {
                setAnonKey(e.target.value);
                setTestResult(null);
              }}
              size="small"
              fullWidth
              dir="ltr"
              type="password"
            />
            <TextField
              select
              label={t("cloudBackup.intervalLabel")}
              value={intervalHours}
              onChange={(e) => setIntervalHours(Number(e.target.value))}
              size="small"
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <MenuItem key={opt.hours} value={opt.hours}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            {testResult && (
              <Alert severity={testResult.ok ? "success" : "error"} onClose={() => setTestResult(null)}>
                {testResult.message}
              </Alert>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="outlined"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !supabaseUrl.trim() || !anonKey.trim()}
                startIcon={testMutation.isPending ? <CircularProgress size={16} /> : undefined}
              >
                {t("cloudBackup.testConnection")}
              </Button>
              <Button
                variant="outlined"
                color="warning"
                onClick={() => setRestoreConfirmOpen(true)}
                disabled={restoreMutation.isPending || !supabaseUrl.trim() || !anonKey.trim()}
              >
                {t("cloudBackup.restoreAction")}
              </Button>
            </Stack>

            {settings.lastCloudBackupErrorMessage && (
              <Alert severity="error" variant="outlined">
                <Typography variant="body2" fontWeight={700} gutterBottom>
                  {t("cloudBackup.lastFailed")}
                  {settings.lastCloudBackupErrorAt &&
                    ` (${formatDateTimeForLocale(settings.lastCloudBackupErrorAt, language)})`}
                </Typography>
                <Typography variant="body2">{settings.lastCloudBackupErrorMessage}</Typography>
              </Alert>
            )}

            {settings.lastCloudBackupAt && (
              <Typography variant="caption" color="text.secondary">
                {t("cloudBackup.lastBackupLabel")}: {formatDateTimeForLocale(settings.lastCloudBackupAt, language)}
              </Typography>
            )}

            <Divider />

            <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
                {t("cloudBackup.sqlGuideTitle")}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                {t("cloudBackup.sqlGuideDescription")}
              </Typography>
              <Box
                component="pre"
                dir="ltr"
                sx={{
                  fontSize: 11,
                  bgcolor: "background.paper",
                  p: 1,
                  borderRadius: 1,
                  mt: 0.5,
                  overflowX: "auto",
                  fontFamily: "monospace",
                }}
              >
                {`create table if not exists karegah_yar_backup_chunks (
  device_id text not null,
  upload_id text not null,
  chunk_index integer not null,
  payload text not null,
  checksum text not null,
  chars integer not null,
  created_at timestamptz not null,
  primary key (device_id, upload_id, chunk_index)
);

create table if not exists karegah_yar_backup_heads (
  device_id text primary key,
  upload_id text not null,
  chunk_count integer not null,
  total_chars bigint not null,
  manifest_checksum text not null,
  updated_at timestamptz not null
);

alter table karegah_yar_backup_chunks enable row level security;
alter table karegah_yar_backup_heads enable row level security;

drop policy if exists "allow anon read/write chunks"
  on karegah_yar_backup_chunks;
create policy "allow anon read/write chunks"
  on karegah_yar_backup_chunks
  for all using (true) with check (true);

drop policy if exists "allow anon read/write heads"
  on karegah_yar_backup_heads;
create policy "allow anon read/write heads"
  on karegah_yar_backup_heads
  for all using (true) with check (true);`}
              </Box>
            </Box>
          </Stack>
        )}

        <Stack direction="row" justifyContent="flex-end" mt={2}>
          <Button
            variant="contained"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t("cloudBackup.saveSettings")}
          </Button>
        </Stack>
      </CardContent>

      <ConfirmDialog
        open={restoreConfirmOpen}
        title={t("cloudBackup.restoreConfirmTitle") as string}
        description={t("cloudBackup.restoreConfirmDescription") as string}
        confirmLabel={t("cloudBackup.restoreAction") as string}
        confirmColor="warning"
        loading={restoreMutation.isPending}
        onCancel={() => setRestoreConfirmOpen(false)}
        onConfirm={() => {
          setRestoreConfirmOpen(false);
          restoreMutation.mutate();
        }}
      />
    </Card>
  );
}
