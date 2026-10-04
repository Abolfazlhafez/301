import type { PictureCardLayoutId, PictureCardTemplateId } from "../../entities/PictureCard";

/**
 * رجیستری قالب‌ها و Layoutهای پیکچر کارت.
 *
 * معماری: به‌جای نوشتن ۵ کامپوننت کاملاً مجزا (که نگهداری آن سخت می‌شود)،
 * هر «قالب» فقط یک پوستهٔ بصری (رنگ‌ها، سبک هدر/فوتر، تزئینات) تعریف می‌کند و
 * هر «Layout» فقط چیدمان CSS Grid عکس‌ها را (بر اساس تعداد عکس ۱ تا ۴) مشخص
 * می‌کند. حاصل‌ضرب قالب × Layout مجموعه‌ی متنوعی از خروجی‌ها می‌دهد، در حالی که
 * منطق چیدمان مستقل از نسبت تصویر است (هر خانه با object-fit:cover پر می‌شود)
 * و بنابراین با عکس عمودی، افقی و مربعی به یک اندازه خوب کار می‌کند.
 */

export interface PictureCardTemplateMeta {
  id: PictureCardTemplateId;
  name: string;
  description: string;
  /** رنگ نمایندهٔ قالب، برای نمایش در کارت انتخاب قالب. */
  swatch: string;
}

export interface PictureCardLayoutMeta {
  id: PictureCardLayoutId;
  name: string;
  description: string;
}

export const PICTURE_CARD_TEMPLATES: PictureCardTemplateMeta[] = [
  {
    id: "work-report",
    name: "گزارش کار",
    description: "فرم رسمی گزارش کار با نشان سبز تیره، ردیف مشخصات پروژه و بخش توضیحات؛ مناسب گزارش روزانه پروژه ساختمانی.",
    swatch: "#0F3D33",
  },
];

export const PICTURE_CARD_LAYOUTS: PictureCardLayoutMeta[] = [
  { id: "grid", name: "شبکه‌ای متوازن", description: "تقسیم‌بندی یکنواخت فضا بین همه عکس‌ها." },
  { id: "feature", name: "عکس ویژه", description: "یک عکس اصلی بزرگ‌تر و بقیه کوچک‌تر در کنار آن." },
  { id: "stack", name: "ستونی عمودی", description: "چیدمان عمودی پشت‌سرهم؛ مناسب عکس‌های عمودی." },
];

interface LayoutGrid {
  gridTemplateColumns: string;
  gridTemplateRows: string;
  gridTemplateAreas: string;
  /** ترتیب نام‌های ناحیه به همان ترتیب عکس‌های ورودی. */
  areas: string[];
  /** ارتفاع پیشنهادی کل شبکه (نسبت به عرض) برای هر Layout/تعداد؛ برای جلوگیری از افتادگی خیلی کوتاه/بلند. */
  aspectRatio: string;
}

const GRID_DEFS: Record<PictureCardLayoutId, Record<number, LayoutGrid>> = {
  grid: {
    1: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr", gridTemplateAreas: `"a"`, areas: ["a"], aspectRatio: "4 / 3" },
    2: {
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr",
      gridTemplateAreas: `"a b"`,
      areas: ["a", "b"],
      aspectRatio: "16 / 7",
    },
    3: {
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gridTemplateAreas: `"a b" "a c"`,
      areas: ["a", "b", "c"],
      aspectRatio: "1 / 1",
    },
    4: {
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gridTemplateAreas: `"a b" "c d"`,
      areas: ["a", "b", "c", "d"],
      aspectRatio: "1 / 1",
    },
  },
  feature: {
    1: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr", gridTemplateAreas: `"a"`, areas: ["a"], aspectRatio: "4 / 3" },
    2: {
      gridTemplateColumns: "2fr 1fr",
      gridTemplateRows: "1fr",
      gridTemplateAreas: `"a b"`,
      areas: ["a", "b"],
      aspectRatio: "16 / 7",
    },
    3: {
      gridTemplateColumns: "2fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gridTemplateAreas: `"a b" "a c"`,
      areas: ["a", "b", "c"],
      aspectRatio: "4 / 3",
    },
    4: {
      gridTemplateColumns: "1fr 1fr 1fr",
      gridTemplateRows: "2fr 1fr",
      gridTemplateAreas: `"a a a" "b c d"`,
      areas: ["a", "b", "c", "d"],
      aspectRatio: "5 / 4",
    },
  },
  stack: {
    1: { gridTemplateColumns: "1fr", gridTemplateRows: "1fr", gridTemplateAreas: `"a"`, areas: ["a"], aspectRatio: "4 / 3" },
    2: {
      gridTemplateColumns: "1fr",
      gridTemplateRows: "1fr 1fr",
      gridTemplateAreas: `"a" "b"`,
      areas: ["a", "b"],
      aspectRatio: "3 / 4",
    },
    3: {
      gridTemplateColumns: "1fr",
      gridTemplateRows: "1fr 1fr 1fr",
      gridTemplateAreas: `"a" "b" "c"`,
      areas: ["a", "b", "c"],
      aspectRatio: "1 / 2",
    },
    4: {
      gridTemplateColumns: "1fr",
      gridTemplateRows: "1fr 1fr 1fr 1fr",
      gridTemplateAreas: `"a" "b" "c" "d"`,
      areas: ["a", "b", "c", "d"],
      aspectRatio: "3 / 5",
    },
  },
};

