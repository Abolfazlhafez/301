export interface GuardDutyDailySummary {
  enabled: boolean;
  rateType: "hourly" | "shift";
  rate: number;
  shiftsCount: number;
  totalMinutes: number;
  payableSalary: number;
  shifts: {
    id: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    note: string | null;
  }[];
}

export interface DailyWorkerReport {
  workerId: string;
  workerFullName: string;
  position: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  totalAttendanceMinutes: number;
  totalTimeLossMinutes: number;
  totalBreakMinutes: number;
  usefulMinutes: number;
  dailyBaseSalary: number;
  hourlyRate: number;
  /** حقوق کار عادی (نگهبانی در این مبلغ ادغام نشده است). */
  payableSalary: number;
  /** خلاصه دستمزد نگهبانی این روز، همیشه جدا از حقوق کار عادی. */
  guardDuty: GuardDutyDailySummary;
  timeLosses: {
    id: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    reason: string;
    note: string | null;
  }[];
  breakTimes: {
    id: string;
    type: string;
    typeLabel: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    note: string | null;
  }[];
}

export interface MonthlyWorkerReport {
  workerId: string;
  workerFullName: string;
  position: string;
  yearMonth: string;
  totalAttendanceMinutes: number;
  totalTimeLossMinutes: number;
  totalBreakMinutes: number;
  totalUsefulMinutes: number;
  totalPayableSalary: number;
  presentDaysCount: number;
  /** جمع مبلغ نگهبانی این ماه، همیشه جدا از totalPayableSalary. */
  totalGuardDutyPayableSalary: number;
  totalGuardDutyMinutes: number;
  totalGuardDutyShiftsCount: number;
  dailyBreakdown: DailyWorkerReport[];
}

export interface DashboardSummary {
  presentWorkersCount: number;
  absentWorkersCount: number;
  /** نیروهایی که امروز غیبت مجاز ثبت‌شده دارند (مثلاً مرخصی، مأموریت) — این‌ها در absentWorkersCount حساب نمی‌شوند. */
  onLeaveWorkersCount: number;
  totalActiveWorkersCount: number;
  totalWorkedMinutesToday: number;
  totalTimeLossMinutesToday: number;
  totalPayableSalaryToday: number;
  recentActivities: RecentActivity[];
}

export interface RecentActivity {
  id: string;
  type: "attendance_checkin" | "attendance_checkout" | "timeloss" | "worker_created";
  workerFullName: string;
  description: string;
  timestamp: string;
}

export interface DailyTrendPoint {
  date: string;
  totalUsefulMinutes: number;
  totalPayableSalary: number;
  presentWorkersCount: number;
}
