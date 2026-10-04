import { NotFoundError } from "../errors";
import { calculateDailyPayroll, calculateGuardDutyPay } from "../payroll";
import { workerService } from "./workerService";
import { attendanceService } from "./attendanceService";
import { timeLossService } from "./timeLossService";
import { breakTimeService } from "./breakTimeService";
import { guardShiftService } from "./guardShiftService";
import { settingsService } from "./settingsService";
import { getTodayIso, addDaysIso } from "../../shared/utils/jalaliDate";
import { BREAK_TIME_TYPE_LABELS } from "../../entities/BreakTime";
import type { DailyTrendPoint, DailyWorkerReport, MonthlyWorkerReport } from "../../entities/Report";

/**
 * معادل Promise.all(items.map(fn)) با همان ترتیب خروجی، ولی حداکثر `size` کار همزمان.
 * گزارش ماهانه قبلاً نیرو×روز (مثلاً ۱۵۰۰) گزارش روزانه را یک‌جا شروع می‌کرد؛ نتیجهٔ مالی تغییری نمی‌کند،
 * فقط اوج حافظهٔ Promiseهای معلق پایین می‌آید.
 */
async function mapInChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

async function getDailyWorkerReport(workerId: string, date: string): Promise<DailyWorkerReport> {
  const worker = await workerService.getById(workerId);
  const settings = await settingsService.get();
  const attendance = await attendanceService.findByWorkerAndDate(workerId, date);
  const timeLosses = attendance ? await timeLossService.findByAttendanceId(attendance.id) : [];
  const breakTimes = attendance ? await breakTimeService.findByAttendanceId(attendance.id) : [];
  const guardShifts = await guardShiftService.findByWorkerAndDate(workerId, date);

  const calculation = calculateDailyPayroll({
    dailyBaseSalary: worker.dailyBaseSalary,
    checkIn: attendance?.checkIn ?? null,
    checkOut: attendance?.checkOut ?? null,
    timeLosses: timeLosses.map((tl) => ({ startTime: tl.startTime, endTime: tl.endTime })),
    standardWorkHours: settings.standardWorkHoursPerDay,
  });

  const guardCalculation = calculateGuardDutyPay({
    shifts: guardShifts.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
    rateType: worker.guardDutyRateType,
    rate: worker.guardDutyRate,
  });

  const totalBreakMinutes = breakTimes.reduce((sum, bt) => sum + bt.durationMinutes, 0);

  return {
    workerId: worker.id,
    workerFullName: `${worker.firstName} ${worker.lastName}`,
    position: worker.position,
    date,
    checkIn: attendance?.checkIn ?? null,
    checkOut: attendance?.checkOut ?? null,
    totalAttendanceMinutes: calculation.totalAttendanceMinutes,
    totalTimeLossMinutes: calculation.totalTimeLossMinutes,
    totalBreakMinutes,
    usefulMinutes: calculation.usefulMinutes,
    dailyBaseSalary: worker.dailyBaseSalary,
    hourlyRate: calculation.hourlyRate,
    payableSalary: calculation.payableSalary,
    guardDuty: {
      enabled: worker.guardDutyEnabled,
      rateType: worker.guardDutyRateType,
      rate: worker.guardDutyRate,
      shiftsCount: guardCalculation.shiftsCount,
      totalMinutes: guardCalculation.totalMinutes,
      payableSalary: guardCalculation.payableAmount,
      shifts: guardShifts.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        note: s.note,
      })),
    },
    timeLosses: timeLosses.map((tl) => ({
      id: tl.id,
      startTime: tl.startTime,
      endTime: tl.endTime,
      durationMinutes: tl.durationMinutes,
      reason: tl.reason,
      note: tl.note,
    })),
    breakTimes: breakTimes.map((bt) => ({
      id: bt.id,
      type: bt.type,
      typeLabel: BREAK_TIME_TYPE_LABELS[bt.type],
      startTime: bt.startTime,
      endTime: bt.endTime,
      durationMinutes: bt.durationMinutes,
      note: bt.note,
    })),
  };
}

async function getDailyAllWorkersReport(date: string): Promise<DailyWorkerReport[]> {
  const workers = await workerService.list({ isActive: true });
  return Promise.all(workers.map((w) => getDailyWorkerReport(w.id, date)));
}

