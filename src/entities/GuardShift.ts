export interface GuardShift {
  id: string;
  /** پروژه‌ای که این نوبت نگهبانی برای آن ثبت شده (نیرو می‌تواند در چند پروژه فعال باشد). */
  projectId: string;
  workerId: string;
  /** تاریخ ISO میلادی نوبت نگهبانی؛ مستقل از رکورد حضور و غیاب عادی همان روز است. */
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuardShiftInput {
  workerId: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string | null;
}

export interface UpdateGuardShiftInput {
  date?: string;
  startTime?: string;
  endTime?: string;
  note?: string | null;
}
