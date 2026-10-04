import { wf, WageFormulaDefinition } from "./wageFormula";

/**
 * شناسه‌های ثابت (نه UUID تصادفی) برای روش‌های محاسبهٔ داخلی برنامه — چون
 * این‌ها باید بین اجراهای مختلف برنامه و seed مجدد پایدار بمانند تا
 * suggestedWageMethodIds در جدول شغل‌ها همیشه به همان رکورد واقعی اشاره کند.
 */
export const BUILTIN_WAGE_METHOD_IDS = {
  daily: "wm-daily",
  hourly: "wm-hourly",
  perMinute: "wm-per-minute",
  perMeter: "wm-per-meter",
  perSquareMeter: "wm-per-square-meter",
  perCubicMeter: "wm-per-cubic-meter",
  perUnit: "wm-per-unit",
  perKg: "wm-per-kg",
  project: "wm-project",
  // ترکیبی‌های پرکاربرد که در تحقیق واقعی (نرخ‌های رایج بازار) مستند شدند:
  meterMinusWaste: "wm-meter-minus-waste", // متراژ منهای پرت/بریدگی × نرخ (مطابق مثال کاربر: دیوار)
  unitMinusBroken: "wm-unit-minus-broken", // تعداد منهای خراب × نرخ (مطابق مثال کاربر: پله)
  squareMeterWithHeightSurcharge: "wm-sqm-height-surcharge", // مترمربع × نرخ × ضریب ارتفاع (مستند در نرخ بنایی/سنگ‌کاری/سنگ‌کاری نما: افزایش ۲۰-۳۰٪ بالای ۳ متر)
  meterWithHeightSurcharge: "wm-meter-height-surcharge", // متر طول × نرخ × ضریب ارتفاع
  countWithHeight: "wm-count-height", // تعداد × ارتفاع × نرخ (نصب پله/نرده بلند)
} as const;

interface WageMethodSeed {
  id: string;
  formula: WageFormulaDefinition;
}

/**
 * روش‌های پایه — این‌ها Seed اولیهٔ جدول wageMethods هستند، دقیقاً مثل
 * jobTypes قابل ویرایش/کپی/حذف توسط کاربرند؛ این‌جا فقط مقادیر شروع است.
 */
