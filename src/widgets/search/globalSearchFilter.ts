import { Worker } from "../../entities/Worker";
import { CashbookEntry, CASHBOOK_ENTRY_TYPE_LABELS } from "../../entities/Cashbook";
import { FutureActivity } from "../../entities/FutureActivity";
import { Equipment } from "../../entities/Equipment";
import { FloorWithStats } from "../../entities/Floor";
import { FloorTask } from "../../entities/FloorTask";
import { FloorIssue } from "../../entities/FloorIssue";
import { FloorPlan } from "../../entities/FloorPlan";
import { WorkLogNote } from "../../entities/WorkLogNote";
import { formatCurrency, formatPercent, normalizeDigits } from "../../shared/utils/format";
import { getRelativeDayLabel, toJalaliDisplay } from "../../shared/utils/jalaliDate";

export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
const MAX_RESULTS_PER_CATEGORY = 8;

export type GlobalSearchResult =
  | { kind: "worker"; id: string; title: string; subtitle: string }
  | { kind: "cashbook"; id: string; title: string; subtitle: string }
  | { kind: "activity"; id: string; title: string; subtitle: string }
  | { kind: "equipment"; id: string; title: string; subtitle: string }
  | { kind: "floor"; id: string; title: string; subtitle: string; to: string }
  | { kind: "floorTask"; id: string; title: string; subtitle: string; to: string }
  | { kind: "floorIssue"; id: string; title: string; subtitle: string; to: string }
  | { kind: "floorPlan"; id: string; title: string; subtitle: string; to: string }
  | { kind: "floorReport"; id: string; title: string; subtitle: string; to: string };

interface GlobalSearchSources {
  workers: Worker[];
  cashbookEntries: CashbookEntry[];
  activities: FutureActivity[];
  equipment: Equipment[];
  floors?: FloorWithStats[];
  floorTasks?: FloorTask[];
  floorIssues?: FloorIssue[];
  floorPlans?: FloorPlan[];
  floorReports?: WorkLogNote[];
}

export interface GlobalSearchLabels {
  cashbookEntryTypes: Record<CashbookEntry["type"], string>;
  activityCompletedSuffix: string;
  openTasksSuffix: string;
}

// مقدار پیش‌فرض فارسی — دقیقاً همان متن‌های قبلی، تا فراخوانی‌های موجود
// (از جمله تست‌های تجربی) که پارامتر labels را پاس نمی‌دهند، رفتار قبلی را
// بدون هیچ تغییری حفظ کنند. UI واقعی (GlobalSearchDialog.tsx) این پارامتر
// را با برچسب‌های ترجمه‌شدهٔ i18n (بر اساس زبان فعلی کاربر) پر می‌کند —
// چون این تابع عمداً مستقل از React/i18n نگه داشته شده تا مستقیماً و بدون
// نیاز به رندر قابل تست باشد.
const DEFAULT_LABELS: GlobalSearchLabels = {
  cashbookEntryTypes: CASHBOOK_ENTRY_TYPE_LABELS,
  activityCompletedSuffix: " — انجام‌شده",
  openTasksSuffix: "کار باز",
};

/**
 * منطق خالص و مستقل از React برای فیلترکردن جستجوی سراسری روی چهار دستهٔ
 * اصلی اطلاعات اپ. از GlobalSearchDialog.tsx (که این تابع را داخل
 * useMemo صدا می‌زند) جدا شده تا مستقیماً و بدون نیاز به رندر React قابل
 * تست باشد — این خودِ منطقی است که واقعاً می‌تواند باگ داشته باشد (نه
 * صرفاً نمایش نتایج).
 */
