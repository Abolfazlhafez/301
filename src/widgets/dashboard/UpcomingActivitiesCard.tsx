import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import EventNoteIcon from "@mui/icons-material/EventNote";
import { futureActivitiesApi } from "../../shared/api/futureActivitiesApi";
import { getRelativeDayLabel, getTodayIso } from "../../shared/utils/jalaliDate";
import type { ActivityPriority } from "../../entities/FutureActivity";

const PRIORITY_COLORS: Record<ActivityPriority, string> = {
  low: "#4C9A73",
  medium: "#D69A2D",
  high: "#D14343",
};

/**
 * خلاصه‌ای از نزدیک‌ترین فعالیت‌های آینده، برای نمایش در داشبورد اصلی. برخلاف
 * نسخهٔ قبلی، همیشه نمایش داده می‌شود (حتی وقتی فعلاً فعالیتی ثبت نشده) تا
 * دسترسی از داشبورد به این بخش هیچ‌وقت به‌طور کامل ناپدید نشود.
 */
export function UpcomingActivitiesCard() {
  const navigate = useNavigate();
  const today = getTodayIso();

  const { data: activities = [] } = useQuery({
    queryKey: ["future-activities", "dashboard-summary"],
    queryFn: () => futureActivitiesApi.listUpcomingSummary(5),
  });

  const overdueCount = activities.filter((a) => a.date < today).length;

  return (
    <Card variant="outlined" onClick={() => navigate("/activities?tab=upcoming")} sx={{ cursor: "pointer" }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EventNoteIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              فعالیت‌های آینده
            </Typography>
          </Stack>
          {overdueCount > 0 && <Chip label={`${overdueCount} سررسید گذشته`} size="small" color="error" />}
        </Stack>

        {activities.length > 0 ? (
          <Stack spacing={1}>
            {activities.map((activity) => (
              <Stack key={activity.id} direction="row" alignItems="center" spacing={1}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: PRIORITY_COLORS[activity.priority],
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                  {activity.title}
                </Typography>
                <Typography
                  variant="caption"
                  color={activity.date < today ? "error.main" : "text.secondary"}
                  sx={{ flexShrink: 0 }}
                >
                  {getRelativeDayLabel(activity.date, today)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            فعالیت آینده‌ای ثبت نشده — برای افزودن لمس کنید.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
