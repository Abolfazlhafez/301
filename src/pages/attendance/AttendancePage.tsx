import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import BoltIcon from "@mui/icons-material/Bolt";
import FreeBreakfastIcon from "@mui/icons-material/FreeBreakfast";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import SecurityIcon from "@mui/icons-material/Security";
import { workersApi } from "../../shared/api/workersApi";
import { attendanceApi } from "../../shared/api/attendanceApi";
import { settingsApi } from "../../shared/api/settingsApi";
import { optionalLeaveApi } from "../../shared/api/optionalLeaveApi";
import { OptionalLeaveType } from "../../entities/OptionalLeave";
import { timeLossApi } from "../../shared/api/timeLossApi";
import { breakTimeApi } from "../../shared/api/breakTimeApi";
import { guardShiftsApi } from "../../shared/api/guardShiftsApi";
import { extractErrorMessage } from "../../shared/api/client";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { AnimatedList } from "../../shared/components/AnimatedList";
import { AttendanceFormDialog } from "../../widgets/attendance-form/AttendanceFormDialog";
import { TimeLossFormDialog } from "../../widgets/timeloss-form/TimeLossFormDialog";
import { TimeLossItem } from "../../widgets/timeloss-form/TimeLossItem";
import { BreakTimeFormDialog } from "../../widgets/timeloss-form/BreakTimeFormDialog";
import { GuardShiftFormDialog } from "../../widgets/guard-duty/GuardShiftFormDialog";
import { OptionalLeaveFormDialog } from "../../widgets/optional-leave/OptionalLeaveFormDialog";
import { PhotoGallery } from "../../widgets/photo-gallery/PhotoGallery";
import { WorkerAvatar } from "../../widgets/worker-form/WorkerAvatar";
import { getTodayIso, toJalaliDisplay, toJalaliWithWeekday } from "../../shared/utils/jalaliDate";
import { formatCurrency, formatMinutesToText, formatNumber } from "../../shared/utils/format";
import { TimeLoss } from "../../entities/TimeLoss";
import { BreakTimeType } from "../../entities/BreakTime";
import { GuardShift } from "../../entities/GuardShift";
import { reportsApi } from "../../shared/api/dashboardApi";

const BREAK_TYPE_LABEL_KEYS: Record<BreakTimeType, string> = {
  breakfast: "breakTime.typeBreakfast",
  lunch: "breakTime.typeLunch",
  other: "breakTime.typeOther",
};

interface AttendancePageProps {
  /** وقتی درون صفحه «منابع» به‌صورت زیرتب نمایش داده می‌شود، عنوان تکراری مخفی می‌گردد. */
  embedded?: boolean;
  /**
   * حضور و غیاب دیگر یک تب مستقل نیست — طبق بازطراحی، از داخل کارت هر نیرو
   * در تب «نیروها» باز می‌شود و مستقیم روی همان یک نفر می‌رود. وقتی این مقدار
   * پر باشد: انتخابگر نیرو، دکمه‌های دسته‌جمعی («ثبت سریع همه») و کادر
   * نام/آواتار تکراری (که در سربرگ دیالوگ بیرونی همین اطلاعات هست) مخفی
   * می‌شوند و صفحه فقط حول همین یک نیرو + تاریخ انتخابی می‌چرخد.
   */
  lockedWorkerId?: string;
  /**
   * دکمهٔ دسته‌جمعی این صفحه دیگر مسیر ثبت جداگانه‌ای ندارد؛ شیت «حضور گروهی» (که پدر مشترک
   * نگه می‌دارد) را برای تاریخ انتخابی و با نیروهای ثبت‌نشده از قبل انتخاب‌شده باز می‌کند.
   */
  onOpenBulkAttendance?: (date: string, preselectWorkerIds: string[]) => void;
}

