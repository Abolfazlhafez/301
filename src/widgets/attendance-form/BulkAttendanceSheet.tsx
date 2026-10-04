import { MouseEvent, TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CloseIcon from "@mui/icons-material/Close";
import GroupsIcon from "@mui/icons-material/Groups";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { attendanceApi } from "../../shared/api/attendanceApi";
import { settingsApi } from "../../shared/api/settingsApi";
import { workersApi } from "../../shared/api/workersApi";
import { workerGroupApi } from "../../shared/api/workerGroupApi";
import { projectsApi } from "../../shared/api/projectsApi";
import { extractErrorMessage } from "../../shared/api/client";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";
import { useToast } from "../../shared/components/ToastProvider";
import { WorkerAvatar } from "../worker-form/WorkerAvatar";
import { getTodayIso, toJalaliWithWeekday } from "../../shared/utils/jalaliDate";
import { formatNumber } from "../../shared/utils/format";
import { getBulkRowStatus, isBulkDuplicate, type BulkRowStatus } from "../../core/utils/bulkAttendanceRules";
import { isValidTimeFormat } from "../../core/payroll";
import {
  MAX_ATTENDANCE_TIME_TEMPLATES,
  type AppSettings,
  type AttendanceTimeTemplate,
} from "../../entities/AppSettings";
import type { Attendance, BulkAttendanceMode, BulkAttendanceRejectReason } from "../../entities/Attendance";
import type { Worker } from "../../entities/Worker";

/** کلید چیپ فعال: own = ساعت خود نیرو، quick = ساعت سریع تنظیمات، custom = دستی، tpl:<id> = قالب. */
type ChipKey = string;

const LONG_PRESS_MS = 500;

interface TimePair {
  checkIn: string;
  checkOut: string;
}

function initialFromSettings(settings: AppSettings | undefined): { chip: ChipKey; times: TimePair } {
  const last = settings?.attendanceTimeTemplates.find((t) => t.id === settings.lastAttendanceTemplateId);
  if (last) return { chip: `tpl:${last.id}`, times: { checkIn: last.checkIn, checkOut: last.checkOut } };
  return {
    chip: "own",
    times: {
      checkIn: settings?.quickCheckInDefaultTime ?? "",
      checkOut: settings?.quickCheckOutDefaultTime ?? "",
    },
  };
}

export interface BulkAttendanceSheetProps {
  open: boolean;
  onClose: () => void;
  /** تاریخ اولیه (پیش‌فرض: امروز). */
  initialDate?: string;
  /** نیروهایی که هنگام باز شدن از قبل انتخاب شده‌اند (مثلاً «ثبت‌نشده‌های امروز»). */
  preselectWorkerIds?: string[];
  /** فقط برای تست SSR: Drawer بدون Portal رندر می‌شود. */
  disablePortal?: boolean;
}

/**
 * «حضور گروهی»: Bottom Sheet ثبت سریع حضور/غیاب چند نیرو با هم.
 * محتوای داخلی فقط وقتی باز است mount می‌شود، پس هر بار باز شدن stateِ تازه دارد.
 */
export function BulkAttendanceSheet({ open, onClose, initialDate, preselectWorkerIds, disablePortal }: BulkAttendanceSheetProps) {
  // محتوا باید تا پایان انیمیشن بسته‌شدن mount بماند (وگرنه شیت خالی پایین می‌رود) و هر بار باز شدن
  // stateِ تازه بگیرد (key).
  const [visible, setVisible] = useState(open);
  const [instance, setInstance] = useState(0);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open) {
      setVisible(true);
      if (!wasOpen.current) setInstance((i) => i + 1);
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      ModalProps={{ disablePortal: !!disablePortal }}
      SlideProps={{ onExited: () => setVisible(false) }}
      PaperProps={{
        sx: (theme) => ({
          borderRadius: "24px 24px 0 0",
          maxHeight: "85vh",
          "@supports (height: 100dvh)": { maxHeight: "85dvh" },
          display: "flex",
          flexDirection: "column",
          backgroundImage: "none",
          bgcolor: theme.palette.background.paper,
        }),
      }}
    >
      {(open || visible) && (
        <SheetBody
          key={instance}
          onClose={onClose}
          initialDate={initialDate ?? getTodayIso()}
          preselectWorkerIds={preselectWorkerIds ?? []}
        />
      )}
    </Drawer>
  );
}

