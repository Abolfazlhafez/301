export interface TimeLoss {
  id: string;
  workerId: string;
  attendanceId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  reason: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimeLossInput {
  workerId: string;
  attendanceId: string;
  startTime: string;
  endTime: string;
  reason: string;
  note?: string | null;
}

export interface UpdateTimeLossInput {
  startTime?: string;
  endTime?: string;
  reason?: string;
  note?: string | null;
}