async function getMonthlyWorkerReport(
  workerId: string,
  from: string,
  to: string,
  yearMonthLabel: string
): Promise<MonthlyWorkerReport> {
  const worker = await workerService.findByIdOrNull(workerId);
  if (!worker) throw new NotFoundError(`نیرویی با شناسه ${workerId} یافت نشد.`);

  const attendances = await attendanceService.list({ workerId, from, to });
  const guardShifts = await guardShiftService.list({ workerId, from, to });

  // روزهایی که باید در تفکیک ماهانه لحاظ شوند: اجتماع روزهای حضور عادی و
  // روزهایی که فقط نوبت نگهبانی داشته‌اند (بدون حضور عادی) — چون نگهبانی
  // کاملاً مستقل از حضور معمولی است و نباید از گزارش ماهانه جا بماند.
  const relevantDates = Array.from(
    new Set([...attendances.map((a) => a.date), ...guardShifts.map((s) => s.date)])
  ).sort();

  const dailyBreakdown = (
    await mapInChunks(relevantDates, 8, (date) => getDailyWorkerReport(workerId, date))
  ).sort((a, b) => (a.date > b.date ? 1 : -1));

  const totals = dailyBreakdown.reduce(
    (acc, day) => {
      acc.totalAttendanceMinutes += day.totalAttendanceMinutes;
      acc.totalTimeLossMinutes += day.totalTimeLossMinutes;
      acc.totalBreakMinutes += day.totalBreakMinutes;
      acc.totalUsefulMinutes += day.usefulMinutes;
      acc.totalPayableSalary += day.payableSalary;
      acc.totalGuardDutyPayableSalary += day.guardDuty.payableSalary;
      acc.totalGuardDutyMinutes += day.guardDuty.totalMinutes;
      acc.totalGuardDutyShiftsCount += day.guardDuty.shiftsCount;
      if (day.checkIn) acc.presentDaysCount += 1;
      return acc;
    },
    {
      totalAttendanceMinutes: 0,
      totalTimeLossMinutes: 0,
      totalBreakMinutes: 0,
      totalUsefulMinutes: 0,
      totalPayableSalary: 0,
      totalGuardDutyPayableSalary: 0,
      totalGuardDutyMinutes: 0,
      totalGuardDutyShiftsCount: 0,
      presentDaysCount: 0,
    }
  );

  return {
    workerId: worker.id,
    workerFullName: `${worker.firstName} ${worker.lastName}`,
    position: worker.position,
    yearMonth: yearMonthLabel,
    ...totals,
    dailyBreakdown,
  };
}

async function getMonthlyAllWorkersReport(from: string, to: string, yearMonthLabel: string): Promise<MonthlyWorkerReport[]> {
  const workers = await workerService.list({ isActive: true });
  const reports = await mapInChunks(workers, 4, (w) => getMonthlyWorkerReport(w.id, from, to, yearMonthLabel));
  return reports.sort((a, b) => a.workerFullName.localeCompare(b.workerFullName, "fa"));
}

async function getWeeklyTrend(days = 7): Promise<DailyTrendPoint[]> {
  const points: DailyTrendPoint[] = [];
  const today = getTodayIso();

  for (let i = days - 1; i >= 0; i--) {
    const dateStr = addDaysIso(today, -i);

    const reports = await getDailyAllWorkersReport(dateStr);
    const totalUsefulMinutes = reports.reduce((sum, r) => sum + r.usefulMinutes, 0);
    const totalPayableSalary = reports.reduce((sum, r) => sum + r.payableSalary, 0);
    const presentWorkersCount = reports.filter((r) => r.checkIn).length;

    points.push({ date: dateStr, totalUsefulMinutes, totalPayableSalary, presentWorkersCount });
  }

  return points;
}

export const reportService = {
  getDailyWorkerReport,
  getDailyAllWorkersReport,
  getMonthlyWorkerReport,
  getMonthlyAllWorkersReport,
  getWeeklyTrend,
};

// برای استفاده داخلی سایر سرویس‌ها (مثلاً محاسبه مانده حساب) بدون import چرخه‌ای
export { getDailyWorkerReport as _getDailyWorkerReport };
