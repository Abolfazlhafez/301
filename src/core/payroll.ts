/**
 * سرویس محاسبه حقوق - قلب منطق کسب‌وکار برنامه.
 * این نسخه مستقیماً از منطق دامین بک‌اند (PayrollCalculator.ts) پورت شده و
 * کاملاً خالص (Pure) است: هیچ وابستگی به دیتابیس یا فریم‌ورک ندارد.
 */

export const STANDARD_WORK_HOURS_PER_DAY = 8;

/**
 * محاسبه اختلاف زمانی بین دو ساعت (HH:mm) بر حسب دقیقه.
 * اگر ساعت پایان از ساعت شروع کوچکتر باشد (کار شبانه که از نیمه‌شب رد می‌شود)،
 * فرض می‌شود بازه به روز بعد کشیده شده است.
 */
export function calculateMinutesBetween(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;

  if (endTotal < startTotal) {
    endTotal += 24 * 60;
  }

  return endTotal - startTotal;
}

/**
 * چند بازهٔ زمانی (هرکدام startTime/endTime به‌صورت "HH:mm") را با هم جمع
 * می‌زند، اما اگر دو یا چند بازه با هم هم‌پوشانی داشته باشند، آن قسمت
 * مشترک را فقط یک‌بار می‌شمارد.
 *
 * چرا این لازم بود (یافتهٔ بازبینی منطقی، مورد ۵ گروه دوم فهرست کارها):
 * قبلاً `totalTimeLossMinutes` با جمع سادهٔ duration هر رکورد محاسبه
 * می‌شد. اگر کاربر (سرکارگر) به‌اشتباه دو رکورد اتلاف‌وقت با بازهٔ
 * هم‌پوشان ثبت می‌کرد (مثلاً یکی ۱۰:۰۰–۱۱:۰۰ و دیگری ۱۰:۳۰–۱۱:۳۰)، آن نیم
 * ساعت مشترک دوبار کسر می‌شد و `usefulMinutes` — و در نتیجه دستمزد
 * قابل‌پرداخت نیرو — کمتر از واقع محاسبه می‌شد؛ یعنی به ضرر نیرو. این تابع
 * با «ادغام بازه‌های هم‌پوشان» (interval merging) پیش از جمع‌زدن، این
 * مشکل را از ریشه رفع می‌کند. برای بازه‌های بدون هیچ هم‌پوشانی (رایج‌ترین
 * حالت)، نتیجه دقیقاً همان جمع سادهٔ قبلی است — یعنی هیچ رفتار موجودی
 * تغییر نمی‌کند، فقط سناریوی هم‌پوشانی درست می‌شود.
 *
 * عمداً فقط برای اتلاف‌وقت استفاده می‌شود، نه برای نوبت‌های نگهبانی
 * (`calculateGuardDutyPay`) — چون هم‌پوشانی دو نوبت نگهبانی می‌تواند
 * معنای متفاوتی داشته باشد (مثلاً دو نفر هم‌زمان نگهبان) و merge‌کردن
 * خودسرانهٔ آن یک تصمیم کسب‌وکاری جداست، نه یک باگ محاسباتی مشخص.
 */
export function sumNonOverlappingMinutes(intervals: { startTime: string; endTime: string }[]): number {
  if (intervals.length === 0) return 0;

  const normalized = intervals
    .map((iv) => {
      const [startH, startM] = iv.startTime.split(":").map(Number);
      const [endH, endM] = iv.endTime.split(":").map(Number);
      const start = startH * 60 + startM;
      let end = endH * 60 + endM;
      if (end < start) end += 24 * 60; // عبور از نیمه‌شب، دقیقاً مثل calculateMinutesBetween
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);

  let totalMinutes = 0;
  let currentStart = normalized[0].start;
  let currentEnd = normalized[0].end;

  for (let i = 1; i < normalized.length; i++) {
    const next = normalized[i];
    if (next.start <= currentEnd) {
      // هم‌پوشان یا دقیقاً پیوسته با بازهٔ در حال جمع‌شدن: فقط انتهای آن
      // را (در صورت لزوم) گسترش بده، بازهٔ جدید جداگانه اضافه نشود.
      currentEnd = Math.max(currentEnd, next.end);
    } else {
      totalMinutes += currentEnd - currentStart;
      currentStart = next.start;
      currentEnd = next.end;
    }
  }
  totalMinutes += currentEnd - currentStart;

  return totalMinutes;
}

export interface PayrollCalculationInput {
  dailyBaseSalary: number;
  checkIn: string | null;
  checkOut: string | null;
  timeLosses: { startTime: string; endTime: string }[];
  standardWorkHours?: number;
}

export interface PayrollCalculationResult {
  totalAttendanceMinutes: number;
  totalTimeLossMinutes: number;
  usefulMinutes: number;
  hourlyRate: number;
  payableSalary: number;
}

export function calculateDailyPayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const standardWorkHours = input.standardWorkHours ?? STANDARD_WORK_HOURS_PER_DAY;

  const totalAttendanceMinutes =
    input.checkIn && input.checkOut ? calculateMinutesBetween(input.checkIn, input.checkOut) : 0;

  const totalTimeLossMinutes = sumNonOverlappingMinutes(input.timeLosses);

  const usefulMinutes = Math.max(0, totalAttendanceMinutes - totalTimeLossMinutes);

  const hourlyRate = standardWorkHours > 0 ? input.dailyBaseSalary / standardWorkHours : 0;

  const payableSalary = Math.round((usefulMinutes / 60) * hourlyRate);

  return {
    totalAttendanceMinutes,
    totalTimeLossMinutes,
    usefulMinutes,
    hourlyRate: Math.round(hourlyRate),
    payableSalary,
  };
}

export function formatMinutesToHoursText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} دقیقه`;
  if (m === 0) return `${h} ساعت`;
  return `${h} ساعت و ${m} دقیقه`;
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeFormat(value: string): boolean {
  return TIME_REGEX.test(value);
}

// --- محاسبه دستمزد نگهبانی ---
// دستمزد نگهبانی کاملاً مستقل از حقوق روزانه عادی محاسبه می‌شود و نرخ آن
// می‌تواند ساعتی یا بر اساس تعداد نوبت باشد.

export type GuardDutyRateType = "hourly" | "shift";

export interface GuardDutyCalculationInput {
  shifts: { startTime: string; endTime: string }[];
  rateType: GuardDutyRateType;
  /** نرخ: تومان به ازای هر ساعت (rateType='hourly') یا تومان به ازای هر نوبت (rateType='shift'). */
  rate: number;
}

export interface GuardDutyCalculationResult {
  totalMinutes: number;
  shiftsCount: number;
  payableAmount: number;
}

export function calculateGuardDutyPay(input: GuardDutyCalculationInput): GuardDutyCalculationResult {
  const totalMinutes = input.shifts.reduce(
    (sum, shift) => sum + calculateMinutesBetween(shift.startTime, shift.endTime),
    0
  );
  const shiftsCount = input.shifts.length;

  const payableAmount =
    input.rateType === "hourly"
      ? Math.round((totalMinutes / 60) * input.rate)
      : Math.round(shiftsCount * input.rate);

  return { totalMinutes, shiftsCount, payableAmount };
}
