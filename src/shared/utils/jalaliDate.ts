import {
  format as formatJalali,
  startOfMonth as startOfMonthJalali,
  endOfMonth as endOfMonthJalali,
  getYear as getYearJalali,
  getMonth as getMonthJalali,
  getDay,
  getDaysInMonth as getDaysInMonthJalali,
  setYear as setYearJalali,
  setMonth as setMonthJalali,
  setDate as setDateJalali,
  addMonths as addMonthsJalali,
} from "date-fns-jalali";
import i18n from "../i18n";
import { getCalendarLocale } from "../i18n/calendarLocales";

/**
 * این فایل نمایش تاریخ را برای کل اپ فراهم می‌کند و به‌صورت خودکار بین دو
 * تقویم سوییچ می‌کند: **شمسی (جلالی)** وقتی زبان فعال فارسی است، و
 * **میلادی (گرگوری)** برای هر ۷ زبان دیگر — دقیقاً مطابق تصمیمی که هنگام
 * افزودن چندزبانگی گرفته شد. نام همهٔ توابع صادرشده عمداً تغییر نکرده
 * (هنوز toJalaliDisplay و مانند آن) چون ده‌ها فایل دیگر در پروژه همین
 * نام‌ها را import می‌کنند؛ تغییر واقعی فقط در *پیاده‌سازی داخلی* است.
 */

function isJalaliActive(): boolean {
  return (i18n.language ?? "fa") === "fa";
}

/**
 * تاریخ امروز به فرمت YYYY-MM-DD **محلی** (نه UTC).
 *
 * نکته مهم: `Date.toISOString()` همیشه بر اساس UTC است، نه منطقهٔ زمانی
 * دستگاه. برای ایران (UTC+3:30) این یعنی بین ساعت ۰۰:۰۰ تا ۰۳:۳۰ بامداد،
 * toISOString() هنوز «دیروز» را برمی‌گرداند در حالی که از نظر کاربر همان
 * روزِ جدید شروع شده است. برای همین همیشه از اجزای محلی تاریخ
 * (getFullYear/getMonth/getDate) استفاده می‌کنیم، نه UTC.
 */
export function getTodayIso(): string {
  return toLocalIso(new Date());
}

/** تبدیل یک شیء Date به رشتهٔ YYYY-MM-DD بر اساس تاریخ **محلی** آن (نه UTC). */
export function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * نمایش تاریخ میلادی (YYYY-MM-DD) به‌صورت خوانا، مطابق تقویم زبان فعلی:
 * «۱۲ مرداد ۱۴۰۳» برای فارسی (شمسی)، «12 August 2024» برای بقیه زبان‌ها (میلادی).
 */
