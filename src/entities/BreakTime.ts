export type BreakTimeType = "breakfast" | "lunch" | "other";

export interface BreakTime {
  id: string;
  workerId: string;
  attendanceId: string;
  type: BreakTimeType;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBreakTimeInput {
  workerId: string;
  attendanceId: string;
  type: BreakTimeType;
  startTime: string;
  endTime: string;
  note?: string | null;
}

export const BREAK_TIME_TYPE_LABELS: Record<BreakTimeType, string> = {
  breakfast: "صبحانه",
  lunch: "ناهار",
  other: "سایر",
};
