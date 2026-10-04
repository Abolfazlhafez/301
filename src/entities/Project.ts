/**
 * یک «پروژه/کارگاه» — واحد بالادستی که (در نسخه‌های بعدی) طبقات، نیروها،
 * دفتر حساب و بقیهٔ داده‌ها به آن تعلق خواهند داشت.
 *
 * وضعیت فعلی (صادقانه): این نسخهٔ اول فقط خودِ مفهوم Project و امکان
 * ساخت/سوییچ بین چند پروژه را اضافه می‌کند. داده‌های موجود (طبقات، نیروها،
 * دفتر حساب، حضور و غیاب و...) هنوز به‌صورت سراسری (بدون projectId) ذخیره
 * می‌شوند — یعنی همچنان بین همهٔ پروژه‌ها مشترک‌اند. تفکیک کامل داده‌ای
 * (افزودن projectId به هر جدول + فیلتر در هر سرویس) قدم بعدی است و در این
 * مرحله عمداً انجام نشده، چون بدون امکان تست واقعی روی دستگاه، ریسک از دست
 * رفتن/قاطی‌شدن دادهٔ کاربر واقعی داشت.
 */
export interface Project {
  id: string;
  name: string;
  location: string;
  supervisorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  location?: string;
  supervisorName?: string;
}

export interface UpdateProjectInput {
  name?: string;
  location?: string;
  supervisorName?: string;
}
