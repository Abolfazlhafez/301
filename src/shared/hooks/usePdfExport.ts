import { useCallback, useState } from "react";
import { exportElementToPdf, exportElementsToPdf } from "../utils/pdfExport";
import { useToast } from "../components/ToastProvider";

export function usePdfExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  const exportToPdf = useCallback(
    async (elementId: string, filename: string) => {
      const element = document.getElementById(elementId);
      if (!element) {
        showToast("بخش مورد نظر برای خروجی یافت نشد.", "error");
        return;
      }
      setIsExporting(true);
      try {
        await exportElementToPdf(element, filename);
        showToast("فایل PDF با موفقیت ساخته شد.", "success");
      } catch {
        showToast("خطا در ساخت فایل PDF.", "error");
      } finally {
        setIsExporting(false);
      }
    },
    [showToast]
  );

  /** خروجی چندصفحه‌ای دقیق — هر شناسه یک صفحهٔ کامل A4 می‌شود (بدون برش کارت‌ها). */
  const exportPagesToPdf = useCallback(
    async (pageElementIds: string[], filename: string) => {
      const elements = pageElementIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => !!el);

      if (elements.length === 0) {
        showToast("بخش مورد نظر برای خروجی یافت نشد.", "error");
        return;
      }
      setIsExporting(true);
      try {
        await exportElementsToPdf(elements, filename);
        showToast("فایل PDF با موفقیت ساخته شد.", "success");
      } catch {
        showToast("خطا در ساخت فایل PDF.", "error");
      } finally {
        setIsExporting(false);
      }
    },
    [showToast]
  );

  return { exportToPdf, exportPagesToPdf, isExporting };
}
