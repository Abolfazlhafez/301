export type FloorChecklistItemStatus = "pending" | "passed" | "failed";

export const FLOOR_CHECKLIST_ITEM_STATUSES: FloorChecklistItemStatus[] = ["pending", "passed", "failed"];

export interface FloorChecklistItem {
  id: string;
  floorId: string;
  /** برای موارد پیش‌فرض seed‌شده، کلید پایدار (برای ترجمه)؛ برای موارد سفارشی کاربر، null (عنوان از title خوانده می‌شود). */
  key: string | null;
  title: string;
  status: FloorChecklistItemStatus;
  workerId: string | null;
  note: string | null;
  checkedAt: string | null;
  /** false برای موارد پیش‌فرض seed‌شده (برق، آب، رنگ...)، true برای مواردی که کاربر خودش اضافه کرده. */
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFloorChecklistItemInput {
  floorId: string;
  title: string;
}

export interface UpdateFloorChecklistItemInput {
  title?: string;
  status?: FloorChecklistItemStatus;
  workerId?: string | null;
  note?: string | null;
}
