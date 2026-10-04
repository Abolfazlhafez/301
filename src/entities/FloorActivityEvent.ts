/**
 * رخداد فعالیت طبقه — پایهٔ «Activity Feed» و Audit History (بخش ۴۲ پرامپت).
 *
 * به‌جای ذخیرهٔ متن نهایی (که Hard-code و غیرقابل‌ترجمه می‌شود)، هر رخداد یک
 * `messageKey` (کلید ترجمه در namespace floor.activity) و `params` ساختاریافته
 * نگه می‌دارد؛ رابط کاربری با t(messageKey, params) متن نهایی را در زبان
 * فعلی کاربر می‌سازد. این دقیقاً همان الزام بخش ۵۷ (Digital Floor Book
 * AI-Ready) را هم برآورده می‌کند: داده در description آزاد دفن نمی‌شود.
 */
export type FloorActivityEventType =
  | "floor_created"
  | "floor_status_changed"
  | "stage_started"
  | "stage_created"
  | "stage_completed"
  | "stage_blocked"
  | "stage_deleted"
  | "task_created"
  | "task_completed"
  | "plan_uploaded"
  | "photo_added"
  | "report_saved"
  | "issue_created"
  | "issue_resolved"
  | "checklist_updated"
  | "worker_assigned"
  | "cashbook_linked";

export interface FloorActivityEvent {
  id: string;
  floorId: string;
  stageId: string | null;
  type: FloorActivityEventType;
  /** کلید ترجمه، مثلاً "floor.activity.stageCompleted". */
  messageKey: string;
  params: Record<string, string | number> | null;
  createdAt: string;
}

export interface CreateFloorActivityEventInput {
  floorId: string;
  stageId?: string | null;
  type: FloorActivityEventType;
  messageKey: string;
  params?: Record<string, string | number> | null;
}
