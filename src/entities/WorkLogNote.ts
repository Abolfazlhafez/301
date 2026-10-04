/**
 * توضیحات متنی گزارش کار یک تاریخ مشخص (جدا از توضیح هر عکس/caption).
 */
export interface WorkLogNote {
  /** ترکیب projectId:date (هر پروژه، هر تاریخ، حداکثر یک توضیح). */
  id: string;
  projectId: string;
  date: string;
  description: string;
  floorId?: string | null;
  stageId?: string | null;
  updatedAt: string;
}
