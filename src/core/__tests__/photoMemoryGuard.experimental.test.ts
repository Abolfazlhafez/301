/**
 * محافظ رگرسیون حافظه: عکس اصلی (کیفیت کامل) نباید در لیست/گرید/آواتار باز شود.
 * اگر کسی دوباره `<img src={getPhotoUrl(...)}>` در یک لیست بگذارد، چند ده مگابایت RAM
 * به‌ازای هر عکس مصرف می‌شود و WebView می‌میرد. پس:
 *   ۱) استفادهٔ مستقیم از getPhotoUrl داخل src فقط در فایل‌های فهرست‌شده مجاز است
 *      (نمای بزرگ/خروجی گرفتن)، بقیه باید PhotoThumbImg / SafePhotoImage / LazyPhotoAvatar بگیرند.
 *   ۲) quality="full" فقط در لایت‌باکس.
 *   ۳) هوک دید: پیش‌فرض «خارج از دید» است تا هیچ عکسی قبل از دیده‌شدن باز نشود.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

// فایل‌هایی که عمداً عکس کامل می‌خواهند (با دلیل).
const FULL_SRC_ALLOWED: Record<string, string> = {
  "shared/components/SafePhotoImage.tsx": "حالت quality=\"full\" (فقط لایت‌باکس)",
  "widgets/floor-notebook/FloorDocsTab.tsx": "نمایش نقشهٔ طبقه — یک تصویر، کاربر صراحتاً نقشه را باز کرده",
  "widgets/floor-notebook/FloorExportSummary.tsx": "خروجی (export) با کیفیت کامل",
};

let failed = 0;
function check(cond: boolean, name: string, extra?: unknown) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failed++;
    console.log(`  ❌ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}

/** کامنت‌ها را حذف می‌کند تا مثال‌های داخل توضیحات به‌عنوان استفادهٔ واقعی شمرده نشوند. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const files = walk(ROOT);
const rel = (f: string) => relative(ROOT, f).split("\\").join("/");

console.log("— عکس کامل فقط جاهای مجاز —");
const offenders: string[] = [];
for (const f of files.filter((x) => x.endsWith(".tsx"))) {
  const src = stripComments(readFileSync(f, "utf8"));
  if (/\bsrc=\{[^}]*getPhotoUrl\(/.test(src) && !(rel(f) in FULL_SRC_ALLOWED)) offenders.push(rel(f));
}
check(offenders.length === 0, "هیچ لیست/کاشی‌ای عکس اصلی را مستقیم در src نمی‌گذارد", offenders);

console.log("— quality=\"full\" فقط در لایت‌باکس —");
const fullUsers = files.filter((f) => f.endsWith(".tsx") && /quality=["']full["']/.test(stripComments(readFileSync(f, "utf8")))).map(rel);
check(
  JSON.stringify(fullUsers) === JSON.stringify(["widgets/photo-gallery/PhotoLightbox.tsx"]),
  "quality=\"full\" فقط توسط PhotoLightbox استفاده شده",
  fullUsers
);

console.log("— هوک دید: پیش‌فرض خارج از دید —");
const inViewSrc = readFileSync(join(ROOT, "shared/hooks/useInView.ts"), "utf8");
check(/useState\(\{\s*inView:\s*false/.test(inViewSrc), "state اولیهٔ useInView برابر inView:false است (قبل از دیده‌شدن هیچ‌چیز باز نمی‌شود)");

console.log("— SafePhotoImage پیش‌فرض thumb —");
const safe = readFileSync(join(ROOT, "shared/components/SafePhotoImage.tsx"), "utf8");
check(/quality\s*=\s*"thumb"/.test(safe), "پیش‌فرض quality در SafePhotoImage برابر thumb است");

console.log("— ساخت پیش‌نمایش هنگام راه‌اندازی اجرا نمی‌شود —");
const main = readFileSync(join(ROOT, "main.tsx"), "utf8");
const app = readFileSync(join(ROOT, "App.tsx"), "utf8");
check(!/ensurePhotoThumbnail|photoThumbnailService/.test(main + app), "main/App هیچ ساخت دسته‌جمعی پیش‌نمایشی ندارند (فقط on-demand)");

console.log("\n" + "=".repeat(70));
console.log(failed ? `نتیجه: ${failed} بررسی ناموفق` : "نتیجه: همهٔ بررسی‌ها موفق");
console.log("=".repeat(70));
process.exit(failed ? 1 : 0);
