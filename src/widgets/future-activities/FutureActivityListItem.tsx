import { TouchEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Checkbox, Chip, IconButton, Stack, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RepeatIcon from "@mui/icons-material/Repeat";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { ActivityPriority, FutureActivity } from "../../entities/FutureActivity";
import type { Worker } from "../../entities/Worker";
import { WorkerAvatar } from "../worker-form/WorkerAvatar";
import { daysBetweenIso, getWeekdayLabel } from "../../shared/utils/jalaliDate";
import DateRangeIcon from "@mui/icons-material/DateRange";

const PRIORITY_COLORS: Record<ActivityPriority, string> = {
  low: "#4C9A73",
  medium: "#D69A2D",
  high: "#D14343",
};

// حداقل کشیدن افقی (پیکسل) برای این‌که سوایپ به‌معنای «تکمیل/بازگشت فعالیت» در نظر گرفته شود.
const COMPLETE_SWIPE_THRESHOLD_PX = 70;
const MAX_SWIPE_PX = 110;
// حداقل سرعت کشیدن (پیکسل بر میلی‌ثانیه) که حتی اگر به آستانهٔ فاصله نرسیده
// باشد، به‌عنوان یک «تلنگر» (flick) سریع در نظر گرفته می‌شود — دقیقاً همان
// رفتاری که در تلگرام و iOS باعث می‌شود یک کشیدن کوتاه ولی تند هم اثر کند،
// نه فقط کشیدن‌های کند و طولانی.
const FLICK_VELOCITY_THRESHOLD = 0.5;

interface FutureActivityListItemProps {
  activity: FutureActivity;
  /** نیروی مرتبط با این فعالیت، در صورت وجود (از قبل resolve شده توسط صفحه فراخواننده). */
  worker?: Worker | null;
  /** در نمای «تاریخچه»، به‌جای چک‌باکس، یک چیپ وضعیت (انجام‌شده/انجام‌نشده) نمایش داده می‌شود. */
  showStatusChip?: boolean;
  onToggleCompleted: (activity: FutureActivity) => void;
  onEdit: (activity: FutureActivity) => void;
  onDelete: (activity: FutureActivity) => void;
}

/**
 * ردیف یک فعالیت آینده، مشابه تجربهٔ Google Tasks/Telegram: علاوه بر
 * چک‌باکس، با سوایپ افقی (به هر جهت) هم می‌توان فعالیت را تکمیل/بازگشت داد —
 * یک پس‌زمینهٔ سبز با آیکون تیک، هم‌زمان با کشیدن انگشت، به‌آرامی نمایان
 * می‌شود.
 *
 * نکات فنی دربارهٔ رفتار ژست (که پیش‌تر باعث حس «خراب/لق» بودن حرکت می‌شد):
 * ۱) با touchAction: "pan-y" روی خودِ ردیف، مرورگر از همان ابتدا می‌داند این
 *    عنصر ژست افقی خودش را مدیریت می‌کند و اسکرول عمودی صفحه را با کشیدن
 *    افقی قاطی نمی‌کند — پیش از این نبودِ این خط باعث می‌شد حرکت گاهی با
 *    اسکرول کلی صفحه تداخل کند و لق بزند.
 * ۲) سرعت کشیدن هم مثل فاصله ردیابی می‌شود؛ یک تلنگر سریع (flick) حتی اگر به
 *    آستانهٔ فاصله نرسد، اگر به‌اندازهٔ کافی سریع باشد باز هم اثر می‌کند —
 *    دقیقاً رفتار مورد انتظار در تلگرام/iOS، نه فقط یک قانون فاصلهٔ ثابت.
 * ۳) لحظهٔ عبور از آستانهٔ تکمیل، یک بازخورد تصویری فوری (بزرگ‌شدن آیکون)
 *    نشان داده می‌شود تا کاربر پیش از رها کردن انگشت، «قطعی شدن» عمل را حس
 *    کند — نه این‌که فقط در پایان (پس از رها کردن) متوجه شود.
 */
export function FutureActivityListItem({
  activity,
  worker,
  showStatusChip,
  onToggleCompleted,
  onEdit,
  onDelete,
}: FutureActivityListItemProps) {
  const { t } = useTranslation();
  const priorityLabels: Record<ActivityPriority, string> = {
    low: t("futureActivities.priorityLow"),
    medium: t("futureActivities.priorityMedium"),
    high: t("futureActivities.priorityHigh"),
  };
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastMove = useRef<{ x: number; time: number } | null>(null);
  const [dragPx, setDragPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    const now = Date.now();
    touchStart.current = { x: t.clientX, y: t.clientY, time: now };
    lastMove.current = { x: t.clientX, time: now };
    setIsDragging(true);
    setScrollLocked(false);
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (!touchStart.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;

    // تشخیص قصد: اگر حرکت عمودی به‌وضوح بیشتر از افقی باشد، یعنی کاربر قصد
    // اسکرول دارد نه سوایپ ردیف — این‌جا کاملاً از این ژست کنار می‌کشیم و
    // اجازه می‌دهیم اسکرول پیش‌فرض مرورگر طبیعی ادامه پیدا کند.
    if (!scrollLocked && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
      touchStart.current = null;
      lastMove.current = null;
      setIsDragging(false);
      setDragPx(0);
      return;
    }
    // به‌محض این‌که قصد افقی محرز شد (و از یک آستانهٔ کوچک عبور کرد)، قفل
    // می‌شود تا در ادامهٔ همین لمس، لرزش‌های جزئی عمودی باعث لغو ناگهانی
    // سوایپ در حال انجام نشوند.
    if (!scrollLocked && Math.abs(dx) > 6) {
      setScrollLocked(true);
    }

    const now = Date.now();
    lastMove.current = { x: t.clientX, time: now };

    const clamped = Math.max(-MAX_SWIPE_PX, Math.min(MAX_SWIPE_PX, dx));
    setDragPx(clamped);
  }

  function handleTouchEnd() {
    if (!touchStart.current) {
      setIsDragging(false);
      setScrollLocked(false);
      setDragPx(0);
      return;
    }

    const releaseVelocity =
      lastMove.current && touchStart.current
        ? (lastMove.current.x - touchStart.current.x) / Math.max(1, lastMove.current.time - touchStart.current.time)
        : 0;

    touchStart.current = null;
    lastMove.current = null;
    setIsDragging(false);
    setScrollLocked(false);

    const distanceCommitted = Math.abs(dragPx) >= COMPLETE_SWIPE_THRESHOLD_PX;
    const flickCommitted = Math.abs(releaseVelocity) >= FLICK_VELOCITY_THRESHOLD && Math.abs(dragPx) > 12;

    if (distanceCommitted || flickCommitted) {
      onToggleCompleted(activity);
    }
    setDragPx(0);
  }

  const swipeProgress = Math.min(1, Math.abs(dragPx) / COMPLETE_SWIPE_THRESHOLD_PX);
  const isCommitted = swipeProgress >= 1;

  return (
    <Box sx={{ position: "relative", borderRadius: 2, overflow: "hidden" }}>
      {/* پس‌زمینهٔ سبز پشت سوایپ — فقط وقتی در حال کشیدن است دیده می‌شود.
          لحظهٔ عبور از آستانهٔ تکمیل (isCommitted)، آیکون کمی بزرگ‌تر می‌شود
          تا همان لحظه (نه فقط پس از رها کردن انگشت) بازخورد «قطعی شد» به
          کاربر داده شود — دقیقاً حسی که در سوایپ‌های iOS/تلگرام وجود دارد. */}
      {dragPx !== 0 && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: activity.isCompleted ? "warning.main" : "success.main",
            display: "flex",
            alignItems: "center",
            justifyContent: dragPx > 0 ? "flex-start" : "flex-end",
            px: 2,
            opacity: swipeProgress,
            transition: "background-color 150ms ease-out",
          }}
        >
          <CheckCircleIcon
            sx={{
              color: "#fff",
              transform: isCommitted ? "scale(1.15)" : "scale(1)",
              transition: "transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />
        </Box>
      )}

      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={1}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        sx={{
          position: "relative",
          p: 1.25,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          opacity: activity.isCompleted ? 0.6 : 1,
          transform: `translateX(${dragPx}px)`,
          // pan-y: به مرورگر می‌گوید فقط اسکرول عمودی روی این عنصر پیش‌فرض
          // بماند و ژست افقی را به‌طور کامل به کنترل خودِ این کامپوننت واگذار
          // کند — بدون این تنظیم، کشیدن افقی روی موبایل می‌توانست هم‌زمان
          // باعث تلاش مرورگر برای اسکرول/rubber-band عمودی هم بشود و حرکت
          // را لق و ناهماهنگ نشان دهد.
          touchAction: "pan-y",
          transition: isDragging
            ? "none"
            : `transform ${isCommitted ? 260 : 200}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out`,
        }}
      >
        <Box
          sx={{
            width: 4,
            alignSelf: "stretch",
            borderRadius: 999,
            bgcolor: PRIORITY_COLORS[activity.priority],
            flexShrink: 0,
          }}
        />

        {showStatusChip ? (
          <Chip
            label={activity.isCompleted ? t("futureActivities.statusCompleted") : t("futureActivities.statusNotCompleted")}
            size="small"
            color={activity.isCompleted ? "success" : "default"}
            onClick={() => onToggleCompleted(activity)}
            sx={{ mt: 0.25, flexShrink: 0, transition: "all 150ms ease-out" }}
          />
        ) : (
          <Checkbox
            checked={activity.isCompleted}
            onChange={() => onToggleCompleted(activity)}
            size="small"
            sx={{ mt: -0.5, transition: "transform 150ms ease-out", "&:active": { transform: "scale(0.85)" } }}
          />
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap">
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{
                textDecoration: activity.isCompleted ? "line-through" : "none",
                transition: "opacity 200ms ease-out",
              }}
            >
              {activity.title}
            </Typography>
            {activity.seriesId && <RepeatIcon sx={{ fontSize: 14 }} color="disabled" />}
            {activity.endDate && activity.endDate !== activity.date && (
              <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: "text.secondary" }}>
                <DateRangeIcon sx={{ fontSize: 13 }} />
                <Typography variant="caption">
                  {t("futureActivities.daysCount", { count: daysBetweenIso(activity.date, activity.endDate) + 1 })}
                </Typography>
              </Stack>
            )}
            {activity.time && (
              <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: "text.secondary" }}>
                <AccessTimeIcon sx={{ fontSize: 13 }} />
                <Typography variant="caption">{activity.time}</Typography>
              </Stack>
            )}
            {worker && (
              <Typography variant="caption" color="text.secondary">
                {getWeekdayLabel(activity.date)}
              </Typography>
            )}
          </Stack>
          {activity.description && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {activity.description}
            </Typography>
          )}
          <Stack direction="row" alignItems="center" spacing={1} mt={0.25} flexWrap="wrap">
            <Typography variant="caption" sx={{ color: PRIORITY_COLORS[activity.priority], fontWeight: 600 }}>
              {t("futureActivities.priorityLabel", { level: priorityLabels[activity.priority] })}
            </Typography>
            {worker && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <WorkerAvatar
                  avatarPhotoId={worker.avatarPhotoId}
                  initials={`${worker.firstName.charAt(0)}${worker.lastName.charAt(0)}`}
                  size={18}
                />
                <Typography variant="caption" color="text.secondary">
                  {worker.firstName} {worker.lastName}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>

        <Stack direction="row" spacing={0}>
          <IconButton size="small" onClick={() => onEdit(activity)}>
            <EditIcon sx={{ fontSize: 17 }} />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => onDelete(activity)}>
            <DeleteOutlineIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Stack>
      </Stack>
    </Box>
  );
}
