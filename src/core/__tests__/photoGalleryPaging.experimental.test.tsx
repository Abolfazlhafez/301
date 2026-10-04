/**
 * تست رندر (SSR) رندر تدریجی PhotoGallery: با ۱۳۰ عکس فقط PAGE_SIZE=60 کارت وارد DOM
 * می‌شود و sentinel هست؛ با ≤۶۰ عکس همه رندر می‌شوند و sentinel نیست.
 * محدودیت: SSR افکت‌ها و IntersectionObserver را اجرا نمی‌کند، پس «افزودن دستهٔ بعد» با
 * اسکرول اینجا تست نمی‌شود (نیاز به DOM واقعی/تست دستی).
 */
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { PhotoGallery } from "../../widgets/photo-gallery/PhotoGallery";
import { ToastProvider } from "../../shared/components/ToastProvider";
import type { Photo } from "../../entities/Photo";

let passed = 0;
let failed = 0;
function check(ok: boolean, name: string) {
  if (ok) { passed++; console.log(`  ✅ ${name}`); } else { failed++; console.log(`  ❌ ${name}`); }
}

const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });
const now = "2026-01-01T00:00:00.000Z";
const mkPhoto = (i: number): Photo => ({
  id: `ph${i}`, projectId: "p1", relatedType: "site", relatedId: null, date: "2026-01-01", caption: null,
  filename: `f${i}.jpg`, originalName: `f${i}.jpg`, mimeType: "image/jpeg", fileSize: 1000, createdAt: now,
});

function render(count: number): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["photos", "site", undefined, undefined, undefined, undefined, undefined, undefined, undefined],
    Array.from({ length: count }, (_, i) => mkPhoto(i)));
  return renderToString(
    createElement(QueryClientProvider, { client: qc },
      createElement(ThemeProvider, { theme }, createElement(ToastProvider, null,
        createElement(PhotoGallery, { relatedType: "site" }))))
  );
}
const cards = (html: string) => (html.match(/<li[\s>]/g) ?? []).length;

async function main() {
  await i18n.changeLanguage("fa");
  const big = render(130);
  check(cards(big) === 60, `۱۳۰ عکس ⇒ فقط ۶۰ کارت (دریافت: ${cards(big)})`);
  const exact = render(60);
  check(cards(exact) === 60, `۶۰ عکس ⇒ ۶۰ کارت (دریافت: ${cards(exact)})`);
  const small = render(5);
  check(cards(small) === 5, `۵ عکس ⇒ ۵ کارت (دریافت: ${cards(small)})`);
  const empty = render(0);
  check(cards(empty) === 0, "بدون عکس ⇒ بدون کارت");
  console.log(`\nنتیجه: ${passed} موفق، ${failed} ناموفق`);
  if (failed > 0) process.exit(1);
}
main();