interface SheetBodyProps {
  onClose: () => void;
  initialDate: string;
  preselectWorkerIds: string[];
}

const SWIPE_CLOSE_PX = 70;

function SheetBody({ onClose, initialDate, preselectWorkerIds }: SheetBodyProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [date, setDate] = useState(initialDate);
  const [mode, setMode] = useState<BulkAttendanceMode>("both");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselectWorkerIds));
  const [overrides, setOverrides] = useState<Map<string, Partial<TimePair>>>(() => new Map());
  const [dateDialogOpen, setDateDialogOpen] = useState(false);

  // کشیدن دستگیره/سربرگ به پایین ⇒ بستن (فقط روی ناحیهٔ بالای شیت؛ اسکرول فهرست درگیر نمی‌شود).
  const swipeStartY = useRef<number | null>(null);
  const swipeHandlers = {
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      swipeStartY.current = e.touches[0]?.clientY ?? null;
    },
    onTouchEnd: (e: TouchEvent<HTMLElement>) => {
      const start = swipeStartY.current;
      swipeStartY.current = null;
      const end = e.changedTouches[0]?.clientY;
      if (start !== null && end !== undefined && end - start > SWIPE_CLOSE_PX) onClose();
    },
  };

  // --- داده‌ها (کلیدها عمداً همان کلیدهای TeamHub/AttendancePage‌اند تا کش مشترک بماند) ---
  const { data: activeProjectId } = useQuery({
    queryKey: ["projects", "active"],
    queryFn: () => projectsApi.getActiveProjectId(),
  });
  const { data: workers } = useQuery({
    queryKey: ["workers", activeProjectId],
    queryFn: () => workersApi.list({ projectId: activeProjectId }),
    enabled: !!activeProjectId,
  });
  const { data: attendances } = useQuery({
    queryKey: ["attendances", "by-date", date],
    queryFn: () => attendanceApi.list({ date }),
  });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => settingsApi.get() });
  const { data: groups } = useQuery({ queryKey: ["worker-groups"], queryFn: () => workerGroupApi.list() });

  // --- چیپ ساعت فعال + مقدار فیلدهای ساعت ---
  const init = useMemo(() => initialFromSettings(settings), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [chip, setChip] = useState<ChipKey>(init.chip);
  const [times, setTimes] = useState<TimePair>(init.times);
  // اگر تنظیمات دیرتر از mount رسید (دستگاه واقعی)، یک‌بار مقدار اولیه را از آن بگیر.
  const settingsApplied = useRef(!!settings);
  useEffect(() => {
    if (settingsApplied.current || !settings) return;
    settingsApplied.current = true;
    const next = initialFromSettings(settings);
    setChip(next.chip);
    setTimes(next.times);
  }, [settings]);

  const templates = settings?.attendanceTimeTemplates ?? [];

  const fmtTime = (time: string) => time.replace(/\d/g, (d) => formatNumber(Number(d), lang));
  const fmtRange = (tp: TimePair) =>
    t("attendance.bulk.chips.timeRange", { checkIn: fmtTime(tp.checkIn), checkOut: fmtTime(tp.checkOut) });

  const needIn = mode !== "out";
  const needOut = mode !== "in";

  // --- ردیف‌ها ---
  const activeWorkers = useMemo(() => (workers ?? []).filter((w) => w.isActive), [workers]);
  const attByWorker = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const a of attendances ?? []) map.set(a.workerId, a);
    return map;
  }, [attendances]);

  interface Row {
    worker: Worker;
    status: BulkRowStatus;
    duplicate: boolean;
    checkIn: string | null;
    checkOut: string | null;
    missingTime: boolean;
    noCheckIn: boolean;
    blocked: boolean;
    selected: boolean;
    overridden: boolean;
  }

  const rows: Row[] = useMemo(() => {
    return activeWorkers.map((worker) => {
      const att = attByWorker.get(worker.id) ?? null;
      const ov = overrides.get(worker.id);
      const base: { checkIn: string | null; checkOut: string | null } =
        chip === "own"
          ? { checkIn: worker.defaultCheckIn ?? null, checkOut: worker.defaultCheckOut ?? null }
          : { checkIn: times.checkIn || null, checkOut: times.checkOut || null };
      const checkIn = ov?.checkIn ?? base.checkIn;
      const checkOut = ov?.checkOut ?? base.checkOut;
      const missingTime =
        (needIn && !(checkIn && isValidTimeFormat(checkIn))) || (needOut && !(checkOut && isValidTimeFormat(checkOut)));
      const noCheckIn = mode === "out" && !att?.checkIn;
      return {
        worker,
        status: getBulkRowStatus(att),
        duplicate: isBulkDuplicate(att, mode),
        checkIn,
        checkOut,
        missingTime,
        noCheckIn,
        blocked: missingTime || noCheckIn,
        selected: selected.has(worker.id),
        overridden: !!ov,
      };
    });
  }, [activeWorkers, attByWorker, overrides, chip, times, mode, needIn, needOut, selected]);

  const registrable = rows.filter((r) => r.selected && !r.blocked);
  const registrableCount = registrable.length;
  const blockedSelectedCount = rows.filter((r) => r.selected && r.blocked).length;

  // --- انتخاب ---
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  // «همه» و «اکیپ…» همهٔ نیروهای محدوده را انتخاب می‌کنند (رکورد ثبت‌شده‌ها هم، با برچسب «جایگزین
  // می‌شود»؛ واگرد در دسترس است). «فقط ثبت‌نشده‌ها» رکوردهای تکراری را کنار می‌گذارد؛ نیروی بدون ساعت
  // هم انتخاب می‌شود تا هشدارش دیده شود، ولی در شمارندهٔ ثبت نمی‌آید.
  const selectAll = () => setSelected(new Set(rows.map((r) => r.worker.id)));
  const selectNone = () => setSelected(new Set());
  const selectUnregistered = () => setSelected(new Set(rows.filter((r) => !r.duplicate).map((r) => r.worker.id)));

  const [groupAnchor, setGroupAnchor] = useState<HTMLElement | null>(null);
  const activeGroups = (groups ?? []).filter((g) => g.isActive);
  function selectGroup(memberIds: string[]) {
    const ids = new Set(memberIds);
    setSelected(new Set(rows.filter((r) => ids.has(r.worker.id)).map((r) => r.worker.id)));
    setGroupAnchor(null);
  }

  function changeDate(next: string) {
    setDate(next);
    setSelected(new Set()); // وضعیت «تکراری» با تاریخ عوض می‌شود؛ انتخاب قبلی معتبر نیست.
  }

  // --- چیپ‌های ساعت ---
  function pickOwn() {
    setChip("own");
  }
  function pickQuick() {
    setChip("quick");
    setTimes({
      checkIn: settings?.quickCheckInDefaultTime ?? "",
      checkOut: settings?.quickCheckOutDefaultTime ?? "",
    });
  }
  function pickTemplate(tpl: AttendanceTimeTemplate) {
    setChip(`tpl:${tpl.id}`);
    setTimes({ checkIn: tpl.checkIn, checkOut: tpl.checkOut });
  }

  // --- نگه‌داشتن روی قالب ⇒ منوی ویرایش/حذف ---
  const [tplMenu, setTplMenu] = useState<{ anchor: HTMLElement; tpl: AttendanceTimeTemplate } | null>(null);
  const press = useRef<{ timer: number | null; fired: boolean }>({ timer: null, fired: false });
  function pressStart(e: TouchEvent<HTMLElement>, tpl: AttendanceTimeTemplate) {
    const anchor = e.currentTarget;
    press.current.fired = false;
    press.current.timer = window.setTimeout(() => {
      press.current.fired = true;
      setTplMenu({ anchor, tpl });
    }, LONG_PRESS_MS);
  }
  function pressCancel() {
    if (press.current.timer !== null) window.clearTimeout(press.current.timer);
    press.current.timer = null;
  }
  function tplClick(tpl: AttendanceTimeTemplate) {
    if (press.current.fired) {
      press.current.fired = false;
      return;
    }
    pickTemplate(tpl);
  }
  function tplContextMenu(e: MouseEvent<HTMLElement>, tpl: AttendanceTimeTemplate) {
    e.preventDefault();
    pressCancel();
    press.current.fired = true;
    setTplMenu({ anchor: e.currentTarget, tpl });
  }

  // --- دیالوگ ایجاد/ویرایش قالب ---
  const [tplDialog, setTplDialog] = useState<
    { kind: "create" } | { kind: "edit"; tpl: AttendanceTimeTemplate } | null
  >(null);
  const [deletingTpl, setDeletingTpl] = useState<AttendanceTimeTemplate | null>(null);

  const saveTemplateMutation = useMutation({
    mutationFn: async (input: { id: string | null; name: string; checkIn: string; checkOut: string }) =>
      input.id
        ? settingsApi.updateAttendanceTemplate(input.id, input)
        : settingsApi.createAttendanceTemplate(input),
    onSuccess: (saved, input) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setTplDialog(null);
      showToast(t(input.id ? "attendance.bulk.template.toastUpdated" : "attendance.bulk.template.toastSaved"), "success");
      if (!input.id || chip === `tpl:${saved.id}`) pickTemplate(saved);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deleteAttendanceTemplate(id),
    onSuccess: (_r, id) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setDeletingTpl(null);
      if (chip === `tpl:${id}`) setChip("custom");
      showToast(t("attendance.bulk.template.toastDeleted"), "success");
    },
    onError: (err) => {
      setDeletingTpl(null);
      showToast(extractErrorMessage(err), "error");
    },
  });

  function openCreateTemplate() {
    if (templates.length >= MAX_ATTENDANCE_TIME_TEMPLATES) {
      showToast(t("attendance.bulk.template.maxReached", { n: formatNumber(MAX_ATTENDANCE_TIME_TEMPLATES, lang) }), "info");
      return;
    }
    setTplDialog({ kind: "create" });
  }

  // --- ساعت اختصاصی هر نفر (فقط در همین نشست) ---
  const [overrideWorker, setOverrideWorker] = useState<Row | null>(null);

  // --- ثبت ---
  const submitMutation = useMutation({
    mutationFn: async () => {
      const entries = registrable.map((r) => ({
        workerId: r.worker.id,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
      }));
      const replaceWorkerIds = registrable.filter((r) => r.duplicate).map((r) => r.worker.id);
      const result = await attendanceApi.bulkUpsert(entries, { mode, date, replaceWorkerIds });
      return result;
    },
    onSuccess: async (result) => {
      for (const key of ["attendances", "attendance", "daily-report", "monthly-payroll-summary", "dashboard-summary"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      if (chip.startsWith("tpl:")) {
        // شکست ذخیرهٔ «آخرین قالب» نباید ثبت موفق حضور را خراب کند.
        settingsApi
          .setLastAttendanceTemplateId(chip.slice(4))
          .then(() => queryClient.invalidateQueries({ queryKey: ["settings"] }))
          .catch(() => {});
      }

      const savedCount = result.saved.length;
      const rejectedCount = result.rejected.length;
      const reasons = Array.from(new Set(result.rejected.map((r) => r.reason as BulkAttendanceRejectReason)))
        .map((reason) => t(`attendance.bulk.reject.${reason}`))
        .join(t("attendance.bulk.listSeparator"));

      if (savedCount === 0) {
        showToast(t("attendance.bulk.toast.nothingSaved", { reasons }), "warning");
        return;
      }
      const parts = [t("attendance.bulk.toast.saved", { n: formatNumber(savedCount, lang) })];
      if (rejectedCount > 0) {
        parts.push(t("attendance.bulk.toast.rejected", { n: formatNumber(rejectedCount, lang), reasons }));
      }
      onClose();
      showToast(parts.join(t("attendance.bulk.listSeparator")), rejectedCount > 0 ? "info" : "success", {
        label: t("attendance.bulk.toast.undo"),
        onClick: () => {
          attendanceApi
            .undoBulk(result.saved)
            .then((n) => {
              for (const key of ["attendances", "attendance", "daily-report", "monthly-payroll-summary", "dashboard-summary"]) {
                queryClient.invalidateQueries({ queryKey: [key] });
              }
              showToast(t("attendance.bulk.toast.undone", { n: formatNumber(n, lang) }), "info");
            })
            .catch((err) => showToast(extractErrorMessage(err), "error"));
        },
      });
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const statusLabel: Record<BulkRowStatus, string> = {
    present: t("attendance.bulk.status.present"),
    inOnly: t("attendance.bulk.status.inOnly"),
    none: t("attendance.bulk.status.none"),
  };
  const statusTone: Record<BulkRowStatus, "success" | "warning" | "default"> = {
    present: "success",
    inOnly: "warning",
    none: "default",
  };

  function timeSummary(r: Row): string {
    if (mode === "both" && r.checkIn && r.checkOut) return fmtRange({ checkIn: r.checkIn, checkOut: r.checkOut });
    if (mode === "in" && r.checkIn) return `${t("attendance.bulk.checkInLabel")} ${fmtTime(r.checkIn)}`;
    if (mode === "out" && r.checkOut) return `${t("attendance.bulk.checkOutLabel")} ${fmtTime(r.checkOut)}`;
    return "";
  }

  return (
    <>
      {/* دستگیره + الف) سربرگ: کشیدن به پایین می‌بندد */}
      <Box {...swipeHandlers} sx={{ flexShrink: 0, touchAction: "pan-x" }}>
      <Box sx={{ display: "flex", justifyContent: "center", pt: 1.25, pb: 0.5 }}>
        <Box sx={(theme) => ({ width: 40, height: 4, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.22) })} />
      </Box>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pt: 0.5, pb: 1 }}>
        <Typography variant="h6" fontWeight={800} noWrap sx={{ flex: 1, minWidth: 0 }}>
          {t("attendance.bulk.title")}
        </Typography>
        <Chip
          icon={<CalendarMonthOutlinedIcon />}
          label={toJalaliWithWeekday(date)}
          onClick={() => setDateDialogOpen(true)}
          aria-label={t("attendance.bulk.dateChipAria") as string}
          color="primary"
          variant="outlined"
          sx={{ height: 36, borderRadius: "18px", fontWeight: 700 }}
        />
        <IconButton onClick={onClose} aria-label={t("attendance.bulk.close") as string} edge="end">
          <CloseIcon />
        </IconButton>
      </Stack>
      </Box>

      {/* بدنهٔ قابل اسکرول */}
      <Stack spacing={1.5} sx={{ px: 2, pb: 1, flexShrink: 0 }}>
          {/* ب) سوییچ سه‌حالته */}
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={mode}
            onChange={(_e, v: BulkAttendanceMode | null) => v && setMode(v)}
            aria-label={t("attendance.bulk.modeAria") as string}
          >
            <ToggleButton value="in" sx={{ minHeight: 44, fontWeight: 700 }}>
              {t("attendance.bulk.mode.in")}
            </ToggleButton>
            <ToggleButton value="out" sx={{ minHeight: 44, fontWeight: 700 }}>
              {t("attendance.bulk.mode.out")}
            </ToggleButton>
            <ToggleButton value="both" sx={{ minHeight: 44, fontWeight: 700 }}>
              {t("attendance.bulk.mode.both")}
            </ToggleButton>
          </ToggleButtonGroup>

          {/* ج) فیلدهای ساعت (با «ساعت خود نیرو» به‌جای فیلدهای غیرفعالِ خالی، توضیح کوتاه) */}
          {chip === "own" ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={(theme) => ({
                px: 1.5,
                py: 1.25,
                borderRadius: "14px",
                bgcolor: alpha(theme.palette.primary.main, 0.06),
              })}
            >
              {t("attendance.bulk.ownTimesHint")}
            </Typography>
          ) : (
          <Stack direction="row" spacing={1}>
            {needIn && (
              <TextField
                fullWidth
                size="small"
                type="time"
                label={t("attendance.bulk.checkInLabel")}
                value={times.checkIn}
                onChange={(e) => {
                  setTimes((prev) => ({ ...prev, checkIn: e.target.value }));
                  setChip("custom");
                }}
                InputLabelProps={{ shrink: true }}
              />
            )}
            {needOut && (
              <TextField
                fullWidth
                size="small"
                type="time"
                label={t("attendance.bulk.checkOutLabel")}
                value={times.checkOut}
                disabled={chip === "own"}
                onChange={(e) => {
                  setTimes((prev) => ({ ...prev, checkOut: e.target.value }));
                  setChip("custom");
                }}
                InputLabelProps={{ shrink: true }}
              />
            )}
          </Stack>
          )}

          {/* د) چیپ‌های ساعت پیش‌فرض (اسکرول افقی بدون فلش) */}
          <Box
            sx={{
              display: "flex",
              gap: 1,
              overflowX: "auto",
              pb: 0.5,
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            <Chip
              label={t("attendance.bulk.chips.own")}
              onClick={pickOwn}
              color={chip === "own" ? "primary" : "default"}
              variant={chip === "own" ? "filled" : "outlined"}
              sx={{ flexShrink: 0, height: 36, borderRadius: "18px" }}
            />
            {settings && (
              <Chip
                label={`${t("attendance.bulk.chips.quick")} ${fmtRange({
                  checkIn: settings.quickCheckInDefaultTime,
                  checkOut: settings.quickCheckOutDefaultTime,
                })}`}
                onClick={pickQuick}
                color={chip === "quick" ? "primary" : "default"}
                variant={chip === "quick" ? "filled" : "outlined"}
                sx={{ flexShrink: 0, height: 36, borderRadius: "18px" }}
              />
            )}
            {templates.map((tpl) => {
              const active = chip === `tpl:${tpl.id}`;
              return (
                <Chip
                  key={tpl.id}
                  label={`${tpl.name} ${fmtRange(tpl)}`}
                  onClick={() => tplClick(tpl)}
                  onMouseDown={() => {
                    press.current.fired = false; // کلیک چپ بعد از منوی راست‌کلیک نباید بلعیده شود
                  }}
                  onTouchStart={(e) => pressStart(e, tpl)}
                  onTouchEnd={pressCancel}
                  onTouchMove={pressCancel}
                  onTouchCancel={pressCancel}
                  onContextMenu={(e) => tplContextMenu(e, tpl)}
                  color={active ? "primary" : "default"}
                  variant={active ? "filled" : "outlined"}
                  sx={{ flexShrink: 0, height: 36, borderRadius: "18px" }}
                />
              );
            })}
            <Chip
              icon={<AddIcon />}
              label={t("attendance.bulk.chips.add")}
              aria-label={t("attendance.bulk.chips.addAria") as string}
              onClick={openCreateTemplate}
              disabled={chip === "own"}
              variant="outlined"
              color="primary"
              sx={{ flexShrink: 0, height: 36, borderRadius: "18px" }}
            />
          </Box>
          {templates.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {t("attendance.bulk.chips.templateHint")}
            </Typography>
          )}

      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2, pb: 1 }}>
        <Stack spacing={0.5}>
          {/* ه) میان‌برها + فهرست نیروها */}
          <Box
            sx={(theme) => ({
              display: "flex",
              gap: 1,
              overflowX: "auto",
              position: "sticky",
              top: 0,
              zIndex: 1,
              py: 0.75,
              bgcolor: theme.palette.background.paper,
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            })}
          >
            <Chip sx={{ height: 34, borderRadius: "17px", flexShrink: 0 }} label={t("attendance.bulk.shortcuts.all")} onClick={selectAll} variant="outlined" />
            <Chip sx={{ height: 34, borderRadius: "17px", flexShrink: 0 }} label={t("attendance.bulk.shortcuts.none")} onClick={selectNone} variant="outlined" />
            <Chip
              sx={{ height: 34, borderRadius: "17px", flexShrink: 0 }}
              label={t("attendance.bulk.shortcuts.unregistered")}
              onClick={selectUnregistered}
              variant="outlined"
            />
            <Chip
              sx={{ height: 34, borderRadius: "17px", flexShrink: 0 }}
              icon={<GroupsIcon />}
              label={t("attendance.bulk.shortcuts.group")}
              aria-label={t("attendance.bulk.shortcuts.groupMenuAria") as string}
              onClick={(e) => setGroupAnchor(e.currentTarget)}
              variant="outlined"
            />
          </Box>

          {rows.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              {t("attendance.bulk.emptyWorkers")}
            </Typography>
          )}

          <Stack spacing={0.5}>
            {rows.map((r) => {
              const name = `${r.worker.firstName} ${r.worker.lastName}`;
              const summary = timeSummary(r);
              const warning = r.noCheckIn
                ? t("attendance.bulk.noCheckIn")
                : r.missingTime
                  ? t(chip === "own" && !r.overridden ? "attendance.bulk.noDefault" : "attendance.bulk.noTime")
                  : "";
              return (
                <Box
                  key={r.worker.id}
                  sx={(theme) => ({
                    borderRadius: "16px",
                    opacity: r.duplicate && !r.selected ? 0.55 : 1,
                    bgcolor: r.selected ? alpha(theme.palette.primary.main, 0.08) : "transparent",
                    transition: "background-color 150ms ease-out, opacity 150ms ease-out",
                  })}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minHeight: 56, pe: 1 }}>
                    <Checkbox
                      checked={r.selected}
                      onChange={() => toggle(r.worker.id)}
                      inputProps={{ "aria-label": t("attendance.bulk.selectionRowAria", { name }) as string }}
                    />
                    <ButtonBase
                      onClick={() => toggle(r.worker.id)}
                      sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0, textAlign: "start", py: 0.75 }}
                    >
                      <WorkerAvatar
                        avatarPhotoId={r.worker.avatarPhotoId}
                        initials={`${r.worker.firstName.charAt(0)}${r.worker.lastName.charAt(0)}`}
                        size={36}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {r.worker.position}
                        </Typography>
                      </Box>
                    </ButtonBase>
                    <Chip
                      size="small"
                      label={statusLabel[r.status]}
                      color={statusTone[r.status]}
                      variant={r.status === "none" ? "outlined" : "filled"}
                      sx={{ height: 24, fontSize: "0.72rem", flexShrink: 0 }}
                    />
                  </Box>
                  {r.selected && (
                    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, ps: "54px", pe: 1.5, pb: 1 }}>
                      <ButtonBase
                        onClick={() => setOverrideWorker(r)}
                        aria-label={t("attendance.bulk.override.aria", { name }) as string}
                        sx={(theme) => ({
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          minHeight: 36,
                          px: 1.25,
                          borderRadius: "12px",
                          color: warning ? theme.palette.warning.main : theme.palette.primary.main,
                          bgcolor: alpha(warning ? theme.palette.warning.main : theme.palette.primary.main, 0.1),
                          fontWeight: 700,
                          fontSize: "0.78rem",
                        })}
                      >
                        {warning ? <WarningAmberRoundedIcon sx={{ fontSize: 16 }} /> : <AccessTimeIcon sx={{ fontSize: 16 }} />}
                        <span>{warning || summary}</span>
                      </ButtonBase>
                      {r.duplicate && (
                        <Typography variant="caption" color="warning.main" fontWeight={700}>
                          {t("attendance.bulk.replaces")}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </Box>

      {/* و) دکمهٔ ثابت پایین (داخل safe-area) */}
      <Box
        sx={(theme) => ({
          px: 2,
          pt: 1.25,
          pb: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          borderTop: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
        })}
      >
        {blockedSelectedCount > 0 && (
          <Typography variant="caption" color="warning.main" fontWeight={700} component="div" sx={{ pb: 0.75, textAlign: "center" }}>
            {t("attendance.bulk.blockedNote", { n: formatNumber(blockedSelectedCount, lang) })}
          </Typography>
        )}
        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={registrableCount === 0 || submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
          sx={{ minHeight: 52, borderRadius: "16px", fontWeight: 800 }}
        >
          {submitMutation.isPending
            ? t("attendance.bulk.submitting")
            : t("attendance.bulk.submit", { n: formatNumber(registrableCount, lang) })}
        </Button>
      </Box>

      {/* منوی انتخاب اکیپ */}
      <Menu anchorEl={groupAnchor} open={!!groupAnchor} onClose={() => setGroupAnchor(null)}>
        {activeGroups.length === 0 && <MenuItem disabled>{t("attendance.bulk.shortcuts.groupEmpty")}</MenuItem>}
        {activeGroups.map((g) => (
          <MenuItem key={g.id} onClick={() => selectGroup(g.memberWorkerIds)} sx={{ minHeight: 48 }}>
            {g.name}
          </MenuItem>
        ))}
      </Menu>

      {/* منوی ویرایش/حذف قالب (نگه‌داشتن روی چیپ) */}
      <Menu anchorEl={tplMenu?.anchor ?? null} open={!!tplMenu} onClose={() => setTplMenu(null)}>
        <MenuItem
          sx={{ minHeight: 48 }}
          onClick={() => {
            if (tplMenu) setTplDialog({ kind: "edit", tpl: tplMenu.tpl });
            setTplMenu(null);
          }}
        >
          {t("attendance.bulk.template.menuEdit")}
        </MenuItem>
        <MenuItem
          sx={{ minHeight: 48 }}
          onClick={() => {
            if (tplMenu) setDeletingTpl(tplMenu.tpl);
            setTplMenu(null);
          }}
        >
          {t("attendance.bulk.template.menuDelete")}
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={!!deletingTpl}
        title={t("attendance.bulk.template.deleteTitle")}
        description={t("attendance.bulk.template.deleteDescription", { name: deletingTpl?.name ?? "" })}
        confirmLabel={t("attendance.bulk.template.menuDelete")}
        loading={deleteTemplateMutation.isPending}
        onConfirm={() => deletingTpl && deleteTemplateMutation.mutate(deletingTpl.id)}
        onCancel={() => setDeletingTpl(null)}
      />

      <TemplateDialog
        state={tplDialog}
        currentTimes={times}
        saving={saveTemplateMutation.isPending}
        onClose={() => setTplDialog(null)}
        onSave={(v) => saveTemplateMutation.mutate(v)}
      />

      <OverrideDialog
        row={overrideWorker}
        mode={mode}
        hasOverride={!!(overrideWorker && overrides.has(overrideWorker.worker.id))}
        onClose={() => setOverrideWorker(null)}
        onApply={(workerId, value) => {
          setOverrides((prev) => new Map(prev).set(workerId, value));
          setOverrideWorker(null);
        }}
        onReset={(workerId) => {
          setOverrides((prev) => {
            const next = new Map(prev);
            next.delete(workerId);
            return next;
          });
          setOverrideWorker(null);
        }}
      />

      <Dialog open={dateDialogOpen} onClose={() => setDateDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("attendance.bulk.dateDialogTitle")}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <JalaliDatePicker value={date} onChange={changeDate} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDateDialogOpen(false)}>{t("common.confirm")}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ───────────────────────── دیالوگ ایجاد/ویرایش قالب ─────────────────────────

interface TemplateDialogProps {
  state: { kind: "create" } | { kind: "edit"; tpl: AttendanceTimeTemplate } | null;
  currentTimes: TimePair;
  saving: boolean;
  onClose: () => void;
  onSave: (v: { id: string | null; name: string; checkIn: string; checkOut: string }) => void;
}

function TemplateDialog({ state, currentTimes, saving, onClose, onSave }: TemplateDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  useEffect(() => {
    if (!state) return;
    if (state.kind === "edit") {
      setName(state.tpl.name);
      setCheckIn(state.tpl.checkIn);
      setCheckOut(state.tpl.checkOut);
    } else {
      setName("");
      setCheckIn(currentTimes.checkIn);
      setCheckOut(currentTimes.checkOut);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = name.trim().length > 0 && isValidTimeFormat(checkIn) && isValidTimeFormat(checkOut);

  return (
    <Dialog open={!!state} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {t(state?.kind === "edit" ? "attendance.bulk.template.editTitle" : "attendance.bulk.template.saveTitle")}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label={t("attendance.bulk.template.nameLabel")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              type="time"
              label={t("attendance.bulk.checkInLabel")}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              type="time"
              label={t("attendance.bulk.checkOutLabel")}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          variant="contained"
          disabled={!valid || saving}
          onClick={() =>
            onSave({ id: state?.kind === "edit" ? state.tpl.id : null, name: name.trim(), checkIn, checkOut })
          }
        >
          {t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ───────────────────────── دیالوگ ساعت اختصاصی یک نفر ─────────────────────────

interface OverrideDialogProps {
  row: { worker: Worker; checkIn: string | null; checkOut: string | null } | null;
  mode: BulkAttendanceMode;
  hasOverride: boolean;
  onClose: () => void;
  onApply: (workerId: string, value: Partial<TimePair>) => void;
  onReset: (workerId: string) => void;
}

function OverrideDialog({ row, mode, hasOverride, onClose, onApply, onReset }: OverrideDialogProps) {
  const { t } = useTranslation();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const needIn = mode !== "out";
  const needOut = mode !== "in";

  useEffect(() => {
    if (!row) return;
    setCheckIn(row.checkIn ?? "");
    setCheckOut(row.checkOut ?? "");
  }, [row]);

  const valid = (!needIn || isValidTimeFormat(checkIn)) && (!needOut || isValidTimeFormat(checkOut));

  return (
    <Dialog open={!!row} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {t("attendance.bulk.override.title", { name: row ? `${row.worker.firstName} ${row.worker.lastName}` : "" })}
      </DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
          {needIn && (
            <TextField
              fullWidth
              type="time"
              label={t("attendance.bulk.checkInLabel")}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          )}
          {needOut && (
            <TextField
              fullWidth
              type="time"
              label={t("attendance.bulk.checkOutLabel")}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {hasOverride && row && <Button onClick={() => onReset(row.worker.id)}>{t("attendance.bulk.override.reset")}</Button>}
        <Button
          variant="contained"
          disabled={!valid}
          onClick={() =>
            row &&
            onApply(row.worker.id, {
              ...(needIn ? { checkIn } : {}),
              ...(needOut ? { checkOut } : {}),
            })
          }
        >
          {t("attendance.bulk.override.apply")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
