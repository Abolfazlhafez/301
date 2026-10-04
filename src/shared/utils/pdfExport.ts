import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type jsPDFType from "jspdf";

/**
 * تبدیل یک عنصر DOM به فایل PDF.
 * به‌جای تولید متن PDF مستقیم (که برای فارسی/RTL نیاز به shaping پیچیده دارد
 * و کتابخانه‌های PDF خالص معمولاً آن را درست انجام نمی‌دهند)، این تابع عنصر را
 * ابتدا به تصویر تبدیل می‌کند (مرورگر خودش فارسی را درست می‌چیند) و سپس
 * تصویر را داخل PDF قرار می‌دهد. این روش تضمین می‌کند متن فارسی دقیقاً همان‌طور
 * که در صفحه دیده می‌شود در PDF هم درست نمایش داده شود.
 *
 * از html-to-image به‌جای html2canvas استفاده می‌شود: html2canvas موتور متنِ
 * خودش را دارد (متن را با canvas بازسازی می‌کند، نه با موتور رندر مرورگر) و
 * این موتور برای فارسی/عربی (حروف چسبان) به‌درستی کار نمی‌کرد — نتیجه‌اش در
 * PDFهای خروجی (گزارش‌های مالی، حساب نیروها و...) متنی کاملاً به‌هم‌ریخته و
 * غیرقابل‌خواندن بود، هرچند خودِ صفحه در مرورگر سالم دیده می‌شد. html-to-image
 * عنصر را با SVG foreignObject سریالایز می‌کند و از موتور رندر خودِ مرورگر
 * استفاده می‌کند، پس شکل‌گیری حروف فارسی هم درست می‌ماند.
 *
 * نکتهٔ کارایی: این کتابخانه‌ها و jsPDF نسبتاً سنگین‌اند و فقط لحظهٔ خروجی
 * گرفتن لازم می‌شوند، نه در بارگذاری اولیهٔ صفحه؛ برای همین این‌جا با
 * import پویا لود می‌شوند تا وزنشان روی زمان باز شدن صفحات گزارش (که این
 * تابع در آن‌ها import می‌شود) اثر نگذارد.
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const [{ toCanvas }, { default: jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

  const canvas = await toCanvas(element, {
    pixelRatio: 1.5,
    backgroundColor: "#ffffff",
    skipFonts: true,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.85);

  const pdfWidth = 210; // A4 عرض به میلی‌متر
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  const pdf = new jsPDF({
    orientation: pdfHeight > pdfWidth ? "portrait" : "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  if (Capacitor.isNativePlatform()) {
    // داخل اپلیکیشن نصب‌شده روی اندروید، pdf.save() (که در پس‌زمینه از لینک
    // دانلود مرورگر استفاده می‌کند) کار نمی‌کند چون WebView مدیریت دانلود ندارد.
    // به‌جای آن، فایل واقعاً در حافظه‌ی داخلی اپ نوشته و از طریق منوی
    // اشتراک‌گذاری بومی سیستم در اختیار کاربر قرار می‌گیرد تا ذخیره/ارسال کند.
    const dataUri = pdf.output("datauristring");
    const base64 = dataUri.split(",")[1] ?? "";
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: filename,
      files: [result.uri],
    });
    return;
  }

  // مرورگر معمولی (مثلاً حالت توسعه با npm run dev): دانلود مستقیم فایل
  pdf.save(filename);
}

async function writeOrSharePdf(pdf: jsPDFType, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const dataUri = pdf.output("datauristring");
    const base64 = dataUri.split(",")[1] ?? "";
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: filename,
      files: [result.uri],
    });
    return;
  }
  pdf.save(filename);
}

/**
 * تبدیل چند عنصر DOM به یک PDF چندصفحه‌ای — هر عنصر دقیقاً یک صفحهٔ A4 کامل
 * می‌شود (بدون برش وسط کارت‌ها). برخلاف exportElementToPdf که یک تصویر طولانی
 * را بر اساس ارتفاع صفحه به‌طور مکانیکی برش می‌زند (و ممکن است دقیقاً وسط یک
 * کارت نیرو رد شود)، این تابع هر صفحه را جداگانه رندر و اضافه می‌کند تا
 * چیدمان هر صفحه (مثلاً چهار کارت نیرو) همیشه سالم و کامل بماند.
 * هر عنصر ورودی باید از قبل دقیقاً به اندازهٔ یک صفحهٔ A4 (210×297mm) باشد.
 */
export async function exportElementsToPdf(elements: HTMLElement[], filename: string): Promise<void> {
  if (elements.length === 0) return;

  const [{ toCanvas }, { default: jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < elements.length; i++) {
    const canvas = await toCanvas(elements[i], {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      skipFonts: true,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
  }

  await writeOrSharePdf(pdf, filename);
}