export function toJalaliDisplay(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isJalaliActive()) return formatJalali(date, "d MMMM yyyy");
    const locale = getCalendarLocale(i18n.language);
    return `${date.getDate()} ${locale.months[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return isoDate;
  }
}

/**
 * نمایش کوتاه تاریخ به فرمت عددی، مثل «۱۴۰۳/۰۵/۱۲» (شمسی) یا «2024/08/12» (میلادی).
 */
export function toJalaliShort(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isJalaliActive()) return formatJalali(date, "yyyy/MM/dd");
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  } catch {
    return isoDate;
  }
}

/**
 * فقط نام روز هفته (مثل «دوشنبه» یا «Monday»)، همیشه محاسبه‌شده از خود
 * تاریخ (نه ورودی جداگانه) تا هیچ‌وقت با تاریخ واقعی ناهماهنگ نشود.
 */
export function getWeekdayLabel(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isJalaliActive()) return formatJalali(date, "EEEE");
    return getCalendarLocale(i18n.language).weekdays[date.getDay()];
  } catch {
    return "";
  }
}

/**
 * تاریخ همراه با روز هفته، مثل «دوشنبه | ۲۵ مرداد ۱۴۰۵» یا «Monday | 12 August 2024».
 * روز هفته همیشه به‌صورت خودکار از خود تاریخ محاسبه می‌شود.
 */
export function toJalaliWithWeekday(isoDate: string): string {
  try {
    return `${getWeekdayLabel(isoDate)} | ${toJalaliDisplay(isoDate)}`;
  } catch {
    return toJalaliDisplay(isoDate);
  }
}

/**
 * تفاوت روزها بین دو تاریخ ISO (میلادی)، بدون در نظر گرفتن ساعت.
 * مثبت یعنی تاریخ دوم بعد از اولی است.
 */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = new Date(fromIso.slice(0, 10));
  const to = new Date(toIso.slice(0, 10));
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

/** افزودن تعداد روز به یک تاریخ ISO و بازگرداندن نتیجه به‌صورت ISO (محلی، نه UTC). */
export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(isoDate.slice(0, 10));
  date.setDate(date.getDate() + days);
  return toLocalIso(date);
}

/** افزودن تعداد ماه (شمسی یا میلادی، بسته به زبان فعلی) به یک تاریخ ISO. */
export function addJalaliMonthsIso(isoDate: string, months: number): string {
  const date = new Date(isoDate.slice(0, 10));
  if (isJalaliActive()) return toLocalIso(addMonthsJalali(date, months));
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return toLocalIso(result);
}

/**
 * برچسب نسبی و خوانا برای یک تاریخ نسبت به امروز، مناسب فهرست فعالیت‌های آینده:
 * «امروز»، «فردا»، «۲ روز آینده»، نام روز هفته (تا یک هفته)، یا تاریخ کامل.
 * برای تاریخ‌های گذشته، «سررسید گذشته» برمی‌گرداند.
 */
export function getRelativeDayLabel(isoDate: string, todayIso?: string): string {
  const today = todayIso ?? getTodayIso();
  const diff = daysBetweenIso(today, isoDate);
  const locale = isJalaliActive() ? null : getCalendarLocale(i18n.language);

  if (diff < 0) return locale ? locale.overdue : "سررسید گذشته";
  if (diff === 0) return locale ? locale.today : "امروز";
  if (diff === 1) return locale ? locale.tomorrow : "فردا";
  if (diff === 2) return locale ? locale.twoDaysAhead : "۲ روز آینده";
  if (diff <= 6) return getWeekdayLabel(isoDate) || toJalaliDisplay(isoDate);
  return toJalaliDisplay(isoDate);
}

/** برچسب متنی «امروز»، مطابق زبان فعلی — برای مقایسه با خروجی getRelativeDayLabel/getHistoryDayLabel. */
export function getTodayLabelText(): string {
  return isJalaliActive() ? "امروز" : getCalendarLocale(i18n.language).today;
}

/** برچسب متنی «سررسید گذشته»، مطابق زبان فعلی — برای مقایسه با خروجی getRelativeDayLabel. */
export function getOverdueLabelText(): string {
  return isJalaliActive() ? "سررسید گذشته" : getCalendarLocale(i18n.language).overdue;
}

/**
 * نسخه‌ی ریزتر برچسب نسبی، مخصوص نمایش «تاریخچه» — برخلاف getRelativeDayLabel
 * که همه‌ی روزهای گذشته را در یک سطل «سررسید گذشته» جمع می‌کند (مناسب برای
 * دیدِ اقدام‌محور)، این نسخه هر روز گذشته را جداگانه («دیروز»، «۲ روز پیش»،
 * نام روز هفته، سپس تاریخ کامل) نشان می‌دهد تا تاریخچه قابل مرور و پیگیری باشد.
 */
export function getHistoryDayLabel(isoDate: string, todayIso?: string): string {
  const today = todayIso ?? getTodayIso();
  const diff = daysBetweenIso(today, isoDate);
  const locale = isJalaliActive() ? null : getCalendarLocale(i18n.language);

  if (diff === 0) return locale ? locale.today : "امروز";
  if (diff === -1) return locale ? locale.yesterday : "دیروز";
  if (diff === -2) return locale ? locale.twoDaysAgo : "۲ روز پیش";
  if (diff < -2 && diff >= -6) return getWeekdayLabel(isoDate) || toJalaliDisplay(isoDate);
  return toJalaliDisplay(isoDate);
}

/**
 * برچسب «نام ماه و سال» برای یک تاریخ مرجع، مطابق تقویم زبان فعلی
 * («مرداد ۱۴۰۳» برای فارسی، «August 2024» برای بقیه زبان‌ها).
 */
export function getMonthYearLabel(referenceIsoDate: string): string {
  const date = new Date(referenceIsoDate);
  if (isJalaliActive()) return formatJalali(date, "MMMM yyyy");
  const locale = getCalendarLocale(i18n.language);
  return `${locale.months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * محاسبه بازه شروع و پایان ماهِ جاری (شمسی یا میلادی، بسته به زبان) بر
 * اساس تاریخ میلادی داده‌شده، به فرمت ISO (YYYY-MM-DD) برای استفاده در
 * فیلتر گزارش ماهانه (محلی، نه UTC).
 */
export function getCurrentJalaliMonthRange(referenceIsoDate?: string): {
  from: string;
  to: string;
  label: string;
} {
  const date = referenceIsoDate ? new Date(referenceIsoDate) : new Date();

  if (isJalaliActive()) {
    const from = startOfMonthJalali(date);
    const to = endOfMonthJalali(date);
    return { from: toLocalIso(from), to: toLocalIso(to), label: formatJalali(date, "MMMM yyyy") };
  }

  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const locale = getCalendarLocale(i18n.language);
  return {
    from: toLocalIso(from),
    to: toLocalIso(to),
    label: `${locale.months[date.getMonth()]} ${date.getFullYear()}`,
  };
}

/**
 * تاریخ شروع هفتهٔ همان هفته‌ای که تاریخ مرجع در آن قرار دارد. برای فارسی
 * (تقویم شمسی) هفته از شنبه شروع می‌شود؛ برای بقیهٔ زبان‌ها (تقویم میلادی)
 * از یکشنبه — مطابق استاندارد JavaScript getDay() — تا نیازی به تبدیل
 * جداگانه نباشد.
 */
export function getWeekStartIso(referenceIsoDate: string): string {
  const date = new Date(referenceIsoDate.slice(0, 10));
  const jsWeekday = getDay(date); // 0=یکشنبه ... 6=شنبه (استاندارد جاوااسکریپت)

  if (isJalaliActive()) {
    const persianWeekday = (jsWeekday + 1) % 7; // تبدیل به هفته فارسی: 0=شنبه ... 6=جمعه
    return addDaysIso(toLocalIso(date), -persianWeekday);
  }
  return addDaysIso(toLocalIso(date), -jsWeekday);
}

/** آرایهٔ ۷ تاریخ ISO یک هفته (شنبه تا جمعه برای فارسی، یکشنبه تا شنبه برای بقیه) که تاریخ مرجع در آن قرار دارد. */
export function getWeekDatesIso(referenceIsoDate: string): string[] {
  const start = getWeekStartIso(referenceIsoDate);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));
}

