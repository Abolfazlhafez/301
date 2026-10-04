export type FloorTaskStatus = "todo" | "in_progress" | "blocked" | "done";

export const FLOOR_TASK_STATUSES: FloorTaskStatus[] = ["todo", "in_progress", "blocked", "done"];

export type FloorTaskPriority = "low" | "medium" | "high" | "critical";

export const FLOOR_TASK_PRIORITIES: FloorTaskPriority[] = ["low", "medium", "high", "critical"];

export interface FloorTask {
  id: string;
  floorId: string;
  stageId: string | null;
  title: string;
  description: string | null;
  status: FloorTaskStatus;
  priority: FloorTaskPriority;
  progress: number;
  /** نیروی مسئول این کار — Relation به Worker موجود، هرگز Worker تکراری ساخته نمی‌شود. */
  workerId: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFloorTaskInput {
  floorId: string;
  stageId?: string | null;
  title: string;
  description?: string | null;
  priority?: FloorTaskPriority;
  workerId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedCost?: number | null;
  note?: string | null;
}

export interface UpdateFloorTaskInput {
  stageId?: string | null;
  title?: string;
  description?: string | null;
  status?: FloorTaskStatus;
  priority?: FloorTaskPriority;
  progress?: number;
  workerId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  note?: string | null;
}
