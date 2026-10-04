import { useEffect, useState } from "react";

/**
 * مشاهده‌گر مشترک (یک IntersectionObserver برای هر rootMargin) تا برای صدها عکس
 * صدها observer ساخته نشود.
 */
type Listener = (isIntersecting: boolean, height: number) => void;

interface Shared {
  observer: IntersectionObserver;
  listeners: Map<Element, Listener>;
}

const pool = new Map<string, Shared>();

function getShared(rootMargin: string): Shared {
  let shared = pool.get(rootMargin);
  if (!shared) {
    const listeners = new Map<Element, Listener>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) listeners.get(e.target)?.(e.isIntersecting, e.boundingClientRect.height);
      },
      { rootMargin }
    );
    shared = { observer, listeners };
    pool.set(rootMargin, shared);
  }
  return shared;
}

/** @internal export برای تست/استفادهٔ هوک‌ها. */
export function observeElement(el: Element, rootMargin: string, listener: Listener): () => void {
  if (typeof IntersectionObserver === "undefined") {
    // محیط بدون IntersectionObserver (WebView خیلی قدیمی): همیشه «دیده‌شده» حساب می‌شود.
    listener(true, 0);
    return () => {};
  }
  const shared = getShared(rootMargin);
  shared.listeners.set(el, listener);
  shared.observer.observe(el);
  return () => {
    shared.listeners.delete(el);
    shared.observer.unobserve(el);
  };
}

/**
 * آیا المان (به‌علاوهٔ rootMargin) در محدودهٔ دید است؟ پیش‌فرض false است تا هیچ عکسی
 * قبل از اینکه واقعاً روی صفحه بیاید باز نشود. lastHeight آخرین ارتفاع اندازه‌گیری‌شدهٔ
 * المان در حالت دیده‌شده است (برای حفظ چیدمان وقتی عکس آزاد می‌شود).
 */
export function useInView(el: Element | null, rootMargin = "300px 0px"): { inView: boolean; lastHeight: number } {
  const [state, setState] = useState({ inView: false, lastHeight: 0 });
  useEffect(() => {
    if (!el) return;
    return observeElement(el, rootMargin, (isIntersecting, height) => {
      setState((prev) => {
        const lastHeight = isIntersecting && height > 0 ? height : prev.lastHeight;
        return prev.inView === isIntersecting && prev.lastHeight === lastHeight ? prev : { inView: isIntersecting, lastHeight };
      });
    });
  }, [el, rootMargin]);
  return state;
}
