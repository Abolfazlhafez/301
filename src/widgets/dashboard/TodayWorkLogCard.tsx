import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AvatarGroup, Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { photosApi } from "../../shared/api/photosApi";
import { LazyPhotoAvatar } from "../../shared/components/PhotoThumbImg";
import { workLogNoteApi } from "../../shared/api/workLogNoteApi";
import { getTodayIso } from "../../shared/utils/jalaliDate";

const PREVIEW_PHOTOS_COUNT = 4;

/**
 * خلاصه‌ای از گزارش کار «امروز» (تعداد عکس‌ها + چند تصویر کوچک پیش‌نمایش +
 * متن توضیحات در صورت وجود) در داشبورد نشان داده می‌شود. برخلاف نسخهٔ قبلی،
 * این کارت همیشه نمایش داده می‌شود — حتی وقتی هنوز برای امروز گزارشی ثبت
 * نشده — چون نبود یک ورودی ثابت و همیشه-در-دسترس به «گزارش کار» از داشبورد
 * دقیقاً همان مشکلی بود که باعث می‌شد این بخش گاهی پیدا نشود (به‌خصوص صبح
 * زود، پیش از ثبت اولین گزارش روز، که همان لحظه‌ای است که این دسترسی
 * بیشترین کاربرد را دارد). با لمس کارت، کاربر مستقیم به زیرتبِ «گزارش کار»
 * در صفحهٔ «فعالیت‌ها» برای همان روز هدایت می‌شود.
 */
export function TodayWorkLogCard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const DrillDownIcon = theme.direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;
  const today = getTodayIso();

  const { data: photos = [] } = useQuery({
    queryKey: ["photos", "site", "day", today],
    queryFn: () => photosApi.list({ relatedType: "site", from: today, to: today }),
  });

  const { data: note } = useQuery({
    queryKey: ["work-log-note", today],
    queryFn: () => workLogNoteApi.getByDate(today),
  });

  const hasDescription = !!note?.description?.trim();
  const hasAnything = photos.length > 0 || hasDescription;
  const previewPhotos = photos.slice(0, PREVIEW_PHOTOS_COUNT);

  return (
    <Card variant="outlined" onClick={() => navigate("/activities?tab=work-log")} sx={{ cursor: "pointer" }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AssignmentTurnedInIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              گزارش کار امروز
            </Typography>
          </Stack>
          <DrillDownIcon fontSize="small" sx={{ color: "text.disabled" }} />
        </Stack>

        {hasAnything ? (
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {previewPhotos.length > 0 && (
              <AvatarGroup
                max={PREVIEW_PHOTOS_COUNT + 1}
                sx={{
                  "& .MuiAvatar-root": { width: 40, height: 40, borderWidth: 2 },
                }}
              >
                {previewPhotos.map((photo) => (
                  <LazyPhotoAvatar key={photo.id} photo={photo} variant="rounded" />
                ))}
              </AvatarGroup>
            )}

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {photos.length > 0 ? `${photos.length} عکس ثبت شده` : "بدون عکس"}
              </Typography>
              {hasDescription && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {note!.description}
                </Typography>
              )}
            </Box>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            هنوز گزارشی برای امروز ثبت نشده — برای افزودن عکس یا توضیح لمس کنید.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
