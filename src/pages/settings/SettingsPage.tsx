import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import LanguageIcon from "@mui/icons-material/Language";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Capacitor } from "@capacitor/core";
import { settingsApi } from "../../shared/api/settingsApi";
import { extractErrorMessage } from "../../shared/api/client";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { useToast } from "../../shared/components/ToastProvider";
import { formatCurrency, formatNumber, toPlainDigitsOnly } from "../../shared/utils/format";
import { backupService } from "../../core/services/backupService";
import { AutoBackupCard } from "../../widgets/auto-backup/AutoBackupCard";
import { CloudBackupCard } from "../../widgets/cloud-backup/CloudBackupCard";
import { NotificationSettingsCard } from "../../widgets/notification-settings/NotificationSettingsCard";
import { ProjectsSettingsCard } from "../../widgets/layout/ProjectsSettingsCard";
import { useThemeMode, ThemeModePreference } from "../../shared/hooks/useThemeMode";
import { useLanguage } from "../../shared/hooks/useLanguage";
import { LANGUAGE_LIST } from "../../shared/i18n/languages";
import { BackupPasswordRequiredError } from "../../core/services/backupStream";
import { CURRENCIES } from "../../shared/i18n/languages";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { preference, setPreference } = useThemeMode();
  const { language, setLanguage, currency, setCurrency } = useLanguage();

  const THEME_OPTIONS: { value: ThemeModePreference; label: string; icon: ReactNode }[] = [
    { value: "light", label: t("theme.light"), icon: <LightModeIcon fontSize="small" /> },
    { value: "dark", label: t("theme.dark"), icon: <DarkModeIcon fontSize="small" /> },
    { value: "system", label: t("theme.system"), icon: <BrightnessAutoIcon fontSize="small" /> },
  ];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const [hours, setHours] = useState("8");
  const [sampleSalary, setSampleSalary] = useState("1000000");
  const [quickCheckInTime, setQuickCheckInTime] = useState("08:00");
  const [customQuickCheckInTime, setCustomQuickCheckInTime] = useState("");
  const [quickCheckOutTime, setQuickCheckOutTime] = useState("17:00");
  const [customQuickCheckOutTime, setCustomQuickCheckOutTime] = useState("");

  // مقادیر فرم برای بازهٔ پیش‌فرض «صبحانه سریع»/«ناهار سریع». رشتهٔ خالی
  // یعنی «تنظیم‌نشده» (null در سرور) — یعنی دکمهٔ سریع سراغ سابقهٔ خودِ
  // نیرو می‌رود.
  const [breakfastStart, setBreakfastStart] = useState("");
  const [breakfastEnd, setBreakfastEnd] = useState("");
  const [lunchStart, setLunchStart] = useState("");
  const [lunchEnd, setLunchEnd] = useState("");

  useEffect(() => {
    if (data) {
      setHours(String(data.standardWorkHoursPerDay));
      setQuickCheckInTime(data.quickCheckInDefaultTime);
      setQuickCheckOutTime(data.quickCheckOutDefaultTime);
      setBreakfastStart(data.quickBreakfastDefaultStartTime ?? "");
      setBreakfastEnd(data.quickBreakfastDefaultEndTime ?? "");
      setLunchStart(data.quickLunchDefaultStartTime ?? "");
      setLunchEnd(data.quickLunchDefaultEndTime ?? "");
    }
  }, [data]);

  const QUICK_CHECKIN_PRESETS = ["07:30", "08:00", "08:15", "08:30"];
  const QUICK_CHECKOUT_PRESETS = ["16:00", "16:30", "17:00", "17:30"];

  const updateQuickCheckInMutation = useMutation({
    mutationFn: (time: string) =>
      settingsApi.updateQuickCheckInSettings({
        quickCheckInDefaultTime: time,
        quickCheckOutDefaultTime: quickCheckOutTime,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setQuickCheckInTime(updated.quickCheckInDefaultTime);
      showToast(t("settings.page.toastCheckInUpdated"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateQuickCheckOutMutation = useMutation({
    mutationFn: (time: string) =>
      settingsApi.updateQuickCheckInSettings({
        quickCheckInDefaultTime: quickCheckInTime,
        quickCheckOutDefaultTime: time,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setQuickCheckOutTime(updated.quickCheckOutDefaultTime);
      showToast(t("settings.page.toastCheckOutUpdated"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateQuickBreakMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateQuickBreakSettings({
        quickBreakfastDefaultStartTime: breakfastStart || null,
        quickBreakfastDefaultEndTime: breakfastEnd || null,
        quickLunchDefaultStartTime: lunchStart || null,
        quickLunchDefaultEndTime: lunchEnd || null,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setBreakfastStart(updated.quickBreakfastDefaultStartTime ?? "");
      setBreakfastEnd(updated.quickBreakfastDefaultEndTime ?? "");
      setLunchStart(updated.quickLunchDefaultStartTime ?? "");
      setLunchEnd(updated.quickLunchDefaultEndTime ?? "");
      showToast(t("settings.page.toastBreakUpdated"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: (h: number) => settingsApi.update({ standardWorkHoursPerDay: h }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["daily-report"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-report"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      showToast(t("settings.page.toastSaved"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  function handleSave() {
    const h = Number(hours);
    if (!h || h <= 0 || h > 24) {
      showToast(t("settings.page.toastHoursRange"), "error");
      return;
    }
    updateMutation.mutate(h);
  }

  const hourlyRatePreview =
    Number(hours) > 0 ? Math.round(Number(sampleSalary) / Number(hours)) : 0;

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  // فایلی که کاربر انتخاب کرده ولی معلوم شد رمزدار است — منتظر وارد کردن
  // رمز عبور می‌ماند تا با آن دوباره تلاش شود.
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  // خطای مربوط به تلاش رمز عبور (مثلاً رمز اشتباه) همین‌جا و کنار کادر رمز
  // نشان داده می‌شود — نه فقط به‌صورت یک toast گذرا — چون toast ممکن است
  // قبل از این‌که کاربر کامل بخواندش بسته شود و او را سردرگم نگه دارد که
  // آیا اصلاً دوباره تلاش کند یا باید از اول فایل را انتخاب کند.
  const [importPasswordError, setImportPasswordError] = useState<string | null>(null);

  async function handleExport() {
    try {
      setIsExporting(true);
      await backupService.exportAndShare(exportPassword.trim() || undefined);
      showToast(
        Capacitor.isNativePlatform() ? t("settings.page.toastExportReady") : t("settings.page.toastExportDownloaded"),
        "success"
      );
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setIsExporting(false);
    }
  }

  function handleImportClick() {
    importInputRef.current?.click();
  }

  async function runImport(file: File, password?: string) {
    try {
      setIsImporting(true);
      setImportPasswordError(null);
      await backupService.importAll(file, password);
      setPendingImportFile(null);
      setImportPassword("");
      setImportPasswordError(null);
      showToast(t("settings.page.toastRestored"), "success");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      const message = extractErrorMessage(err);
      // اگر خطا دقیقاً به‌خاطر نبودِ رمز عبور بود، به‌جای پیام خطای ساده،
      // از کاربر بخواه رمز را وارد کند (به‌جای این‌که مجبور شود دوباره از
      // اول فایل را انتخاب کند).
      // تشخیص با خطای نوع‌دار است، نه تطبیق متن پیام فارسی سرویس.
      if (err instanceof BackupPasswordRequiredError) {
        setPendingImportFile(file);
      } else if (pendingImportFile || password !== undefined) {
        // این تلاش، تلاش برای واردکردن رمز عبور بود (نه انتخاب اولیهٔ
        // فایل) — یعنی به‌احتمال زیاد رمز اشتباه بوده. فایل انتخاب‌شده را
        // نگه می‌داریم تا کاربر مجبور نشود دوباره از فایل‌منیجر انتخابش
        // کند، و پیام خطا را دقیقاً کنار همان کادر رمز نشان می‌دهیم.
        setPendingImportFile(file);
        setImportPasswordError(message);
      } else {
        showToast(message, "error");
      }
    } finally {
      setIsImporting(false);
    }
  }

  async function handleImportFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const confirmed = window.confirm(t("settings.page.confirmRestore"));
    if (!confirmed) return;

    await runImport(file);
  }

  async function handleSubmitImportPassword() {
    if (!pendingImportFile) return;
    await runImport(pendingImportFile, importPassword);
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <SettingsIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          {t("settings.title")}
        </Typography>
      </Stack>

      <ProjectsSettingsCard />

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <LanguageIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              {t("settings.languageSection.title")}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t("settings.languageSection.description")}
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            {/* با یک زبان فعال، انتخابگر زبان بی‌معنی است و پنهان می‌شود؛ با فعال‌شدن دوبارهٔ زبان دوم خودکار برمی‌گردد. */}
            {LANGUAGE_LIST.length > 1 && (
              <TextField
                select
                fullWidth
                size="small"
                label={t("settings.languageSection.languageLabel")}
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
              >
                {LANGUAGE_LIST.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.nativeName}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              select
              fullWidth
              size="small"
              label={t("settings.languageSection.currencyLabel")}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
            >
              {Object.values(CURRENCIES).map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {t(c.labelKey)} ({c.symbol})
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
            {t("settings.page.displayModeTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t("settings.page.displayModeDescription")}
          </Typography>
          <Stack direction="row" spacing={1}>
            {THEME_OPTIONS.map((opt) => {
              const selected = preference === opt.value;
              return (
                <Button
                  key={opt.value}
                  onClick={() => setPreference(opt.value)}
                  variant={selected ? "contained" : "outlined"}
                  startIcon={opt.icon}
                  fullWidth
                  sx={{ flexDirection: "column", gap: 0.25, py: 1 }}
                >
                  {opt.label}
                </Button>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      {/* کارت «شغل‌ها و دستمزد» از اینجا حذف شد — طبق ادغام منوها، این
          میان‌بر حالا مستقیماً کنار فهرست نیروها (صفحهٔ «تیم و تجهیزات»،
          تب نیروها) است، چون کاربردش فقط برای همان‌جاست و کاربر مجبور
          نیست برای رسیدن بهش اول یاد بگیرد که باید بیاید تنظیمات. */}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
            {t("settings.page.quickAttendanceTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t("settings.page.quickAttendanceDescription")}
          </Typography>

          <Typography variant="body2" fontWeight={600} mb={1}>
            {t("settings.page.checkInHeading")}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={1.5}>
            {QUICK_CHECKIN_PRESETS.map((preset) => (
              <Button
                key={preset}
                onClick={() => updateQuickCheckInMutation.mutate(preset)}
                variant={quickCheckInTime === preset ? "contained" : "outlined"}
                size="small"
                disabled={updateQuickCheckInMutation.isPending}
              >
                {preset}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" mb={1}>
            <TextField
              label={t("settings.page.checkInCustomLabel")}
              type="time"
              value={customQuickCheckInTime}
              onChange={(e) => setCustomQuickCheckInTime(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <Button
              onClick={() => {
                if (!customQuickCheckInTime) return;
                updateQuickCheckInMutation.mutate(customQuickCheckInTime);
                setCustomQuickCheckInTime("");
              }}
              variant="outlined"
              size="small"
              disabled={updateQuickCheckInMutation.isPending || !customQuickCheckInTime}
            >
              {t("settings.page.register")}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2.5 }}>
            {t("settings.page.checkInCurrent", { time: quickCheckInTime })}
          </Typography>

          <Typography variant="body2" fontWeight={600} mb={1}>
            {t("settings.page.checkOutHeading")}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={1.5}>
            {QUICK_CHECKOUT_PRESETS.map((preset) => (
              <Button
                key={preset}
                onClick={() => updateQuickCheckOutMutation.mutate(preset)}
                variant={quickCheckOutTime === preset ? "contained" : "outlined"}
                size="small"
                disabled={updateQuickCheckOutMutation.isPending}
              >
                {preset}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label={t("settings.page.checkOutCustomLabel")}
              type="time"
              value={customQuickCheckOutTime}
              onChange={(e) => setCustomQuickCheckOutTime(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <Button
              onClick={() => {
                if (!customQuickCheckOutTime) return;
                updateQuickCheckOutMutation.mutate(customQuickCheckOutTime);
                setCustomQuickCheckOutTime("");
              }}
              variant="outlined"
              size="small"
              disabled={updateQuickCheckOutMutation.isPending || !customQuickCheckOutTime}
            >
              {t("settings.page.register")}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {t("settings.page.checkOutCurrent", { time: quickCheckOutTime })}
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
            {t("settings.page.quickBreakTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t("settings.page.quickBreakDescription")}
          </Typography>

          <Typography variant="body2" fontWeight={600} mb={1}>
            {t("settings.page.breakfast")}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <TextField
              label={t("settings.page.startTime")}
              type="time"
              value={breakfastStart}
              onChange={(e) => setBreakfastStart(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <TextField
              label={t("settings.page.endTime")}
              type="time"
              value={breakfastEnd}
              onChange={(e) => setBreakfastEnd(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
          </Stack>

          <Typography variant="body2" fontWeight={600} mb={1}>
            {t("settings.page.lunch")}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <TextField
              label={t("settings.page.startTime")}
              type="time"
              value={lunchStart}
              onChange={(e) => setLunchStart(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <TextField
              label={t("settings.page.endTime")}
              type="time"
              value={lunchEnd}
              onChange={(e) => setLunchEnd(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              onClick={() => updateQuickBreakMutation.mutate()}
              variant="contained"
              size="small"
              disabled={updateQuickBreakMutation.isPending}
            >
              {t("common.save")}
            </Button>
            <Button
              onClick={() => {
                setBreakfastStart("");
                setBreakfastEnd("");
                setLunchStart("");
                setLunchEnd("");
                updateQuickBreakMutation.mutate();
              }}
              variant="text"
              color="inherit"
              size="small"
              disabled={updateQuickBreakMutation.isPending}
            >
              {t("settings.page.clearDefaults")}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {data && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
              {t("settings.page.standardHoursTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t("settings.page.standardHoursDescription", {
                exampleWage: formatNumber(1000000, i18n.language),
                exampleHours: formatNumber(8, i18n.language),
                exampleRate: formatNumber(125000, i18n.language),
              })}
            </Typography>

            <Stack spacing={2}>
              <TextField
                label={t("settings.page.standardHoursLabel")}
                value={hours}
                onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
              />

              <Alert severity="info" variant="outlined">
                {t("settings.page.standardHoursNotice")}
              </Alert>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t("settings.page.previewLabel")}
                </Typography>
                <TextField
                  size="small"
                  value={sampleSalary}
                  onChange={(e) => setSampleSalary(toPlainDigitsOnly(e.target.value))}
                  inputMode="numeric"
                  sx={{ maxWidth: 220 }}
                />
                <Typography variant="body2" mt={1}>
                  <Trans
                    i18nKey="settings.page.hourlyResult"
                    values={{ amount: formatCurrency(hourlyRatePreview) }}
                    components={{ strong: <strong /> }}
                  />
                </Typography>
              </Box>

              <Button
                variant="contained"
                size="large"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {t("settings.page.saveSettings")}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
            {t("settings.page.backupTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t("settings.page.backupDescription")}
          </Typography>

          <TextField
            label={t("settings.page.exportPasswordLabel")}
            type="password"
            size="small"
            fullWidth
            value={exportPassword}
            onChange={(e) => setExportPassword(e.target.value)}
            helperText={
              exportPassword.trim()
                ? t("settings.page.exportPasswordHelperSet")
                : t("settings.page.exportPasswordHelperEmpty")
            }
            sx={{ mb: 2 }}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="contained"
              startIcon={isExporting ? <CircularProgress size={18} color="inherit" /> : <CloudDownloadIcon />}
              onClick={handleExport}
              disabled={isExporting}
              fullWidth
            >
              {t("settings.page.downloadBackup")}
            </Button>
            <Button
              variant="outlined"
              startIcon={isImporting ? <CircularProgress size={18} /> : <CloudUploadIcon />}
              onClick={handleImportClick}
              disabled={isImporting}
              fullWidth
            >
              {t("settings.page.restoreFromFile")}
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={handleImportFileChange}
            />
          </Stack>

          {pendingImportFile && (
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
              <Typography variant="body2" fontWeight={700} mb={1}>
                {t("settings.page.passwordProtectedTitle")}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
                <TextField
                  label={t("settings.page.importPasswordLabel")}
                  type="password"
                  size="small"
                  fullWidth
                  value={importPassword}
                  onChange={(e) => {
                    setImportPassword(e.target.value);
                    if (importPasswordError) setImportPasswordError(null);
                  }}
                  error={!!importPasswordError}
                  helperText={importPasswordError ?? undefined}
                  autoFocus
                />
                <Button
                  variant="contained"
                  onClick={handleSubmitImportPassword}
                  disabled={isImporting || !importPassword.trim()}
                >
                  {isImporting ? <CircularProgress size={18} color="inherit" /> : t("settings.page.restore")}
                </Button>
                <Button
                  color="inherit"
                  onClick={() => {
                    setPendingImportFile(null);
                    setImportPassword("");
                    setImportPasswordError(null);
                  }}
                  disabled={isImporting}
                >
                  {t("common.cancel")}
                </Button>
              </Stack>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Alert severity="warning" variant="outlined">
            {t("settings.page.restoreWarning")}
          </Alert>
        </CardContent>
      </Card>

      <AutoBackupCard />

      <CloudBackupCard />

      <NotificationSettingsCard />

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <InfoOutlinedIcon color="action" />
            <Typography variant="subtitle1" fontWeight={700}>
              {t("settings.aboutSection.title")}
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="body2">{t("settings.aboutSection.appName")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("settings.aboutSection.versionLabel")}: {__APP_VERSION__}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("settings.aboutSection.description")}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
