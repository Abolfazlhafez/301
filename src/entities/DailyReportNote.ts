/**
 * یادداشت سرپرست مربوط به گزارش روزانه یک تاریخ مشخص.
 * جدا از حضور و غیاب نگه داشته می‌شود چون به کل روز مربوط است، نه یک نیروی خاص.
 */
export interface DailyReportNote {
  /** ترکیب projectId:date (هر پروژه، هر تاریخ، حداکثر یک یادداشت). */
  id: string;
  projectId: string;
  date: string;
  supervisorNote: string;
  updatedAt: string;
}
