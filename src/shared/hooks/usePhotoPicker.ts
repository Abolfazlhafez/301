import { useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
/**
 * تبدیل یک Data URL (مثل "data:image/jpeg;base64,...") به یک File واقعی —
 * دقیقاً همان نوعی که photoService.upload و بقیهٔ کد موجود پروژه انتظار
 * دارند، تا این هوک بدون نیاز به تغییر لایهٔ سرویس در همه‌جا جایگزین شود.
 */
/**
 * تبدیل یک Data URL (مثل "data:image/jpeg;base64,...") به یک File واقعی —
 * دقیقاً همان نوعی که photoService.upload و بقیهٔ کد موجود پروژه انتظار
 * دارند، تا این هوک بدون نیاز به تغییر لایهٔ سرویس در همه‌جا جایگزین شود.
 *
 * export شده تا مستقیماً و بدون نیاز به رندر React قابل تست باشد — این
 * دقیقاً همان بخشی از هوک است که واقعاً منطق (نه صرفاً فراخوانی API) دارد
 * و بیشترین احتمال باگ (تجزیهٔ نادرست هدر، بایت‌های خراب) را در خودش دارد.
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64Data] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  // نکته: اگر Data URL چیزی شبیه "data:;base64,..." باشد (بخش MIME خالی)،
  // خودِ regex همچنان مچ می‌شود ولی گروه گرفته‌شده رشتهٔ خالی است — عملگر
  // ?? فقط null/undefined را جایگزین می‌کند، نه رشتهٔ خالی؛ به همین دلیل
  // این حالت را جداگانه با یک شرط صریح (نه‌فقط ??) بررسی می‌کنیم.
  const extractedMime = mimeMatch?.[1];
  const mimeType = extractedMime && extractedMime.length > 0 ? extractedMime : "image/jpeg";
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const arrayBuffer = new ArrayBuffer(bytes.length);
  new Uint8Array(arrayBuffer).set(bytes);
  return new File([arrayBuffer], filename, { type: mimeType });
}

interface UsePhotoPickerResult {
  /**
   * روی اندروید، منوی بومی «دوربین یا گالری» را باز می‌کند (پلاگین واقعی
   * @capacitor/camera — نه <input type="file"> عمومی WebView). روی وب،
   * به input.click() همان المنت مخفی fallback می‌کند که در JSX این هوک
   * باید رندر شود (رجوع کن به fileInputProps).
   *
   * این دقیقاً پاسخ به الزام صریح پرامپت اصلی است: «مدیریت تصاویر» و
   * «انتخاب فایل» باید از طریق قابلیت‌های Native Android انجام شود، نه
   * صرفاً یک ورودی فایل عمومی مرورگر.
   */
  pickPhoto: (options?: { forceCameraOnly?: boolean }) => Promise<File | null>;
  /** مشابه pickPhoto، اما برای انتخاب چند عکس هم‌زمان از گالری (بدون دوربین). */
  pickMultiplePhotos: () => Promise<File[]>;
  isPicking: boolean;
  /** برای fallback وب — این props را مستقیماً به یک <input type="file" hidden> بدهید. */
  fileInputProps: {
    ref: React.LegacyRef<HTMLInputElement>;
    type: "file";
    accept: string;
    hidden: true;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  /** برای fallback وب مسیر چندعکسی — این props را به یک <input type="file" multiple hidden> بدهید. */
  multiFileInputProps: {
    ref: React.LegacyRef<HTMLInputElement>;
    type: "file";
    accept: string;
    multiple: true;
    hidden: true;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
}

/**
 * هوک مشترک انتخاب عکس، برای همهٔ فرم‌هایی که قبلاً هرکدام جداگانه یک
 * <input type="file"> خام داشتند (رسید دفتر حساب، گالری فعالیت روزانه،
 * یادداشت کار روزانه، آواتار نیرو). روی اندروید واقعی از دوربین/گالری
 * بومی استفاده می‌کند؛ روی وب/توسعه، رفتار قبلی (input فایل مرورگر)
 * دقیقاً حفظ می‌شود — یعنی هیچ چیزی برای توسعه/پیش‌نمایش وب نمی‌شکند.
 */
export function usePhotoPicker(): UsePhotoPickerResult {
  const [isPicking, setIsPicking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webResolveRef = useRef<((file: File | null) => void) | null>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const webResolveMultipleRef = useRef<((files: File[]) => void) | null>(null);

  const pickPhoto = useCallback(async (options?: { forceCameraOnly?: boolean }): Promise<File | null> => {
    if (Capacitor.isNativePlatform()) {
      setIsPicking(true);
      try {
        const photo = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.DataUrl,
          // اگر forceCameraOnly باشد (مثلاً دکمهٔ اختصاصی «گرفتن عکس»)،
          // مستقیم دوربین باز می‌شود؛ در غیر این صورت، منوی انتخاب بین
          // «دوربین» یا «گالری» به کاربر نشان داده می‌شود.
          source: options?.forceCameraOnly ? CameraSource.Camera : CameraSource.Prompt,
          promptLabelHeader: "انتخاب عکس",
          promptLabelPhoto: "انتخاب از گالری",
          promptLabelPicture: "گرفتن عکس",
        });
        if (!photo.dataUrl) return null;
        return dataUrlToFile(photo.dataUrl, `photo-${Date.now()}.jpg`);
      } catch (err) {
        // کاربر انتخاب/دوربین را لغو کرده (رایج‌ترین حالت خطا در این پلاگین) — بی‌صدا null برمی‌گردانیم.
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("cancel")) return null;
        throw err;
      } finally {
        setIsPicking(false);
      }
    }

    // fallback وب: کلیک برنامه‌ای روی input مخفی، و صبر برای رویداد change.
    return new Promise<File | null>((resolve) => {
      webResolveRef.current = resolve;
      fileInputRef.current?.click();
    });
  }, []);

  const handleWebFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    webResolveRef.current?.(file);
    webResolveRef.current = null;
  }, []);

  const pickMultiplePhotos = useCallback(async (): Promise<File[]> => {
    if (Capacitor.isNativePlatform()) {
      setIsPicking(true);
      try {
        const result = await Camera.pickImages({ quality: 85 });
        if (result.photos.length === 0) return [];
        // طبق توصیهٔ رسمی مستندات Capacitor: برای خواندن فایل واقعی، از
        // Filesystem.readFile استفاده نکنید (کل فایل را به‌صورت base64 در
        // حافظه بارگذاری می‌کند که برای چند عکس هم‌زمان می‌تواند اپ را
        // crash کند)؛ به‌جایش از fetch روی webPath استفاده می‌شود که به‌صورت
        // stream عمل می‌کند.
        const files = await Promise.all(
          result.photos.map(async (photo, index) => {
            if (!photo.webPath) return null;
            const response = await fetch(photo.webPath);
            const blob = await response.blob();
            return new File([blob], `photo-${Date.now()}-${index}.jpg`, { type: blob.type || "image/jpeg" });
          })
        );
        return files.filter((f): f is File => f !== null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("cancel")) return [];
        throw err;
      } finally {
        setIsPicking(false);
      }
    }

    return new Promise<File[]>((resolve) => {
      webResolveMultipleRef.current = resolve;
      multiFileInputRef.current?.click();
    });
  }, []);

  const handleWebMultiFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    webResolveMultipleRef.current?.(files);
    webResolveMultipleRef.current = null;
  }, []);

  return {
    pickPhoto,
    pickMultiplePhotos,
    isPicking,
    fileInputProps: {
      ref: fileInputRef,
      type: "file",
      accept: "image/*",
      hidden: true,
      onChange: handleWebFileChange,
    },
    multiFileInputProps: {
      ref: multiFileInputRef,
      type: "file",
      accept: "image/*",
      multiple: true,
      hidden: true,
      onChange: handleWebMultiFileChange,
    },
  };
}
