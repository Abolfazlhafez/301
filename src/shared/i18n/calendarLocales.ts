/**
 * نام ماه‌ها/روزهای هفته (تقویم میلادی) و برچسب‌های نسبی روز («امروز»،
 * «فردا» و ...) برای هر ۷ زبان غیرفارسی. فارسی نیازی به این فایل ندارد،
 * چون date-fns-jalali خودش نام‌های شمسی را می‌دهد.
 *
 * ترتیب WEEKDAYS همیشه یکشنبه-محور است (اندیس ۰ = یکشنبه)، مطابق
 * Date.prototype.getDay() جاوااسکریپت، تا نیازی به تبدیل جداگانه نباشد.
 */
import { LanguageCode } from "./languages";

export interface CalendarLocale {
  months: string[];
  weekdays: string[];
  today: string;
  tomorrow: string;
  yesterday: string;
  twoDaysAhead: string;
  twoDaysAgo: string;
  overdue: string;
}

type GregorianLanguageCode = Exclude<LanguageCode, "fa">;

export const CALENDAR_LOCALES: Record<GregorianLanguageCode, CalendarLocale> = {
  en: {
    months: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    today: "Today",
    tomorrow: "Tomorrow",
    yesterday: "Yesterday",
    twoDaysAhead: "In 2 days",
    twoDaysAgo: "2 days ago",
    overdue: "Overdue",
  },
  ar: {
    months: [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ],
    weekdays: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
    today: "اليوم",
    tomorrow: "غداً",
    yesterday: "أمس",
    twoDaysAhead: "بعد يومين",
    twoDaysAgo: "قبل يومين",
    overdue: "متأخر عن موعده",
  },
  tr: {
    months: [
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
    ],
    weekdays: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
    today: "Bugün",
    tomorrow: "Yarın",
    yesterday: "Dün",
    twoDaysAhead: "2 gün sonra",
    twoDaysAgo: "2 gün önce",
    overdue: "Süresi geçti",
  },
  ur: {
    months: [
      "جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون",
      "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر",
    ],
    weekdays: ["اتوار", "پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ"],
    today: "آج",
    tomorrow: "کل",
    yesterday: "گذشتہ کل",
    twoDaysAhead: "2 دن بعد",
    twoDaysAgo: "2 دن پہلے",
    overdue: "میعاد گزر گئی",
  },
  ku: {
    months: [
      "ژانویە", "فێبروەری", "مارس", "ئەپریل", "مەی", "ژوئەن",
      "ژوئیە", "ئۆگست", "سێپتەمبەر", "ئۆکتۆبەر", "نۆڤەمبەر", "دیسەمبەر",
    ],
    weekdays: ["یەکشەممە", "دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی", "شەممە"],
    today: "ئەمڕۆ",
    tomorrow: "سبەی",
    yesterday: "دوێنێ",
    twoDaysAhead: "٢ ڕۆژی داهاتوو",
    twoDaysAgo: "٢ ڕۆژ لەمەوبەر",
    overdue: "کاتی تێپەڕیوە",
  },
  ps: {
    months: [
      "جنوري", "فبروري", "مارچ", "اپریل", "می", "جون",
      "جولای", "اګست", "سپتمبر", "اکتوبر", "نومبر", "دسمبر",
    ],
    weekdays: ["یکشنبه", "دوشنبه", "سه‌شنبه", "چارشنبه", "پنجشنبه", "جمعه", "شنبه"],
    today: "نن",
    tomorrow: "سبا",
    yesterday: "پرون",
    twoDaysAhead: "٢ ورځې وروسته",
    twoDaysAgo: "٢ ورځې مخکې",
    overdue: "نیټه تېره شوې",
  },
  ru: {
    months: [
      "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
      "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
    ],
    weekdays: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
    today: "Сегодня",
    tomorrow: "Завтра",
    yesterday: "Вчера",
    twoDaysAhead: "Через 2 дня",
    twoDaysAgo: "2 дня назад",
    overdue: "Просрочено",
  },
};

export function getCalendarLocale(lang: string): CalendarLocale {
  return CALENDAR_LOCALES[lang as GregorianLanguageCode] ?? CALENDAR_LOCALES.en;
}
