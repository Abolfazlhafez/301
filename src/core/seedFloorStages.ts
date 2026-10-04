/**
 * ۸ مرحلهٔ اجرایی پیش‌فرض که برای هر «طبقهٔ» جدید به‌صورت خودکار ساخته
 * می‌شوند (بخش ۴۳ پرامپت اصلی). کلیدها ثابت‌اند تا در آینده بتوان منطق
 * خاصی روی یک مرحلهٔ مشخص پیاده کرد؛ عنوان نمایشی فقط از Translation
 * (namespace floor.stageTitle.<key>) می‌آید، نه از این‌جا.
 */
export interface StandardStageSeed {
  key: string;
  order: number;
  weight: number;
}

export const STANDARD_STAGE_SEEDS: StandardStageSeed[] = [
  { key: "project_start", order: 0, weight: 5 },
  { key: "structure", order: 1, weight: 20 },
  { key: "masonry", order: 2, weight: 15 },
  { key: "mep", order: 3, weight: 20 },
  { key: "plaster", order: 4, weight: 10 },
  { key: "flooring", order: 5, weight: 10 },
  { key: "painting", order: 6, weight: 10 },
  { key: "completion", order: 7, weight: 10 },
];

export const STANDARD_STAGE_KEYS: string[] = STANDARD_STAGE_SEEDS.map((s) => s.key);

/**
 * موارد پیش‌فرض «چک‌لیست تحویل طبقه» (بخش ۱۹). عنوان نمایشی از Translation
 * (namespace floor.checklistTitle.<key>) می‌آید.
 */
export const DEFAULT_CHECKLIST_ITEM_KEYS: string[] = [
  "electrical",
  "mechanical",
  "water",
  "sewage",
  "flooring",
  "walls",
  "ceiling",
  "doors",
  "windows",
  "painting",
  "cleaning",
  "defect_fixing",
];
