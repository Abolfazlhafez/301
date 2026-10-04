import { useEffect, useState } from "react";
import { ensurePhotoThumbnail, getPhotoThumbUrl, getPhotoUrl } from "../api/photosApi";
import { useInView } from "./useInView";

/** تصویر شفاف ۱×۱؛ المان <img> همیشه سر جایش می‌ماند ولی هیچ عکسی decode نمی‌کند. */
export const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export interface LazyPhotoSrc {
  /** callback ref؛ باید روی المان <img> (یا هر المانی که اندازهٔ تصویر را دارد) گذاشته شود. */
  ref: (el: Element | null) => void;
  /** آدرس واقعی فقط وقتی عکس در/نزدیک دید است؛ در غیر این صورت TRANSPARENT_PIXEL. */
  src: string;
  /** true یعنی هنوز عکسی نشان داده نمی‌شود (در انتظار ساخت پیش‌نمایش یا خارج از دید). */
  isPlaceholder: boolean;
  /** آخرین ارتفاع شناخته‌شده؛ برای minHeight هنگام آزادسازی تا چیدمان نپرد. */
  minHeight: number | undefined;
}

/**
 * سیاست حافظه برای لیست‌ها:
 *  1. تا وقتی عکس به دید نزدیک نشده، هیچ‌چیز بارگذاری نمی‌شود.
 *  2. در دید فقط «پیش‌نمایش کم‌حجم» نمایش داده می‌شود (اگر نبود، در پس‌زمینه ساخته می‌شود).
 *  3. وقتی از دید دور شد، src برداشته می‌شود تا مرورگر حافظهٔ decode‌شده را آزاد کند.
 *  4. فقط اگر ساخت پیش‌نمایش ناممکن بود (مثلاً WebView بدون canvas)، عکس اصلی نشان داده می‌شود
 *     — آن هم فقط تا وقتی در دید است.
 * عکس اصلی با کلیک (لایت‌باکس) باز می‌شود.
 */
export function useLazyPhotoSrc(photo: { id?: string; filename: string }, rootMargin = "300px 0px"): LazyPhotoSrc {
  const [el, setEl] = useState<Element | null>(null);
  const { inView, lastHeight } = useInView(el, rootMargin);
  const [thumb, setThumb] = useState(() => getPhotoThumbUrl(photo.filename));
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const { id: photoId, filename } = photo;
  const key = `${photoId ?? ""}|${filename}`;
  const failed = failedKey === key;

  // اگر هوک برای عکس دیگری استفاده شد، وضعیت را از کش دوباره بخوان.
  useEffect(() => {
    setThumb(getPhotoThumbUrl(filename));
  }, [filename]);

  useEffect(() => {
    if (!filename || !inView || thumb || failed) return;
    let alive = true;
    void ensurePhotoThumbnail({ id: photoId, filename }, () => alive).then((url) => {
      if (!alive) return; // از دید رفته؛ شکست حساب نمی‌شود
      if (url) setThumb(url);
      else setFailedKey(key);
    });
    return () => {
      alive = false;
    };
  }, [inView, thumb, failed, key, photoId, filename]);

  let src = TRANSPARENT_PIXEL;
  if (inView) {
    if (thumb) src = thumb;
    else if (failed) src = getPhotoUrl(filename) || TRANSPARENT_PIXEL;
  }
  return {
    ref: setEl,
    src,
    isPlaceholder: src === TRANSPARENT_PIXEL,
    minHeight: !inView && lastHeight > 0 ? lastHeight : undefined,
  };
}
