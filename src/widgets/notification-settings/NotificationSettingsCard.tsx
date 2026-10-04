import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { Capacitor } from "@capacitor/core";
import { settingsApi } from "../../shared/api/settingsApi";
import { extractErrorMessage } from "../../shared/api/client";
import { useToast } from "../../shared/components/ToastProvider";
import { futureActivitiesApi } from "../../shared/api/futureActivitiesApi";
import { notificationsApi } from "../../shared/api/notificationsApi";

export function NotificationSettingsCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const isNative = Capacitor.isNativePlatform();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  async function handleSendTest() {
    setIsSendingTest(true);
    try {
      const sent = await notificationsApi.sendTest();
      showToast(
        t(sent ? "notificationSettings.testSentToast" : "notificationSettings.permissionDenied") as string,
        sent ? "success" : "error"
      );
    } finally {
      setIsSendingTest(false);
    }
  }

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const updateMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      settingsApi.updateNotificationSettings({ activityNotificationsEnabled: enabled }),
    onSuccess: async (updated) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      if (updated.activityNotificationsEnabled) {
        setIsSyncing(true);
        try {
          const granted = await notificationsApi.ensurePermission();
          if (!granted) {
            showToast(t("notificationSettings.permissionDenied") as string, "error");
          } else {
            const openActivities = await futureActivitiesApi.listAll({ scope: "all", includeCompleted: false });
            await notificationsApi.resyncAll(openActivities);
            showToast(t("notificationSettings.enabledToast") as string, "success");
          }
        } finally {
          setIsSyncing(false);
        }
      } else {
        showToast(t("notificationSettings.disabledToast") as string, "success");
      }
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <NotificationsActiveIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>
            {t("notificationSettings.title")}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          {t("notificationSettings.description")}
        </Typography>

        {!isNative ? (
          <Alert severity="info" variant="outlined">
            {t("notificationSettings.nativeOnly")}
          </Alert>
        ) : isLoading ? (
          <CircularProgress size={20} />
        ) : (
          settings && (
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.activityNotificationsEnabled}
                    disabled={updateMutation.isPending || isSyncing}
                    onChange={(e) => updateMutation.mutate(e.target.checked)}
                  />
                }
                label={t("notificationSettings.toggleLabel") as string}
              />
              {isSyncing && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    {t("notificationSettings.syncing")}
                  </Typography>
                </Stack>
              )}
              {settings.activityNotificationsEnabled && !isSyncing && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSendTest}
                  disabled={isSendingTest}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {isSendingTest ? t("notificationSettings.sendingTest") : t("notificationSettings.sendTest")}
                </Button>
              )}
            </Stack>
          )
        )}
      </CardContent>
    </Card>
  );
}
