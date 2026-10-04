/**
 * Relation بین یک طبقه و یک نیروی موجود (Worker) — هرگز Worker جدید/تکراری
 * نمی‌سازد؛ فقط ارتباط را نگه می‌دارد.
 */
export interface FloorWorker {
  id: string;
  floorId: string;
  workerId: string;
  /** نقش این فرد در این طبقه (مثلاً «پیمانکار تأسیسات»، «مسئول مرحله») — متن آزاد. */
  role: string | null;
  stageId: string | null;
  createdAt: string;
}

export interface CreateFloorWorkerInput {
  floorId: string;
  workerId: string;
  role?: string | null;
  stageId?: string | null;
}

export interface FloorWorkerWithDetails extends FloorWorker {
  workerFullName: string;
  workerPosition: string;
}
