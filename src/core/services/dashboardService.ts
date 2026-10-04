import { db } from "../db";
import { calculateDailyPayroll } from "../payroll";
import { workerService } from "./workerService";
import { settingsService } from "./settingsService";
import type { Attendance } from "../../entities/Attendance";
import type { DashboardSummary, RecentActivity } from "../../entities/Report";
import type { Worker } from "../../entities/Worker";

function buildRecentActivities(
  workers: Worker[],
  todaysAttendances: Attendance[],
  timeLossesByAttendanceId: Map<string, { id: string; reason: string; startTime: string; endTime: string; updatedAt: string }[]>
): RecentActivity[] {
  const workerMap = new Map(workers.map((w) => [w.id, w]));
  const activities: RecentActivity[] = [];

  for (const att of todaysAttendances) {
    const worker = workerMap.get(att.workerId);
    const fullName = worker ? `${worker.firstName} ${worker.lastName}` : "نامشخص";

    if (att.checkIn) {
      activities.push({
        id: `${att.id}-checkin`,
        type: "attendance_checkin",
        workerFullName: fullName,
        description: `ورود ساعت ${att.checkIn}`,
        timestamp: att.updatedAt,
      });
    }
    if (att.checkOut) {
      activities.push({
        id: `${att.id}-checkout`,
        type: "attendance_checkout",
        workerFullName: fullName,
        description: `خروج ساعت ${att.checkOut}`,
        timestamp: att.updatedAt,
      });
    }

    const timeLosses = timeLossesByAttendanceId.get(att.id) ?? [];
    for (const tl of timeLosses) {
      activities.push({
        id: tl.id,
        type: "timeloss",
        workerFullName: fullName,
        description: `اتلاف وقت: ${tl.reason} (${tl.startTime} تا ${tl.endTime})`,
        timestamp: tl.updatedAt,
      });
    }
  }

  return activities.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, 10);
}

export const dashboardService = {
  async getSummary(today: string): Promise<DashboardSummary> {
    const activeWorkers = await workerService.list({ isActive: true });
    const todaysAttendances = await db.attendances.where("date").equals(today).toArray();
    const attendanceByWorkerId = new Map(todaysAttendances.map((a) => [a.workerId, a]));
    const settings = await settingsService.get();

    // نیروهایی که برای امروز غیبت مجاز ثبت‌شده دارند، نباید در شمار «غایب»
    // (که به‌معنی غیبت بدون توضیح است) حساب شوند — این‌ها یک وضعیت سوم و
    // مجزا هستند.
    const todaysOptionalLeaves = await db.optionalLeaves.where("date").equals(today).toArray();
    const onLeaveWorkerIds = new Set(todaysOptionalLeaves.map((l) => l.workerId));

    let totalWorkedMinutesToday = 0;
    let totalTimeLossMinutesToday = 0;
    let totalPayableSalaryToday = 0;
    let presentWorkersCount = 0;

    const timeLossesByAttendanceId = new Map<
      string,
      { id: string; reason: string; startTime: string; endTime: string; updatedAt: string }[]
    >();

    for (const worker of activeWorkers) {
      const attendance = attendanceByWorkerId.get(worker.id);
      if (!attendance || !attendance.checkIn) continue;

      presentWorkersCount += 1;
      const timeLosses = await db.timeLosses.where({ attendanceId: attendance.id }).toArray();
      timeLossesByAttendanceId.set(attendance.id, timeLosses);

      const calc = calculateDailyPayroll({
        dailyBaseSalary: worker.dailyBaseSalary,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        timeLosses: timeLosses.map((tl) => ({ startTime: tl.startTime, endTime: tl.endTime })),
        standardWorkHours: settings.standardWorkHoursPerDay,
      });

      totalWorkedMinutesToday += calc.totalAttendanceMinutes;
      totalTimeLossMinutesToday += calc.totalTimeLossMinutes;
      totalPayableSalaryToday += calc.payableSalary;
    }

    const onLeaveWorkersCount = activeWorkers.filter((w) => onLeaveWorkerIds.has(w.id) && !attendanceByWorkerId.get(w.id)?.checkIn).length;
    const absentWorkersCount = activeWorkers.length - presentWorkersCount - onLeaveWorkersCount;
    const recentActivities = buildRecentActivities(activeWorkers, todaysAttendances, timeLossesByAttendanceId);

    return {
      presentWorkersCount,
      absentWorkersCount,
      onLeaveWorkersCount,
      totalActiveWorkersCount: activeWorkers.length,
      totalWorkedMinutesToday,
      totalTimeLossMinutesToday,
      totalPayableSalaryToday,
      recentActivities,
    };
  },
};
