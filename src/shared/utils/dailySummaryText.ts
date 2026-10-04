import type { DashboardSummary } from "../../entities/Report";
import { formatCurrencyFa, formatMinutesToText } from "./format";
import { toJalaliWithWeekday } from "./jalaliDate";

export interface DailySummaryWorkLogInfo {
  /** تعداد عکس‌های ثبت‌شده در «گزارش کار» همین تاریخ. */
  workLogPhotosCount: number;
  /** توضیحات متنی «گزارش کار» همین تاریخ، در صورت وجود. */
  workLogDescription: string | null;
}

/**
 * تبدیل خلاصهٔ داشبورد امروز به یک متن ساده و خوانا، مناسب کپی و ارسال
 * سریع در واتس‌اپ/تلگرام (مثلاً برای اطلاع‌رسانی به کارفرما یا پیمانکار
 * اصلی) — بدون نیاز به باز کردن گزارش کامل یا خروجی PDF.
 *
 * اگر اطلاعات «گزارش کار» (عکس/توضیح ثبت‌شده در تب گزارش کار) پاس داده
 * شود، وضعیت آن هم به‌صورت یک خط اضافه در متن گنجانده می‌شود؛ چون گیرندهٔ
 * پیام (کارفرما/پیمانکار) معمولاً می‌خواهد بداند آیا امروز گزارش تصویری
 * هم ثبت شده یا نه، بدون باز کردن جداگانهٔ اپ.
 */
export function buildDailySummaryText(
  todayIso: string,
  summary: DashboardSummary,
  workLog?: DailySummaryWorkLogInfo
): string {
  const lines = [
    `📋 خلاصهٔ وضعیت کارگاه — ${toJalaliWithWeekday(todayIso)}`,
    "",
    `👷 نیروهای حاضر: ${summary.presentWorkersCount} نفر`,
    `❌ نیروهای غایب: ${summary.absentWorkersCount} نفر`,
    `⏱ مجموع ساعات کار: ${formatMinutesToText(summary.totalWorkedMinutesToday)}`,
    `⏳ مجموع اتلاف وقت: ${formatMinutesToText(summary.totalTimeLossMinutesToday)}`,
    `💰 مبلغ حقوق امروز: ${formatCurrencyFa(summary.totalPayableSalaryToday)}`,
  ];

  if (workLog) {
    const hasWorkLog = workLog.workLogPhotosCount > 0 || !!workLog.workLogDescription?.trim();
    lines.push(
      hasWorkLog
        ? `📷 گزارش کار امروز: ${workLog.workLogPhotosCount} عکس ثبت شده`
        : "📷 گزارش کار امروز: هنوز ثبت نشده"
    );
    if (workLog.workLogDescription?.trim()) {
      lines.push(`📝 ${workLog.workLogDescription.trim()}`);
    }
  }

  return lines.join("\n");
}
