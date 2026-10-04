/** تست ایستا: هیچ متن فارسی هاردکد در فایل‌های جدید «حضور گروهی» (بعد از حذف کامنت). */
import { readFileSync } from "node:fs";

const FILES = [
  "src/widgets/attendance-form/BulkAttendanceSheet.tsx",
  "src/core/utils/bulkAttendanceRules.ts",
];
let failed = 0;
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
for (const f of FILES) {
  const code = stripComments(readFileSync(f, "utf8"));
  const hits = code.match(/[\u0600-\u06FF]+/g) ?? [];
  if (hits.length === 0) console.log(`  ✅ ${f}: بدون متن فارسی هاردکد`);
  else { failed++; console.log(`  ❌ ${f}: ${hits.slice(0, 5).join(" | ")}`); }
}

// هر کلید i18n که در شیت (و کاشی/دکمهٔ ورودی) استفاده شده باید در fa تعریف شده باشد (دیالوگ‌های بسته در SSR دیده نمی‌شوند).
const fa = JSON.parse(readFileSync("src/shared/i18n/locales/fa/common.json", "utf8"));
const has = (key: string) => {
  let o: unknown = fa;
  for (const part of key.split(".")) {
    if (!o || typeof o !== "object" || !(part in (o as Record<string, unknown>))) return false;
    o = (o as Record<string, unknown>)[part];
  }
  return true;
};
const keys = new Set<string>();
for (const f of [...FILES, "src/pages/workers/WorkersPage.tsx", "src/pages/workers/TeamHub.tsx", "src/pages/attendance/AttendancePage.tsx"]) {
  const code = readFileSync(f, "utf8");
  for (const m of code.matchAll(/\bt\(\s*"([A-Za-z0-9_.]+)"/g)) keys.add(m[1]);
  for (const m of code.matchAll(/"((?:attendance|team|workers|common)\.[A-Za-z0-9_.]+)"/g)) keys.add(m[1]);
}
for (const reason of ["worker-not-found", "worker-inactive", "invalid-time", "no-check-in", "already-registered"]) {
  keys.add(`attendance.bulk.reject.${reason}`);
}
const missing = [...keys].filter((k) => !has(k));
if (missing.length === 0) console.log(`  ✅ هر ${keys.size} کلید i18n استفاده‌شده در fa تعریف شده است`);
else { failed++; console.log(`  ❌ کلیدهای تعریف‌نشده: ${missing.join(", ")}`); }

if (failed > 0) process.exit(1);