/** چیدمان شبکه‌ای مناسب برای Layout و تعداد عکس داده‌شده (بین ۱ تا ۴). */
export function getLayoutGrid(layoutId: PictureCardLayoutId, photoCount: number): LayoutGrid {
  const count = Math.min(Math.max(photoCount, 1), 4);
  return GRID_DEFS[layoutId][count];
}

export interface RecommendedPhotoSlot {
  /** به همان ترتیب عکس‌های انتخاب‌شده (۰-پایه). */
  index: number;
  orientation: "landscape" | "portrait" | "square";
  orientationLabel: string;
  widthPx: number;
  heightPx: number;
}

function parseFrTrack(track: string): number[] {
  return track.trim().split(/\s+/).map((t) => parseFloat(t));
}

function parseAreasMatrix(gridTemplateAreas: string): string[][] {
  return Array.from(gridTemplateAreas.matchAll(/"([^"]+)"/g)).map((m) => m[1].trim().split(/\s+/));
}

/**
 * برای هر خانهٔ چیدمان (بر اساس Layout و تعداد عکس)، ابعاد پیکسلیِ پیشنهادی
 * و جهت (افقی/عمودی/مربعی) را محاسبه می‌کند — با فرض عرض کل خروجی کارت
 * برابر cardWidthPx. این محاسبه مستقیماً از fr های grid و aspectRatio کلی
 * چیدمان به‌دست می‌آید، نه یک عدد ثابت حدسی؛ بنابراین با اضافه/تغییر Layout
 * در رجیستری هم خودکار به‌روز می‌ماند.
 */
export function getRecommendedPhotoSlots(
  layoutId: PictureCardLayoutId,
  photoCount: number,
  cardWidthPx = 1000
): RecommendedPhotoSlot[] {
  const grid = getLayoutGrid(layoutId, photoCount);
  const colFr = parseFrTrack(grid.gridTemplateColumns);
  const rowFr = parseFrTrack(grid.gridTemplateRows);
  const colTotal = colFr.reduce((a, b) => a + b, 0);
  const rowTotal = rowFr.reduce((a, b) => a + b, 0);
  const [aw, ah] = grid.aspectRatio.split("/").map((s) => parseFloat(s));
  const cardHeightPx = cardWidthPx * (ah / aw);
  const matrix = parseAreasMatrix(grid.gridTemplateAreas);

  const spans: Record<string, { cols: Set<number>; rows: Set<number> }> = {};
  matrix.forEach((rowArr, rIdx) => {
    rowArr.forEach((areaName, cIdx) => {
      if (!spans[areaName]) spans[areaName] = { cols: new Set(), rows: new Set() };
      spans[areaName].cols.add(cIdx);
      spans[areaName].rows.add(rIdx);
    });
  });

  return grid.areas.map((areaName, index) => {
    const span = spans[areaName];
    const widthPx = Math.round(
      (Array.from(span.cols).reduce((sum, ci) => sum + colFr[ci], 0) / colTotal) * cardWidthPx
    );
    const heightPx = Math.round(
      (Array.from(span.rows).reduce((sum, ri) => sum + rowFr[ri], 0) / rowTotal) * cardHeightPx
    );
    const ratio = widthPx / heightPx;
    const orientation: RecommendedPhotoSlot["orientation"] =
      ratio > 1.15 ? "landscape" : ratio < 0.87 ? "portrait" : "square";
    const orientationLabel = orientation === "landscape" ? "افقی" : orientation === "portrait" ? "عمودی" : "مربعی";
    return { index, orientation, orientationLabel, widthPx, heightPx };
  });
}

export function getTemplateMeta(id: PictureCardTemplateId): PictureCardTemplateMeta {
  return PICTURE_CARD_TEMPLATES.find((t) => t.id === id) ?? PICTURE_CARD_TEMPLATES[0];
}

export function getLayoutMeta(id: PictureCardLayoutId): PictureCardLayoutMeta {
  return PICTURE_CARD_LAYOUTS.find((l) => l.id === id) ?? PICTURE_CARD_LAYOUTS[0];
}