export const BUILTIN_WAGE_METHODS: WageMethodSeed[] = [
  {
    id: BUILTIN_WAGE_METHOD_IDS.daily,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.daily,
      name: "روزمزد",
      description: "دستمزد بر اساس تعداد روز کاری ضرب‌در نرخ روزانه. رایج‌ترین روش برای خرده‌کاری‌ها و کارهایی که اندازه‌گیری دقیق آن‌ها دشوار است.",
      variables: [
        { key: "days", label: "تعداد روز", unit: "روز", defaultValue: 0 },
        { key: "dailyRate", label: "نرخ روزانه", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.v("days"), wf.v("dailyRate")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.hourly,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.hourly,
      name: "ساعتی",
      description: "دستمزد بر اساس تعداد ساعت کار ضرب‌در نرخ هر ساعت.",
      variables: [
        { key: "hours", label: "تعداد ساعت", unit: "ساعت", defaultValue: 0 },
        { key: "hourlyRate", label: "نرخ هر ساعت", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.v("hours"), wf.v("hourlyRate")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.perMinute,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.perMinute,
      name: "دقیقه‌ای",
      description: "دستمزد بر اساس تعداد دقیقهٔ کار مفید ضرب‌در نرخ هر دقیقه — این روش با سیستم ثبت حضور و غیاب کارگاه‌یار هماهنگ است و می‌تواند مستقیماً از زمان مفید محاسبه‌شدهٔ همان روز پر شود.",
      variables: [
        { key: "minutes", label: "تعداد دقیقه (زمان مفید)", unit: "دقیقه", defaultValue: 0 },
        { key: "perMinuteRate", label: "نرخ هر دقیقه", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.v("minutes"), wf.v("perMinuteRate")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.perMeter,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.perMeter,
      name: "بر اساس متر (طول)",
      description: "دستمزد بر اساس طول کار انجام‌شده ضرب‌در نرخ هر متر.",
      variables: [
        { key: "length", label: "طول", unit: "متر", defaultValue: 0 },
        { key: "rate", label: "نرخ هر متر", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.v("length"), wf.v("rate")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.perSquareMeter,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.perSquareMeter,
      name: "بر اساس مترمربع",
      description: "دستمزد بر اساس مساحت کار انجام‌شده ضرب‌در نرخ هر مترمربع — رایج‌ترین روش برای دیوارچینی، کاشی‌کاری، گچ‌کاری و سنگ‌کاری.",
      variables: [
        { key: "area", label: "مساحت", unit: "مترمربع", defaultValue: 0 },
        { key: "rate", label: "نرخ هر مترمربع", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.v("area"), wf.v("rate")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.perCubicMeter,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.perCubicMeter,
      name: "بر اساس مترمکعب",
      description: "دستمزد بر اساس حجم کار انجام‌شده ضرب‌در نرخ هر مترمکعب — مناسب برای بتن‌ریزی و خاکبرداری.",
      variables: [
        { key: "volume", label: "حجم", unit: "مترمکعب", defaultValue: 0 },
        { key: "rate", label: "نرخ هر مترمکعب", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.v("volume"), wf.v("rate")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.perUnit,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.perUnit,
      name: "بر اساس تعداد",
      description: "دستمزد بر اساس تعداد قطعه/واحد انجام‌شده ضرب‌در نرخ هر واحد — مناسب برای نصب پله، درب، پنجره یا قطعات مشابه.",
      variables: [
        { key: "count", label: "تعداد", unit: "عدد", defaultValue: 0 },
        { key: "rate", label: "نرخ هر عدد", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.v("count"), wf.v("rate")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.perKg,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.perKg,
      name: "بر اساس وزن (کیلوگرم)",
      description: "دستمزد بر اساس وزن مصالح مصرفی (مثلاً میلگرد) ضرب‌در نرخ هر کیلوگرم — روش رایج و مستند برای آرماتوربندی، مخصوصاً در فونداسیون‌های سنگین.",
      variables: [
        { key: "weightKg", label: "وزن", unit: "کیلوگرم", defaultValue: 0 },
        { key: "rate", label: "نرخ هر کیلوگرم", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.v("weightKg"), wf.v("rate")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.project,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.project,
      name: "پروژه‌ای / توافقی",
      description: "یک مبلغ ثابت برای کل کار توافق‌شده، صرف‌نظر از زمان یا مقدار دقیق — مناسب برای پروژه‌های بزرگ یا کارهای غیرقابل‌اندازه‌گیری دقیق.",
      variables: [{ key: "fixedAmount", label: "مبلغ توافقی", unit: "تومان", defaultValue: 0 }],
      root: wf.v("fixedAmount"),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.meterMinusWaste,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.meterMinusWaste,
      name: "متراژ منهای پرت",
      description: "از طول کل، مقدار پرت/بریدگی/اجرانشده کسر می‌شود و باقی‌مانده در نرخ هر متر ضرب می‌شود — دقیقاً مطابق نمونهٔ «۲۰ متر دیوار منهای ۲ متر بریدگی».",
      variables: [
        { key: "length", label: "طول کل", unit: "متر", defaultValue: 0 },
        { key: "waste", label: "طول پرت/کسر", unit: "متر", defaultValue: 0 },
        { key: "rate", label: "نرخ هر متر", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.deduct(wf.v("length"), wf.v("waste")), wf.v("rate")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.unitMinusBroken,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.unitMinusBroken,
      name: "تعداد منهای خرابی",
      description: "از تعداد کل، مقدار خراب‌شده/اجرانشده کسر می‌شود و باقی‌مانده در نرخ هر واحد ضرب می‌شود — دقیقاً مطابق نمونهٔ «۳۰ پله منهای ۵ پله خراب».",
      variables: [
        { key: "count", label: "تعداد کل", unit: "عدد", defaultValue: 0 },
        { key: "broken", label: "تعداد خراب/کسر", unit: "عدد", defaultValue: 0 },
        { key: "rate", label: "نرخ هر عدد", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.deduct(wf.v("count"), wf.v("broken")), wf.v("rate")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.squareMeterWithHeightSurcharge,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.squareMeterWithHeightSurcharge,
      name: "مترمربع با ضریب ارتفاع",
      description: "مساحت ضرب‌در نرخ هر مترمربع ضرب‌در یک ضریب افزایشی برای کار در ارتفاع — طبق نرخ‌های مستند بازار، کار بالای ۳ متر معمولاً ۲۰ تا ۳۰ درصد افزایش دستمزد دارد؛ کاربر مقدار دقیق ضریب را خودش تعیین می‌کند (مثلاً ۱ برای بدون افزایش، ۱٫۲۵ برای ۲۵٪ افزایش).",
      variables: [
        { key: "area", label: "مساحت", unit: "مترمربع", defaultValue: 0 },
        { key: "rate", label: "نرخ پایهٔ هر مترمربع", unit: "تومان", defaultValue: 0 },
        { key: "heightFactor", label: "ضریب ارتفاع", unit: "ضریب", defaultValue: 1 },
      ],
      root: wf.mul(wf.mul(wf.v("area"), wf.v("rate")), wf.v("heightFactor")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.meterWithHeightSurcharge,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.meterWithHeightSurcharge,
      name: "متر طول با ضریب ارتفاع",
      description: "طول ضرب‌در نرخ هر متر ضرب‌در یک ضریب افزایشی برای کار در ارتفاع (مثلاً نصب سنگ نما یا نرده در طبقات بالا).",
      variables: [
        { key: "length", label: "طول", unit: "متر", defaultValue: 0 },
        { key: "rate", label: "نرخ پایهٔ هر متر", unit: "تومان", defaultValue: 0 },
        { key: "heightFactor", label: "ضریب ارتفاع", unit: "ضریب", defaultValue: 1 },
      ],
      root: wf.mul(wf.mul(wf.v("length"), wf.v("rate")), wf.v("heightFactor")),
    },
  },
  {
    id: BUILTIN_WAGE_METHOD_IDS.countWithHeight,
    formula: {
      id: BUILTIN_WAGE_METHOD_IDS.countWithHeight,
      name: "تعداد ضرب‌در ارتفاع",
      description: "تعداد واحد ضرب‌در ارتفاع محل اجرا ضرب‌در نرخ — برای کارهایی مثل نصب پله یا قطعات که هزینهٔ هر واحد به ارتفاع محل نصب هم بستگی دارد.",
      variables: [
        { key: "count", label: "تعداد", unit: "عدد", defaultValue: 0 },
        { key: "height", label: "ارتفاع", unit: "متر", defaultValue: 0 },
        { key: "rate", label: "نرخ", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.mul(wf.v("count"), wf.v("height")), wf.v("rate")),
    },
  },
];
