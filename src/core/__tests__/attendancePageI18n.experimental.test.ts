/**
 * تست i18n AttendancePage (دور ۱ تا ۳ از ۳: منطق/توست‌ها، رندر بالای صفحه، بخش‌های نگهبانی/استراحت/اتلاف وقت/گالری و دیالوگ‌های حذف).
 * jsdom در پروژه نیست و SSR افکت‌ها را اجرا نمی‌کند (شاخه‌های وابسته به دادهٔ پرشده رندر نمی‌شوند)، پس تست ایستا است:
 *  - همهٔ کلیدهای attendance.page.* استفاده‌شده در کد در ۸ زبان وجود دارند و بلااستفاده‌ای نیست؛
 *  - placeholderها در همهٔ زبان‌ها با fa یکی‌اند و interpolation واقعاً جایگزین می‌شود؛
 *  - کل فایل (بدون کامنت) حرف فارسی/عربی هاردکد ندارد؛
 *  - هر زبان متن توست/دیالوگ متفاوت از fa دارد و در en/tr/ru حرف فارسی/عربی نیست.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import i18n from "../../shared/i18n";
import { ENABLED_LANGUAGES } from "../../shared/i18n/languages";

let passed = 0;
let failed = 0;
function check(ok: boolean, name: string) {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
  }
}

const LANGS: string[] = [...ENABLED_LANGUAGES]; // فقط زبان‌های فعال (فعلاً fa و en)
const PERSIAN_ARABIC_RE = /[\u0600-\u06FF]/;

function placeholders(s: string): string {
  return (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(",");
}

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  const src = readFileSync(new URL("../../pages/attendance/AttendancePage.tsx", import.meta.url), "utf8");
  const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const usedKeys = new Set([...src.matchAll(/"(attendance\.page\.\w+)"/g)].map((m) => m[1]));
  const faPage = (i18n.getResourceBundle("fa", "common") as { attendance: { page: Record<string, string> } }).attendance.page;
  const definedKeys = Object.keys(faPage).map((k) => `attendance.page.${k}`);

  console.log("\n— پوشش ایستا");
  check(usedKeys.size > 0, `کد کلید attendance.page.* استفاده می‌کند (${usedKeys.size})`);
  check(definedKeys.every((k) => usedKeys.has(k)), "هیچ کلید بلااستفاده‌ای در attendance.page نیست");
  check([...usedKeys].every((k) => definedKeys.includes(k)), "هر کلید استفاده‌شده در کد تعریف شده است");
  const logicPart = strip(src.slice(src.indexOf("export function AttendancePage"), src.indexOf("\n  return (\n")));
  check(logicPart.length > 1000, "بخش منطق کامپوننت پیدا شد");
  check(!PERSIAN_ARABIC_RE.test(logicPart), "هیچ حرف فارسی/عربی هاردکد در بخش منطق/توست‌ها نمانده");
  const renderStart = src.indexOf("\n  return (\n");
  const renderEnd = src.indexOf("attendance.page.guardPay");
  const renderTop = strip(src.slice(renderStart, renderEnd));
  check(renderEnd > renderStart && renderTop.length > 3000, "بخش رندر بالای صفحه (تا کارت خلاصه) پیدا شد");
  check(!PERSIAN_ARABIC_RE.test(renderTop), "هیچ حرف فارسی/عربی هاردکد در رندر بالای صفحه نمانده");
  check(!PERSIAN_ARABIC_RE.test(strip(src)), "هیچ حرف فارسی/عربی هاردکد در کل فایل (به‌جز کامنت) نمانده");
  check(!/\bحذف\b|\bافزودن\b|تا \{/.test(strip(src)), "هیچ برچسب دکمه/تیتر فارسی باقی نمانده");
  const breakKeyMap = src.match(/BREAK_TYPE_LABEL_KEYS[^=]*=\s*\{([\s\S]*?)\};/);
  const breakTypeKeys = breakKeyMap ? [...breakKeyMap[1].matchAll(/"(breakTime\.type\w+)"/g)].map((m) => m[1]) : [];
  check(breakTypeKeys.length === 3, "نگاشت نوع استراحت ← کلید ترجمه سه نوع (صبحانه/ناهار/سایر) دارد");
  check(/t\(BREAK_TYPE_LABEL_KEYS\[bt\.type\]\)/.test(src), "برچسب نوع استراحت از نگاشت i18n می‌آید");
  check(!/OPTIONAL_LEAVE_TYPE_LABELS/.test(src), "برچسب نوع غیبت از ثابت فارسی entity نمی‌آید (optionalLeave.type.* استفاده می‌شود)");

  for (const lang of LANGS) {
    const t = i18n.getFixedT(lang);
    const fa = i18n.getFixedT("fa");
    console.log(`\n— زبان: ${lang}`);
    check(definedKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: همهٔ ${definedKeys.length} کلید موجود است`);
    check(definedKeys.every((k) => placeholders(t(k)) === placeholders(fa(k))), `${lang}: placeholderها با fa یکی است`);
    for (const key of ["leaveChipPaid", "leaveChipUnpaid"]) {
      const v = t(`attendance.page.${key}`, { type: "TYPE" });
      check(v.includes("TYPE") && !v.includes("{{"), `${lang}: ${key} نوع غیبت را می‌گیرد`);
    }
    const dd = t("attendance.page.deleteAttDesc", { checkIn: "IN", checkOut: "OUT" });
    check(dd.includes("IN") && dd.includes("OUT") && !dd.includes("{{"), `${lang}: deleteAttDesc ساعت‌ها را می‌گیرد`);
    const tt = t("attendance.page.quickTimesTooltip", { from: "FR", to: "TO" });
    check(tt.includes("FR") && tt.includes("TO") && !tt.includes("{{"), `${lang}: quickTimesTooltip ساعت‌ها را می‌گیرد`);
    check(["chipCheckIn", "chipCheckOut"].every((key) => t(`attendance.page.${key}`, { time: "TM" }).includes("TM")), `${lang}: چیپ ورود/خروج ساعت را می‌گیرد`);
    check(["sick", "personal", "mission", "unpaid", "other"].every((x) => i18n.exists(`optionalLeave.type.${x}`, { lng: lang, fallbackLng: [] })), `${lang}: انواع غیبت مجاز موجود است`);
    const toastKeys = definedKeys.filter((k) => k.includes(".toast") || k.includes(".err") || k.includes(".bulk"));
    if (lang !== "fa") {
      check(toastKeys.every((k) => t(k) !== fa(k)), `${lang}: هیچ توست/خطایی عیناً فارسی نیست`);
    }
    if (["en", "tr", "ru"].includes(lang)) {
      check(definedKeys.every((k) => !PERSIAN_ARABIC_RE.test(t(k))), `${lang}: هیچ حرف فارسی/عربی در ترجمه‌ها نیست`);
    }
    const guardDesc = t("attendance.page.deleteGuardDesc", { from: "FR", to: "TO" });
    check(guardDesc.includes("FR") && guardDesc.includes("TO") && !guardDesc.includes("{{"), `${lang}: deleteGuardDesc ساعت‌ها را می‌گیرد`);
    const tlDesc = t("attendance.page.deleteTimeLossDesc", { reason: "RS" });
    check(tlDesc.includes("RS") && !tlDesc.includes("{{"), `${lang}: deleteTimeLossDesc دلیل را می‌گیرد`);
    const tr1 = t("attendance.page.timeRange", { from: "08:00", to: "17:30" });
    check(tr1.includes("08:00") && tr1.includes("17:30") && !tr1.includes("{{"), `${lang}: timeRange ساعت‌ها را می‌گیرد`);
    const bi = t("attendance.page.breakItem", { type: "TP", from: "FR", to: "TO" });
    check(bi.includes("TP") && bi.includes("FR") && bi.includes("TO") && !bi.includes("{{"), `${lang}: breakItem نوع و ساعت‌ها را می‌گیرد`);
    check(breakTypeKeys.every((k) => i18n.exists(k, { lng: lang, fallbackLng: [] })), `${lang}: برچسب‌های نوع استراحت موجود است`);
    const round3 = definedKeys.filter((k) => /\.(guard(Heading|Add|Help|Empty|Total)|edit|quick(Breakfast|Lunch)|needCheckIn|breakEmpty|breakLegalNote|timeLoss(Heading|Add|Empty)|gallery\w+|delete(Guard|TimeLoss|Break)\w+)$/.test(k));
    check(round3.length === 23, `${lang}: ۲۳ کلید دور ۳ شناسایی شد (${round3.length})`);
    if (lang !== "fa") {
      check(round3.every((k) => t(k) !== fa(k)), `${lang}: هیچ کلید دور ۳ عیناً فارسی نیست`);
    }
    const breakToasts = ["BreakfastSettings", "BreakfastPrevious", "LunchSettings", "LunchPrevious"].map((x) => t(`attendance.page.toastBreak${x}`));
    check(new Set(breakToasts).size === 4, `${lang}: چهار توست استراحت سریع متمایزند`);
  }

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));
  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("خطای اجرای تست:", err);
    process.exit(1);
  });