export function AttendancePage({ embedded = false, lockedWorkerId, onOpenBulkAttendance }: AttendancePageProps = {}) {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const today = getTodayIso();

  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(lockedWorkerId ?? "");

  // اگر دیالوگ قفل‌شده برای نیروی دیگری دوباره باز شود (بدون remount کامل
  // کامپوننت)، انتخاب باید با prop جدید هم‌گام بماند.
  useEffect(() => {
    if (lockedWorkerId) setSelectedWorkerId(lockedWorkerId);
  }, [lockedWorkerId]);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [timeLossDialogOpen, setTimeLossDialogOpen] = useState(false);
  const [breakTimeDialogOpen, setBreakTimeDialogOpen] = useState(false);
  // وقتی «صبحانه سریع»/«ناهار سریع» زده می‌شود ولی نه ساعت پیش‌فرضی در
  // تنظیمات موجود است و نه سابقه‌ای برای این نیرو، به‌جای خطا، فرم ثبت
  // دستی با همین نوع از پیش انتخاب‌شده باز می‌شود. این مقدار همان نوع را
  // نگه می‌دارد تا BreakTimeFormDialog با آن باز شود.
  const [breakTimeInitialType, setBreakTimeInitialType] = useState<BreakTimeType>("breakfast");
  const [editingTimeLoss, setEditingTimeLoss] = useState<TimeLoss | null>(null);
  const [deletingTimeLoss, setDeletingTimeLoss] = useState<TimeLoss | null>(null);
  const [deletingBreakTimeId, setDeletingBreakTimeId] = useState<string | null>(null);
  const [guardShiftDialogOpen, setGuardShiftDialogOpen] = useState(false);
  const [editingGuardShift, setEditingGuardShift] = useState<GuardShift | null>(null);
  const [deletingGuardShift, setDeletingGuardShift] = useState<GuardShift | null>(null);
  const [quickCheckInSettingsOpen, setQuickCheckInSettingsOpen] = useState(false);
  const [quickCheckInTimeDraft, setQuickCheckInTimeDraft] = useState("");
  const [quickCheckOutTimeDraft, setQuickCheckOutTimeDraft] = useState("");
  const [deleteAttendanceConfirmOpen, setDeleteAttendanceConfirmOpen] = useState(false);
  const [optionalLeaveDialogOpen, setOptionalLeaveDialogOpen] = useState(false);
  const [deleteOptionalLeaveConfirmOpen, setDeleteOptionalLeaveConfirmOpen] = useState(false);

  const { data: appSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  const updateQuickCheckInMutation = useMutation({
    mutationFn: (input: { checkIn: string; checkOut: string }) =>
      settingsApi.updateQuickCheckInSettings({
        quickCheckInDefaultTime: input.checkIn,
        quickCheckOutDefaultTime: input.checkOut,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      showToast(t("attendance.page.toastQuickTimeChanged"), "success");
      setQuickCheckInSettingsOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ["workers", "active"],
    queryFn: () => workersApi.list({ isActive: true }),
  });

  // برای «ثبت سریع همه» لازم است بدانیم کدام نیروها از قبل برای همین تاریخ
  // حضور ثبت‌شده دارند (تا آن‌ها را رد کند و دوباره ننویسد).
  const { data: attendancesForDate } = useQuery({
    queryKey: ["attendances", "by-date", selectedDate],
    queryFn: () => attendanceApi.list({ date: selectedDate }),
  });

  const selectedWorker = useMemo(
    () => workers?.find((w) => w.id === selectedWorkerId) || null,
    [workers, selectedWorkerId]
  );

  const { data: attendances, isLoading: attendanceLoading } = useQuery({
    queryKey: ["attendances", selectedWorkerId, selectedDate],
    queryFn: () => attendanceApi.list({ workerId: selectedWorkerId, date: selectedDate }),
    enabled: !!selectedWorkerId,
  });

  const currentAttendance = attendances?.[0] || null;

  const { data: currentOptionalLeave } = useQuery({
    queryKey: ["optional-leave", selectedWorkerId, selectedDate],
    queryFn: () => optionalLeaveApi.findByWorkerAndDate(selectedWorkerId, selectedDate),
    enabled: !!selectedWorkerId,
  });

  const {
    data: dailyReport,
    isLoading: reportLoading,
    isError: reportError,
    error: reportErrorObj,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ["daily-report", selectedWorkerId, selectedDate],
    queryFn: () => reportsApi.dailyForWorker(selectedWorkerId, selectedDate),
    enabled: !!selectedWorkerId,
  });

  const { data: timeLosses } = useQuery({
    queryKey: ["time-losses", currentAttendance?.id],
    queryFn: () => timeLossApi.list({ attendanceId: currentAttendance!.id }),
    enabled: !!currentAttendance?.id,
  });

  const { data: breakTimes } = useQuery({
    queryKey: ["break-times", currentAttendance?.id],
    queryFn: () => breakTimeApi.list({ attendanceId: currentAttendance!.id }),
    enabled: !!currentAttendance?.id,
  });

  const { data: guardShifts } = useQuery({
    queryKey: ["guard-shifts", selectedWorkerId, selectedDate],
    queryFn: () => guardShiftsApi.findByWorkerAndDate(selectedWorkerId, selectedDate),
    enabled: !!selectedWorkerId && !!selectedWorker?.guardDutyEnabled,
  });

  // آخرین نوبت نگهبانی ثبت‌شدهٔ همین نیرو قبل از تاریخ فعلی — فقط برای
  // پیشنهاد ساعت شروع/پایان در دیالوگ ثبت نوبت جدید استفاده می‌شود (نوبت‌های
  // نگهبانی معمولاً هر شب ساعت ثابتی دارند، پس تایپ دوباره تکراری است).
  const { data: previousGuardShifts } = useQuery({
    queryKey: ["guard-shifts", "previous", selectedWorkerId, selectedDate],
    queryFn: () => guardShiftsApi.list({ workerId: selectedWorkerId, to: selectedDate }),
    enabled: !!selectedWorkerId && !!selectedWorker?.guardDutyEnabled,
  });
  const previousGuardShift = (previousGuardShifts ?? [])
    .filter((s) => s.date < selectedDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["attendances"] });
    queryClient.invalidateQueries({ queryKey: ["daily-report"] });
    queryClient.invalidateQueries({ queryKey: ["time-losses"] });
    queryClient.invalidateQueries({ queryKey: ["break-times"] });
    queryClient.invalidateQueries({ queryKey: ["guard-shifts"] });
    queryClient.invalidateQueries({ queryKey: ["optional-leave"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  }

  const upsertAttendanceMutation = useMutation({
    mutationFn: (input: { checkIn: string | null; checkOut: string | null; note: string | null }) =>
      attendanceApi.upsert({
        workerId: selectedWorkerId,
        date: selectedDate,
        ...input,
      }),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastCreated"), "success");
      setAttendanceDialogOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  // حذف کامل رکورد حضور — این عملیات کاملاً اختیاری و فقط با درخواست صریح
  // کاربر انجام می‌شود (هرگز خودکار)؛ با حذف، وضعیت شخص برای این روز دوباره
  // به «بدون ثبت» برمی‌گردد، دقیقاً طبق نیاز.
  const deleteAttendanceMutation = useMutation({
    mutationFn: (id: string) => attendanceApi.remove(id),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastDeleted"), "success");
      setDeleteAttendanceConfirmOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  // --- غیبت مجاز: کاملاً مستقل از حضور و غیاب عادی — یک روز کامل که نیرو
  // سر کار نیامده ولی با اجازه/توافق بوده (مرخصی، مأموریت و...). خودِ سرویس
  // (optionalLeaveService) جلوی ثبت هم‌زمان حضور واقعی و غیبت مجاز برای یک
  // نیرو-تاریخ را می‌گیرد، پس این‌جا فقط پیام خطای احتمالی آن نمایش داده می‌شود.
  const optionalLeaveUpsertMutation = useMutation({
    mutationFn: (input: { type: OptionalLeaveType; isPaid: boolean; note: string | null }) =>
      optionalLeaveApi.upsert({ workerId: selectedWorkerId, date: selectedDate, ...input }),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastLeaveCreated"), "success");
      setOptionalLeaveDialogOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const optionalLeaveDeleteMutation = useMutation({
    mutationFn: (id: string) => optionalLeaveApi.remove(id),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastLeaveDeleted"), "success");
      setDeleteOptionalLeaveConfirmOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  // «ثبت سریع»: بدون باز کردن دیالوگ، ساعت پیشنهادی را با یک تپ برای همین
  // تاریخ ثبت می‌کند. اولویت پیشنهاد: ۱) شیفت ثابت خودِ نیرو در پروفایلش،
  // ۲) آخرین حضور واقعی ثبت‌شدهٔ همان نیرو، ۳) ساعت پیش‌فرض سراسری (تنظیمات
  // → حضور و غیاب → ثبت حضور سریع) — این لایهٔ سوم عمداً اضافه شده تا این
  // دکمه حتی برای اولین‌بار (بدون هیچ سابقه‌ای از آن نیرو) هم کار کند؛ فقط
  // اگر ساعت پیش‌فرض سراسری هم به‌گونه‌ای نامعتبر/خالی باشد، خطا می‌دهد.
  const quickCheckInMutation = useMutation({
    mutationFn: async () => {
      const suggestion = await attendanceApi.getSuggestedTimes(selectedWorkerId);
      if (!suggestion.checkIn && !suggestion.checkOut) {
        throw new Error(
          t("attendance.page.errNoDefaultTime")
        );
      }
      return attendanceApi.upsert({
        workerId: selectedWorkerId,
        date: selectedDate,
        checkIn: suggestion.checkIn,
        checkOut: suggestion.checkOut,
      });
    },
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastQuickDone"), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const createTimeLossMutation = useMutation({
    mutationFn: (input: { startTime: string; endTime: string; reason: string; note: string | null }) =>
      timeLossApi.create({
        workerId: selectedWorkerId,
        attendanceId: currentAttendance!.id,
        ...input,
      }),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastTimeLossCreated"), "success");
      setTimeLossDialogOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateTimeLossMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { startTime: string; endTime: string; reason: string; note: string | null };
    }) => timeLossApi.update(id, input),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastTimeLossUpdated"), "success");
      setTimeLossDialogOpen(false);
      setEditingTimeLoss(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteTimeLossMutation = useMutation({
    mutationFn: (id: string) => timeLossApi.remove(id),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastTimeLossDeleted"), "success");
      setDeletingTimeLoss(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const createBreakTimeMutation = useMutation({
    mutationFn: (input: { type: BreakTimeType; startTime: string; endTime: string; note: string | null }) =>
      breakTimeApi.create({
        workerId: selectedWorkerId,
        attendanceId: currentAttendance!.id,
        ...input,
      }),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastBreakCreated"), "success");
      setBreakTimeDialogOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  // «ثبت سریع» صبحانه/ناهار با این اولویت ساعت را تعیین می‌کند:
  //  ۱) ساعت پیش‌فرض دستی که کاربر در تنظیمات مشخص کرده (اگر باشد).
  //  ۲) وگرنه آخرین استراحتِ همان نوع که خودِ کاربر قبلاً برای همین نیرو
  //     ثبت کرده (سابقه).
  //  ۳) اگر هیچ‌کدام نبود، دیگر خطا نمی‌دهد — به‌جای آن فرم ثبت دستی با
  //     همین نوع از پیش انتخاب‌شده باز می‌شود تا کاربر یک‌بار وارد کند.
  const quickBreakMutation = useMutation({
    mutationFn: async (type: BreakTimeType) => {
      const quick = await breakTimeApi.getQuickBreakTime(selectedWorkerId, type);
      if (!quick.startTime || !quick.endTime) {
        return { needsManualEntry: true as const, type };
      }
      const created = await breakTimeApi.create({
        workerId: selectedWorkerId,
        attendanceId: currentAttendance!.id,
        type,
        startTime: quick.startTime,
        endTime: quick.endTime,
        note: null,
      });
      return { needsManualEntry: false as const, type, created, source: quick.source };
    },
    onSuccess: (result) => {
      if (result.needsManualEntry) {
        setBreakTimeInitialType(result.type);
        setBreakTimeDialogOpen(true);
        showToast(t("attendance.page.toastBreakNoDefault"), "info");
        return;
      }
      invalidateAll();
      const fromSettings = result.source === "settings-default";
      const toastKey =
        result.type === "breakfast"
          ? fromSettings
            ? "attendance.page.toastBreakBreakfastSettings"
            : "attendance.page.toastBreakBreakfastPrevious"
          : fromSettings
            ? "attendance.page.toastBreakLunchSettings"
            : "attendance.page.toastBreakLunchPrevious";
      showToast(t(toastKey), "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteBreakTimeMutation = useMutation({
    mutationFn: (id: string) => breakTimeApi.remove(id),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastBreakDeleted"), "success");
      setDeletingBreakTimeId(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const createGuardShiftMutation = useMutation({
    mutationFn: (input: { startTime: string; endTime: string; note: string | null }) =>
      guardShiftsApi.create({
        workerId: selectedWorkerId,
        date: selectedDate,
        ...input,
      }),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastGuardCreated"), "success");
      setGuardShiftDialogOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateGuardShiftMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { startTime: string; endTime: string; note: string | null };
    }) => guardShiftsApi.update(id, input),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastGuardUpdated"), "success");
      setGuardShiftDialogOpen(false);
      setEditingGuardShift(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteGuardShiftMutation = useMutation({
    mutationFn: (id: string) => guardShiftsApi.remove(id),
    onSuccess: () => {
      invalidateAll();
      showToast(t("attendance.page.toastGuardDeleted"), "success");
      setDeletingGuardShift(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  function handleGuardShiftSubmit(input: { startTime: string; endTime: string; note: string | null }) {
    if (editingGuardShift) {
      updateGuardShiftMutation.mutate({ id: editingGuardShift.id, input });
    } else {
      createGuardShiftMutation.mutate(input);
    }
  }

  function handleTimeLossSubmit(input: {
    startTime: string;
    endTime: string;
    reason: string;
    note: string | null;
  }) {
    if (editingTimeLoss) {
      updateTimeLossMutation.mutate({ id: editingTimeLoss.id, input });
    } else {
      createTimeLossMutation.mutate(input);
    }
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {!embedded && (
        <Typography variant="h5" fontWeight={700}>
          {t("attendance.page.heading")}
        </Typography>
      )}

      <Stack spacing={1.5}>
        {!lockedWorkerId && (
          <>
            {/*
              Autocomplete (instead of a plain select) so a worker can be found by
              typing a name; the green check mark next to a name shows who already
              has attendance recorded for this date.
            */}
            <Autocomplete
              options={workers ?? []}
              loading={workersLoading}
              value={selectedWorker}
              onChange={(_, value) => setSelectedWorkerId(value?.id ?? "")}
              getOptionLabel={(w) => `${w.firstName} ${w.lastName}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText={t("attendance.page.workerNoOptions")}
              loadingText={t("common.loading")}
              renderOption={(props, w) => {
                const hasAttendance = (attendancesForDate ?? []).some((a) => a.workerId === w.id);
                return (
                  <MenuItem {...props} key={w.id}>
                    <Stack direction="row" alignItems="center" spacing={1} width="100%">
                      <WorkerAvatar
                        avatarPhotoId={w.avatarPhotoId}
                        initials={`${w.firstName.charAt(0)}${w.lastName.charAt(0)}`}
                        size={24}
                      />
                      <Box flex={1}>
                        {w.firstName} {w.lastName} — {w.position}
                      </Box>
                      {hasAttendance && (
                        <Typography variant="caption" color="success.main" fontWeight={700}>
                          {t("attendance.page.registeredMark")}
                        </Typography>
                      )}
                    </Stack>
                  </MenuItem>
                );
              }}
              renderInput={(params) => <TextField {...params} label={t("attendance.page.workerLabel")} placeholder={t("attendance.page.searchPlaceholder")} />}
            />
          </>
        )}

        <JalaliDatePicker label={t("attendance.page.dateLabel")} value={selectedDate} onChange={setSelectedDate} size="small" />
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
          {toJalaliWithWeekday(selectedDate)}
        </Typography>

        {!lockedWorkerId && (
          <>
            {onOpenBulkAttendance && (
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<BoltIcon />}
                onClick={() => {
                  const withCheckIn = new Set((attendancesForDate ?? []).filter((a) => !!a.checkIn).map((a) => a.workerId));
                  onOpenBulkAttendance(
                    selectedDate,
                    (workers ?? []).filter((w) => !withCheckIn.has(w.id)).map((w) => w.id)
                  );
                }}
              >
                {t("attendance.bulk.entryChip")}
              </Button>
            )}
            <Tooltip
              title={t("attendance.page.quickTimesTooltip", {
                from: appSettings?.quickCheckInDefaultTime ?? "...",
                to: appSettings?.quickCheckOutDefaultTime ?? "...",
              })}
            >
              <IconButton
                size="small"
                onClick={() => {
                  setQuickCheckInTimeDraft(appSettings?.quickCheckInDefaultTime ?? "08:00");
                  setQuickCheckOutTimeDraft(appSettings?.quickCheckOutDefaultTime ?? "17:00");
                  setQuickCheckInSettingsOpen(true);
                }}
                aria-label={t("attendance.page.quickTimesAria")}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>



      <Dialog open={quickCheckInSettingsOpen} onClose={() => setQuickCheckInSettingsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{t("attendance.page.quickDlgTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t("attendance.page.quickDlgHelp")}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label={t("attendance.page.checkInDefault")}
              type="time"
              value={quickCheckInTimeDraft}
              onChange={(e) => setQuickCheckInTimeDraft(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t("attendance.page.checkOutDefault")}
              type="time"
              value={quickCheckOutTimeDraft}
              onChange={(e) => setQuickCheckOutTimeDraft(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setQuickCheckInSettingsOpen(false)} color="inherit" disabled={updateQuickCheckInMutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() =>
              quickCheckInTimeDraft &&
              quickCheckOutTimeDraft &&
              updateQuickCheckInMutation.mutate({ checkIn: quickCheckInTimeDraft, checkOut: quickCheckOutTimeDraft })
            }
            variant="contained"
            disabled={updateQuickCheckInMutation.isPending || !quickCheckInTimeDraft || !quickCheckOutTimeDraft}
          >
            {t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteAttendanceConfirmOpen}
        title={t("attendance.page.deleteAttTitle")}
        description={
          currentAttendance
            ? t("attendance.page.deleteAttDesc", {
                checkIn: currentAttendance.checkIn || "—",
                checkOut: currentAttendance.checkOut || "—",
              })
            : ""
        }
        confirmLabel={t("common.delete")}
        loading={deleteAttendanceMutation.isPending}
        onCancel={() => setDeleteAttendanceConfirmOpen(false)}
        onConfirm={() => currentAttendance && deleteAttendanceMutation.mutate(currentAttendance.id)}
      />

      <OptionalLeaveFormDialog
        open={optionalLeaveDialogOpen}
        workerName={selectedWorker ? `${selectedWorker.firstName} ${selectedWorker.lastName}` : undefined}
        dateLabel={toJalaliDisplay(selectedDate)}
        existing={currentOptionalLeave}
        loading={optionalLeaveUpsertMutation.isPending}
        onClose={() => setOptionalLeaveDialogOpen(false)}
        onSubmit={(input) => optionalLeaveUpsertMutation.mutate(input)}
      />

      <ConfirmDialog
        open={deleteOptionalLeaveConfirmOpen}
        title={t("attendance.page.deleteLeaveTitle")}
        description={
          currentOptionalLeave
            ? t("attendance.page.deleteLeaveDesc", { type: t(`optionalLeave.type.${currentOptionalLeave.type}`) })
            : ""
        }
        confirmLabel={t("common.delete")}
        loading={optionalLeaveDeleteMutation.isPending}
        onCancel={() => setDeleteOptionalLeaveConfirmOpen(false)}
        onConfirm={() => currentOptionalLeave && optionalLeaveDeleteMutation.mutate(currentOptionalLeave.id)}
      />

      {selectedWorker && !lockedWorkerId && (
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <WorkerAvatar
            avatarPhotoId={selectedWorker.avatarPhotoId}
            initials={`${selectedWorker.firstName.charAt(0)}${selectedWorker.lastName.charAt(0)}`}
            size={40}
          />
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              {selectedWorker.firstName} {selectedWorker.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedWorker.position}
            </Typography>
          </Box>
        </Stack>
      )}

      {!selectedWorkerId && !lockedWorkerId && (
        <EmptyState
          icon={<EventBusyIcon fontSize="inherit" />}
          title={t("attendance.page.emptySelectTitle")}
          description={t("attendance.page.emptySelectDesc")}
        />
      )}

      {selectedWorkerId && (attendanceLoading || reportLoading) && <LoadingState />}
      {selectedWorkerId && reportError && (
        <ErrorState message={extractErrorMessage(reportErrorObj)} onRetry={() => refetchReport()} />
      )}

      {selectedWorkerId && dailyReport && !reportLoading && (
        <>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {t("attendance.page.statusHeading")}
                </Typography>
                <Stack direction="row" spacing={1}>
                  {!currentAttendance && !currentOptionalLeave && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<BoltIcon />}
                      disabled={quickCheckInMutation.isPending}
                      onClick={() => quickCheckInMutation.mutate()}
                    >
                      {t("attendance.page.quickRegister")}
                    </Button>
                  )}
                  {!currentOptionalLeave && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<LoginIcon />}
                      onClick={() => setAttendanceDialogOpen(true)}
                    >
                      {currentAttendance ? t("attendance.page.editAttendance") : t("attendance.page.recordAttendance")}
                    </Button>
                  )}
                  {currentAttendance && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteAttendanceConfirmOpen(true)}
                      aria-label={t("attendance.page.deleteAttAria")}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                  {!currentAttendance && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<EventBusyIcon />}
                      onClick={() => setOptionalLeaveDialogOpen(true)}
                    >
                      {currentOptionalLeave ? t("attendance.page.editLeave") : t("attendance.page.recordLeave")}
                    </Button>
                  )}
                  {currentOptionalLeave && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteOptionalLeaveConfirmOpen(true)}
                      aria-label={t("attendance.page.deleteLeaveAria")}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </Stack>

              {currentOptionalLeave && (
                <Chip
                  label={t(currentOptionalLeave.isPaid ? "attendance.page.leaveChipPaid" : "attendance.page.leaveChipUnpaid", {
                    type: t(`optionalLeave.type.${currentOptionalLeave.type}`),
                  })}
                  color="warning"
                  size="small"
                  sx={{ mb: 1.5 }}
                />
              )}

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={1.5}>
                <Chip
                  label={t("attendance.page.chipCheckIn", { time: dailyReport.checkIn || t("attendance.page.notRecorded") })}
                  color={dailyReport.checkIn ? "success" : "default"}
                  size="small"
                />
                <Chip
                  label={t("attendance.page.chipCheckOut", { time: dailyReport.checkOut || t("attendance.page.notRecorded") })}
                  color={dailyReport.checkOut ? "success" : "default"}
                  size="small"
                />
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {t("attendance.page.totalAttendance")}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatMinutesToText(dailyReport.totalAttendanceMinutes)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {t("attendance.page.totalTimeLoss")}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="warning.main">
                    {formatMinutesToText(dailyReport.totalTimeLossMinutes)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {t("attendance.page.breakAllowed")}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="info.main">
                    {formatMinutesToText(dailyReport.totalBreakMinutes)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {t("attendance.page.usefulTime")}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    {formatMinutesToText(dailyReport.usefulMinutes)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {t("attendance.page.payableSalary")}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                    {formatCurrency(dailyReport.payableSalary)}
                  </Typography>
                </Stack>
                {dailyReport.guardDuty.enabled && dailyReport.guardDuty.shiftsCount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {t("attendance.page.guardPay", { n: formatNumber(dailyReport.guardDuty.shiftsCount, i18n.language) })}
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#7B4FA0" }}>
                      {formatCurrency(dailyReport.guardDuty.payableSalary)}
                    </Typography>
                  </Stack>
                )}
              </Stack>
              <Typography variant="caption" color="text.disabled" display="block" mt={1}>
                {t("attendance.page.breakLegalNote")}
              </Typography>
            </CardContent>
          </Card>

          {selectedWorker?.guardDutyEnabled && (
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <SecurityIcon fontSize="small" sx={{ color: "#7B4FA0" }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      {t("attendance.page.guardHeading")}
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setEditingGuardShift(null);
                      setGuardShiftDialogOpen(true);
                    }}
                    sx={{ color: "#7B4FA0" }}
                  >
                    {t("attendance.page.guardAdd")}
                  </Button>
                </Stack>

                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  {t("attendance.page.guardHelp")}
                </Typography>

                {(!guardShifts || guardShifts.length === 0) && (
                  <Typography variant="caption" color="text.secondary">
                    {t("attendance.page.guardEmpty")}
                  </Typography>
                )}

                {guardShifts && guardShifts.length > 0 && (
                  <AnimatedList spacing={0}>
                    {guardShifts.map((shift) => (
                      <Stack
                        key={shift.id}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        py={0.75}
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {t("attendance.page.timeRange", { from: shift.startTime, to: shift.endTime })}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatMinutesToText(shift.durationMinutes)}
                            {shift.note ? ` — ${shift.note}` : ""}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Button
                            size="small"
                            onClick={() => {
                              setEditingGuardShift(shift);
                              setGuardShiftDialogOpen(true);
                            }}
                          >
                            {t("attendance.page.edit")}
                          </Button>
                          <Button size="small" color="error" onClick={() => setDeletingGuardShift(shift)}>
                            {t("common.delete")}
                          </Button>
                        </Stack>
                      </Stack>
                    ))}
                  </AnimatedList>
                )}

                {dailyReport.guardDuty.shiftsCount > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {t("attendance.page.guardTotal")}
                      </Typography>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#7B4FA0" }}>
                        {formatCurrency(dailyReport.guardDuty.payableSalary)}
                      </Typography>
                    </Stack>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <FreeBreakfastIcon fontSize="small" color="info" />
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t("attendance.page.breakAllowed")}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.75}>
                  {currentAttendance && !breakTimes?.some((bt) => bt.type === "breakfast") && (
                    <Button
                      size="small"
                      color="info"
                      variant="outlined"
                      startIcon={<BoltIcon />}
                      disabled={quickBreakMutation.isPending}
                      onClick={() => quickBreakMutation.mutate("breakfast")}
                    >
                      {t("attendance.page.quickBreakfast")}
                    </Button>
                  )}
                  {currentAttendance && !breakTimes?.some((bt) => bt.type === "lunch") && (
                    <Button
                      size="small"
                      color="info"
                      variant="outlined"
                      startIcon={<BoltIcon />}
                      disabled={quickBreakMutation.isPending}
                      onClick={() => quickBreakMutation.mutate("lunch")}
                    >
                      {t("attendance.page.quickLunch")}
                    </Button>
                  )}
                  <Button
                    size="small"
                    color="info"
                    startIcon={<AddIcon />}
                    disabled={!currentAttendance}
                    onClick={() => {
                      setBreakTimeInitialType("breakfast");
                      setBreakTimeDialogOpen(true);
                    }}
                  >
                    {t("attendance.page.breakRegister")}
                  </Button>
                </Stack>
              </Stack>

              {!currentAttendance && (
                <Typography variant="caption" color="text.secondary">
                  {t("attendance.page.needCheckIn")}
                </Typography>
              )}
              {currentAttendance && (!breakTimes || breakTimes.length === 0) && (
                <Typography variant="caption" color="text.secondary">
                  {t("attendance.page.breakEmpty")}
                </Typography>
              )}
              {breakTimes && breakTimes.length > 0 && (
                <AnimatedList spacing={0}>
                  {breakTimes.map((bt) => (
                    <Stack
                      key={bt.id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      py={0.75}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {t("attendance.page.breakItem", {
                            type: t(BREAK_TYPE_LABEL_KEYS[bt.type]),
                            from: bt.startTime,
                            to: bt.endTime,
                          })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatMinutesToText(bt.durationMinutes)}
                        </Typography>
                      </Box>
                      <Button size="small" color="error" onClick={() => setDeletingBreakTimeId(bt.id)}>
                        {t("common.delete")}
                      </Button>
                    </Stack>
                  ))}
                </AnimatedList>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {t("attendance.page.timeLossHeading")}
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  disabled={!currentAttendance}
                  onClick={() => {
                    setEditingTimeLoss(null);
                    setTimeLossDialogOpen(true);
                  }}
                >
                  {t("attendance.page.timeLossAdd")}
                </Button>
              </Stack>

              {!currentAttendance && (
                <Typography variant="caption" color="text.secondary">
                  {t("attendance.page.needCheckIn")}
                </Typography>
              )}

              {currentAttendance && (!timeLosses || timeLosses.length === 0) && (
                <Typography variant="caption" color="text.secondary">
                  {t("attendance.page.timeLossEmpty")}
                </Typography>
              )}

              {timeLosses && timeLosses.length > 0 && (
                <AnimatedList spacing={0}>
                  {timeLosses.map((tl) => (
                    <TimeLossItem
                      key={tl.id}
                      timeLoss={tl}
                      onEdit={(t) => {
                        setEditingTimeLoss(t);
                        setTimeLossDialogOpen(true);
                      }}
                      onDelete={setDeletingTimeLoss}
                    />
                  ))}
                </AnimatedList>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={0.75} mb={1}>
                <PhotoLibraryIcon fontSize="small" color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  {t("attendance.page.galleryHeading")}
                </Typography>
              </Stack>
              {currentAttendance ? (
                <PhotoGallery
                  relatedType="attendance"
                  relatedId={currentAttendance.id}
                  compact
                  emptyTitle={t("attendance.page.galleryEmptyTitle")}
                  emptyDescription={t("attendance.page.galleryEmptyDesc")}
                />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {t("attendance.page.needCheckIn")}
                </Typography>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AttendanceFormDialog
        open={attendanceDialogOpen}
        worker={selectedWorker}
        date={selectedDate}
        existingAttendance={currentAttendance}
        loading={upsertAttendanceMutation.isPending}
        onClose={() => setAttendanceDialogOpen(false)}
        onSubmit={(input) => upsertAttendanceMutation.mutate(input)}
      />

      <TimeLossFormDialog
        open={timeLossDialogOpen}
        workerName={selectedWorker ? `${selectedWorker.firstName} ${selectedWorker.lastName}` : undefined}
        editingTimeLoss={editingTimeLoss}
        loading={createTimeLossMutation.isPending || updateTimeLossMutation.isPending}
        onClose={() => {
          setTimeLossDialogOpen(false);
          setEditingTimeLoss(null);
        }}
        onSubmit={handleTimeLossSubmit}
      />

      <BreakTimeFormDialog
        open={breakTimeDialogOpen}
        workerId={selectedWorkerId}
        workerName={selectedWorker ? `${selectedWorker.firstName} ${selectedWorker.lastName}` : undefined}
        loading={createBreakTimeMutation.isPending}
        initialType={breakTimeInitialType}
        onClose={() => setBreakTimeDialogOpen(false)}
        onSubmit={(input) => createBreakTimeMutation.mutate(input)}
      />

      <GuardShiftFormDialog
        open={guardShiftDialogOpen}
        workerName={selectedWorker ? `${selectedWorker.firstName} ${selectedWorker.lastName}` : undefined}
        editingShift={editingGuardShift}
        previousShift={
          previousGuardShift ? { startTime: previousGuardShift.startTime, endTime: previousGuardShift.endTime } : undefined
        }
        loading={createGuardShiftMutation.isPending || updateGuardShiftMutation.isPending}
        onClose={() => {
          setGuardShiftDialogOpen(false);
          setEditingGuardShift(null);
        }}
        onSubmit={handleGuardShiftSubmit}
      />

      <ConfirmDialog
        open={!!deletingGuardShift}
        title={t("attendance.page.deleteGuardTitle")}
        description={
          deletingGuardShift
            ? t("attendance.page.deleteGuardDesc", {
                from: deletingGuardShift.startTime,
                to: deletingGuardShift.endTime,
              })
            : ""
        }
        confirmLabel={t("common.delete")}
        loading={deleteGuardShiftMutation.isPending}
        onConfirm={() => deletingGuardShift && deleteGuardShiftMutation.mutate(deletingGuardShift.id)}
        onCancel={() => setDeletingGuardShift(null)}
      />

      <ConfirmDialog
        open={!!deletingTimeLoss}
        title={t("attendance.page.deleteTimeLossTitle")}
        description={
          deletingTimeLoss ? t("attendance.page.deleteTimeLossDesc", { reason: deletingTimeLoss.reason }) : ""
        }
        confirmLabel={t("common.delete")}
        loading={deleteTimeLossMutation.isPending}
        onConfirm={() => deletingTimeLoss && deleteTimeLossMutation.mutate(deletingTimeLoss.id)}
        onCancel={() => setDeletingTimeLoss(null)}
      />

      <ConfirmDialog
        open={!!deletingBreakTimeId}
        title={t("attendance.page.deleteBreakTitle")}
        description={t("attendance.page.deleteBreakDesc")}
        confirmLabel={t("common.delete")}
        loading={deleteBreakTimeMutation.isPending}
        onConfirm={() => deletingBreakTimeId && deleteBreakTimeMutation.mutate(deletingBreakTimeId)}
        onCancel={() => setDeletingBreakTimeId(null)}
      />
    </Box>
  );
}