/** آرایهٔ تمام تاریخ‌های ISO یک ماه (شمسی یا میلادی) که تاریخ مرجع در آن قرار دارد. */
export function getMonthDatesIso(referenceIsoDate: string): string[] {
  const params = getJalaliMonthCalendarParams(referenceIsoDate);
  return Array.from({ length: params.daysInMonth }, (_, i) => params.dateForDay(i + 1));
}

/**
 * پارامترهای لازم برای رسم گرید تقویم ماهانه (شمسی یا میلادی) بر اساس یک
 * تاریخ مرجع میلادی. startWeekdayIndex برای فارسی بر اساس هفته فارسی است
 * (۰=شنبه ... ۶=جمعه)، برای بقیه زبان‌ها بر اساس هفته میلادی (۰=یکشنبه).
 */
export function getJalaliMonthCalendarParams(referenceIsoDate: string): {
  year: number;
  month: number;
  daysInMonth: number;
  startWeekdayIndex: number;
  dateForDay: (day: number) => string;
} {
  const date = new Date(referenceIsoDate);

  if (isJalaliActive()) {
    const year = getYearJalali(date);
    const month = getMonthJalali(date);
    const firstOfMonth = startOfMonthJalali(date);
    const daysInMonth = getDaysInMonthJalali(date);
    const jsWeekday = getDay(firstOfMonth);
    const startWeekdayIndex = (jsWeekday + 1) % 7;

    function dateForDay(day: number): string {
      let d = new Date(firstOfMonth);
      d = setYearJalali(d, year);
      d = setMonthJalali(d, month);
      d = setDateJalali(d, day);
      return toLocalIso(d);
    }

    return { year, month, daysInMonth, startWeekdayIndex, dateForDay };
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekdayIndex = firstOfMonth.getDay();

  function dateForDay(day: number): string {
    return toLocalIso(new Date(year, month, day));
  }

  return { year, month, daysInMonth, startWeekdayIndex, dateForDay };
}
