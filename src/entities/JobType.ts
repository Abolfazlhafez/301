import type { WageFormulaDefinition } from "../core/wageFormula";

/**
 * دسته‌بندی کلی شغل‌های ساختمانی — برای گروه‌بندی در فهرست انتخاب شغل، نه
 * برای منطق محاسبه (منطق محاسبه کاملاً در خودِ WageMethod/WageFormula است).
 */
export type JobCategory =
  | "structure" // اسکلت و سازه (آرماتوربند، قالب‌بند، بتن‌کار، جوشکار...)
  | "masonry" // بنایی و دیوارچینی (بنا، دیوارچین، بلوک‌چین...)
  | "finishing" // نازک‌کاری (گچ‌کار، سفیدکار، نقاش، کناف‌کار...)
  | "flooring" // کف و پوشش (کاشی‌کار، سرامیک‌کار، سنگ‌کار، پارکت‌کار...)
  | "mep" // تأسیسات مکانیکی/برقی (برق‌کار، لوله‌کش...)
  | "installation" // نصب و اجرای اجزا (نصاب در/پنجره، کابینت‌کار، آسانسور...)
  | "sitework" // کارهای عمومی کارگاه (داربست‌بند، تخریب‌کار، حمل مصالح، نگهبان...)
  | "other";

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  structure: "اسکلت و سازه",
  masonry: "بنایی و دیوارچینی",
  finishing: "نازک‌کاری",
  flooring: "کف و پوشش",
  mep: "تأسیسات",
  installation: "نصب و اجرا",
  sitework: "عمومی کارگاه",
  other: "سایر",
};

/**
 * یک تیپ نیرو/شغل (مثلاً «بنا»، «جوشکار اسکلت»). این خودِ یک رکورد نیرو
 * نیست — چند نیروی واقعی می‌توانند تیپ یکسان داشته باشند ولی هرکدام روش
 * پرداخت مستقل خودشان را انتخاب کنند (رجوع کن به WageAssignment).
 */
export interface JobType {
  id: string;
  name: string;
  description: string;
  category: JobCategory;
  /** نام فایل آیکون SVG اختصاصی (بدون پسوند و مسیر) — از پوشهٔ آیکون‌های شغل خوانده می‌شود. */
  iconKey: string;
  /** شناسهٔ روش‌های محاسبهٔ پیشنهادی برای این شغل (اشاره به WageMethod.id) — کاربر هنگام انتخاب این شغل، این‌ها را به‌عنوان گزینه‌های پیش‌فرض می‌بیند. */
  suggestedWageMethodIds: string[];
  /** توضیح کوتاه دربارهٔ این‌که دستمزد این شغل معمولاً چطور محاسبه می‌شود (متن، نه فرمول). */
  wageNote: string;
  /** true برای ۵۰ شغل پیش‌فرض داخل برنامه؛ false برای تیپ‌های ساخته‌شده توسط کاربر. */
  isBuiltIn: boolean;
  /** اگر کاربر یک تیپ پیش‌فرض را ویرایش کرده باشد، نسخهٔ اصلی این‌جا نگه داشته می‌شود تا «بازگردانی به پیش‌فرض» ممکن باشد. */
  originalSnapshot?: Omit<JobType, "id" | "isBuiltIn" | "originalSnapshot"> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobTypeInput {
  name: string;
  description: string;
  category: JobCategory;
  iconKey: string;
  suggestedWageMethodIds?: string[];
  wageNote?: string;
}

export interface UpdateJobTypeInput {
  name?: string;
  description?: string;
  category?: JobCategory;
  iconKey?: string;
  suggestedWageMethodIds?: string[];
  wageNote?: string;
}

/**
 * یک «روش محاسبهٔ دستمزد» — یک فرمول کامل با متغیرها، قابل استفاده برای
 * چند شغل مختلف (مثلاً «مترمربع × نرخ» هم برای گچ‌کار و هم برای کاشی‌کار
 * قابل استفاده است). این جدول همان WageFormulaDefinition است، فقط با یک
 * پوستهٔ اضافه (isBuiltIn/originalSnapshot) برای مدیریت در دیتابیس.
 */
export interface WageMethod {
  id: string;
  formula: WageFormulaDefinition;
  isBuiltIn: boolean;
  originalSnapshot?: WageFormulaDefinition | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWageMethodInput {
  formula: WageFormulaDefinition;
}

export interface UpdateWageMethodInput {
  formula: WageFormulaDefinition;
}