export function filterGlobalSearchResults(
  rawQuery: string,
  sources: GlobalSearchSources,
  todayIso: string,
  labels: GlobalSearchLabels = DEFAULT_LABELS
): GlobalSearchResult[] {
  const q = normalizeDigits(rawQuery.trim().toLowerCase());
  if (q.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) return [];

  const workerResults: GlobalSearchResult[] = sources.workers
    .filter((w) => {
      const fullName = `${w.firstName} ${w.lastName}`.toLowerCase();
      const phone = normalizeDigits((w.phoneNumber ?? "").toLowerCase());
      return fullName.includes(q) || phone.includes(q) || w.position.toLowerCase().includes(q);
    })
    .slice(0, MAX_RESULTS_PER_CATEGORY)
    .map((w) => ({
      kind: "worker" as const,
      id: w.id,
      title: `${w.firstName} ${w.lastName}`,
      subtitle: w.position + (w.phoneNumber ? ` — ${w.phoneNumber}` : ""),
    }));

  const cashbookResults: GlobalSearchResult[] = sources.cashbookEntries
    .filter((e) => {
      const title = e.title.toLowerCase();
      const desc = (e.description ?? "").toLowerCase();
      const amount = normalizeDigits(String(e.amount));
      return title.includes(q) || desc.includes(q) || amount.includes(q);
    })
    .slice(0, MAX_RESULTS_PER_CATEGORY)
    .map((e) => ({
      kind: "cashbook" as const,
      id: e.id,
      title: e.title,
      subtitle: `${labels.cashbookEntryTypes[e.type]} — ${formatCurrency(e.amount)} — ${toJalaliDisplay(e.date)}`,
    }));

  const activityResults: GlobalSearchResult[] = sources.activities
    .filter((a) => {
      const title = a.title.toLowerCase();
      const desc = (a.description ?? "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    })
    .slice(0, MAX_RESULTS_PER_CATEGORY)
    .map((a) => ({
      kind: "activity" as const,
      id: a.id,
      title: a.title,
      subtitle: `${getRelativeDayLabel(a.date, todayIso)}${a.isCompleted ? labels.activityCompletedSuffix : ""}`,
    }));

  const equipmentResults: GlobalSearchResult[] = sources.equipment
    .filter((eq) => {
      const name = eq.name.toLowerCase();
      const desc = (eq.description ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    })
    .slice(0, MAX_RESULTS_PER_CATEGORY)
    .map((eq) => ({
      kind: "equipment" as const,
      id: eq.id,
      title: eq.name,
      subtitle: `${eq.totalQuantity} ${eq.unit}`,
    }));

  return [
    ...workerResults,
    ...cashbookResults,
    ...activityResults,
    ...equipmentResults,
    ...floorSearchResults(sources, q, labels),
  ];
}

/**
 * جست‌وجو روی داده‌های «دفترچهٔ دیجیتال طبقه» — چون این‌ها بر خلاف بقیهٔ
 * انواع، صفحهٔ جزئیات مستقل (FloorNotebookPage) دارند، مسیر دقیق (`to`) در
 * خودِ نتیجه محاسبه می‌شود، نه در getGlobalSearchResultRoute.
 */
function floorSearchResults(sources: GlobalSearchSources, q: string, labels: GlobalSearchLabels): GlobalSearchResult[] {
  const results: GlobalSearchResult[] = [];

  for (const floor of sources.floors ?? []) {
    const name = floor.name.toLowerCase();
    const number = floor.number === null ? "" : String(floor.number);
    if (name.includes(q) || number.includes(q)) {
      results.push({
        kind: "floor",
        id: floor.id,
        title: floor.name,
        subtitle: `${formatPercent(floor.progress)} — ${floor.openTasksCount} ${labels.openTasksSuffix}`,
        to: `/project/floors/${floor.id}`,
      });
    }
  }

  for (const task of sources.floorTasks ?? []) {
    if (task.title.toLowerCase().includes(q)) {
      results.push({
        kind: "floorTask",
        id: task.id,
        title: task.title,
        subtitle: task.note ?? "",
        to: `/project/floors/${task.floorId}`,
      });
    }
  }

  for (const issue of sources.floorIssues ?? []) {
    if (issue.title.toLowerCase().includes(q)) {
      results.push({
        kind: "floorIssue",
        id: issue.id,
        title: issue.title,
        subtitle: issue.description ?? "",
        to: `/project/floors/${issue.floorId}`,
      });
    }
  }

  for (const plan of sources.floorPlans ?? []) {
    if (plan.title.toLowerCase().includes(q)) {
      results.push({
        kind: "floorPlan",
        id: plan.id,
        title: plan.title,
        subtitle: plan.code ?? "",
        to: `/project/floors/${plan.floorId}`,
      });
    }
  }


  for (const report of sources.floorReports ?? []) {
    const description = report.description.toLowerCase();
    if (description.includes(q) || report.date.includes(q)) {
      results.push({
        kind: "floorReport",
        id: report.id,
        title: report.description.slice(0, 80) || report.date,
        subtitle: report.date,
        to: `/project/floors/${report.floorId}`,
      });
    }
  }

  return results.slice(0, MAX_RESULTS_PER_CATEGORY);
}

/** مسیر ناوبری متناظر با هر یک از چهار نوع نتیجهٔ اصلی (بدون صفحهٔ جزئیات مستقل) — امضای قدیمی، دست‌نخورده برای سازگاری با کدها/تست‌های موجود. */
export function getGlobalSearchResultRoute(
  kind: "worker" | "cashbook" | "activity" | "equipment"
): string {
  switch (kind) {
    case "worker":
      return "/resources?tab=workers";
    case "cashbook":
      // «دفتر حساب» طبق بازطراحی سوم ناوبری دوباره در «گزارش‌ها» قرار دارد.
      return "/reports?tab=cashbook";
    case "equipment":
      return "/resources?tab=equipment";
    case "activity":
      return "/activities?tab=upcoming";
  }
}

/** مسیر ناوبری برای هر نوع نتیجه، شامل انواع Floor که صفحهٔ جزئیات مستقل (FloorNotebookPage) دارند. */
export function getGlobalSearchResultPath(result: GlobalSearchResult): string {
  if (result.kind === "floor" || result.kind === "floorTask" || result.kind === "floorIssue" || result.kind === "floorPlan" || result.kind === "floorReport") {
    return result.to;
  }
  return getGlobalSearchResultRoute(result.kind);
}
