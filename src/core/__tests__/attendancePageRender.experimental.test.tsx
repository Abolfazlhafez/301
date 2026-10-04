/**
 * تست رندر واقعی (SSR) AttendancePage در هر ۸ زبان، با کش react-query پیش‌پر (بدون fetch):
 *  - نیروی قفل‌شده با نگهبانی فعال + حضور ثبت‌شده + نوبت نگهبانی + استراحت + اتلاف وقت؛
 *  - کلید خام نشت نکند، placeholder جایگزین‌نشده نماند، برچسب‌ها ترجمهٔ همان زبان باشند؛
 *  - در en/tr/ru حرف فارسی/عربی نماند (به‌جز نماد بومی واحد پول و نام/دلیل داده‌ای که خودمان گذاشتیم)؛
 *  - حالت «بدون حضور» (پیام «ابتدا ساعت ورود…») و حالت بدون داده هم رندر می‌شود.
 * محدودیت: SSR افکت اجرا نمی‌کند و دیالوگ‌های ConfirmDialog بسته‌اند؛ متن آن‌ها فقط با تست ایستا پوشش داده می‌شود.
 */
import "fake-indexeddb/auto";
import { createElement, type FC } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { AttendancePage } from "../../pages/attendance/AttendancePage";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { CURRENCIES, ENABLED_LANGUAGES } from "../../shared/i18n/languages";
import { PREF_KEYS, setPref } from "../../shared/storage/appPreferences";
import { getTodayIso } from "../../shared/utils/jalaliDate";

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

function toText(html: string): string {
  return html
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

// امضای AttendancePage پارامتر پیش‌فرض دارد و overload ‌های createElement آن را نمی‌پذیرند؛ فقط برای تایپ.
const AttendancePageView = AttendancePage as unknown as FC<{ embedded?: boolean; lockedWorkerId?: string }>;

const LANGS: string[] = [...ENABLED_LANGUAGES]; // فقط زبان‌های فعال (فعلاً fa و en)
const PERSIAN_ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_CYRILLIC_ONLY = new Set(["en", "tr", "ru"]);
const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });

const WID = "w1";
const AID = "a1";
const today = getTodayIso();
const now = "2026-01-01T00:00:00.000Z";

const worker = {
  id: WID, firstName: "Ali", lastName: "Rezaei", phoneNumber: null, cardNumber: null, cardNumbers: [], shebaNumbers: [],
  position: "Mason", jobTypeId: null, dailyBaseSalary: 1000000, description: null, avatarPhotoId: null,
  defaultCheckIn: "08:00", defaultCheckOut: "17:00", guardDutyEnabled: true, guardDutyRateType: "hourly",
  guardDutyRate: 50000, guardDutyMergeWithRegularPay: false, isActive: true, createdAt: now, updatedAt: now,
};
const attendance = { id: AID, projectId: "p1", workerId: WID, date: today, checkIn: "08:00", checkOut: "17:00", note: null, createdAt: now, updatedAt: now };
const guardShift = { id: "g1", projectId: "p1", workerId: WID, date: today, startTime: "21:00", endTime: "05:00", durationMinutes: 480, note: "NOTE-G", createdAt: now, updatedAt: now };
const breakTimes = [
  { id: "b1", workerId: WID, attendanceId: AID, type: "breakfast", startTime: "09:00", endTime: "09:20", durationMinutes: 20, note: null, createdAt: now, updatedAt: now },
  { id: "b2", workerId: WID, attendanceId: AID, type: "lunch", startTime: "12:00", endTime: "13:00", durationMinutes: 60, note: null, createdAt: now, updatedAt: now },
  { id: "b3", workerId: WID, attendanceId: AID, type: "other", startTime: "15:00", endTime: "15:10", durationMinutes: 10, note: null, createdAt: now, updatedAt: now },
];
const timeLoss = { id: "t1", workerId: WID, attendanceId: AID, startTime: "10:00", endTime: "10:30", durationMinutes: 30, reason: "REASON-T", note: null, createdAt: now, updatedAt: now };
const dailyReport = {
  workerId: WID, workerFullName: "Ali Rezaei", position: "Mason", date: today, checkIn: "08:00", checkOut: "17:00",
  totalAttendanceMinutes: 540, totalTimeLossMinutes: 30, totalBreakMinutes: 90, usefulMinutes: 420, dailyBaseSalary: 1000000,
  hourlyRate: 100000, payableSalary: 900000,
  guardDuty: { enabled: true, rateType: "hourly", rate: 50000, shiftsCount: 1, totalMinutes: 480, payableSalary: 400000, shifts: [] },
  timeLosses: [], breakTimes: [],
};

function render(opts: { withAttendance: boolean; withData: boolean }): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (opts.withData) {
    qc.setQueryData(["workers", "active"], [worker]);
    qc.setQueryData(["attendances", "by-date", today], opts.withAttendance ? [attendance] : []);
    qc.setQueryData(["attendances", WID, today], opts.withAttendance ? [attendance] : []);
    qc.setQueryData(["optional-leave", WID, today], null);
    qc.setQueryData(["daily-report", WID, today], dailyReport);
    qc.setQueryData(["guard-shifts", WID, today], [guardShift]);
    qc.setQueryData(["guard-shifts", "previous", WID, today], []);
    if (opts.withAttendance) {
      qc.setQueryData(["time-losses", AID], [timeLoss]);
      qc.setQueryData(["break-times", AID], breakTimes);
    }
  }
  return toText(
    renderToString(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ThemeProvider,
          { theme },
          createElement(ToastProvider, null, createElement(AttendancePageView, { embedded: true, lockedWorkerId: WID }))
        )
      )
    )
  );
}

async function main() {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";
  if (!i18n.isInitialized) await new Promise<void>((resolve) => i18n.on("initialized", () => resolve()));

  for (const lang of LANGS) {
    await i18n.changeLanguage(lang);
    setPref(PREF_KEYS.language, lang);
    const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
    console.log(`\n— زبان: ${lang}`);

    const full = render({ withAttendance: true, withData: true });
    check(full.length > 500, `${lang}: صفحهٔ کامل رندر شد (${full.length} نویسه)`);
    check(!/attendance\.page\.|breakTime\.type|common\.delete/.test(full), `${lang}: کلید خام نشت نکرده`);
    check(!full.includes("{{"), `${lang}: placeholder جایگزین‌نشده نمانده`);
    for (const key of ["guardHeading", "guardAdd", "guardHelp", "guardTotal", "edit", "breakAllowed", "breakRegister", "timeLossHeading", "timeLossAdd", "galleryHeading", "breakLegalNote"]) {
      check(full.includes(t(`attendance.page.${key}`)), `${lang}: ${key} ترجمه شده`);
    }
    check(full.includes(t("common.delete")), `${lang}: دکمهٔ حذف از common.delete`);
    check(full.includes(t("attendance.page.timeRange", { from: "21:00", to: "05:00" })), `${lang}: بازهٔ نوبت نگهبانی با timeRange`);
    for (const [type, from, to] of [["Breakfast", "09:00", "09:20"], ["Lunch", "12:00", "13:00"], ["Other", "15:00", "15:10"]]) {
      const label = t(`breakTime.type${type}`);
      check(full.includes(t("attendance.page.breakItem", { type: label, from, to })), `${lang}: ردیف استراحت ${type} با برچسب نوع ترجمه‌شده`);
    }
    check(full.includes("REASON-T") && full.includes("NOTE-G"), `${lang}: داده‌های کاربر (دلیل/توضیح) دست‌نخورده نمایش داده شد`);
    check(full.includes(t("attendance.page.galleryEmptyTitle")) || full.includes(t("attendance.page.galleryHeading")), `${lang}: بخش گالری رندر شد`);
    if (lang !== "fa") {
      check(!full.includes(t("attendance.page.guardHeading", { lng: "fa" })), `${lang}: عنوان نگهبانی عیناً فارسی نیست`);
    }
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      let stripped = full;
      for (const c of Object.values(CURRENCIES)) stripped = stripped.split(c.symbol).join(" ");
      const m = stripped.match(PERSIAN_ARABIC_RE);
      if (m) console.log("    متن فارسی باقی‌مانده:", stripped.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 80));
      check(!m, `${lang}: هیچ حرف فارسی/عربی هاردکد در رندر کامل نیست (به‌جز نماد واحد پول)`);
    }

    const noAtt = render({ withAttendance: false, withData: true });
    check(noAtt.includes(t("attendance.page.needCheckIn")), `${lang}: بدون حضور پیام «ابتدا ساعت ورود» نمایش داده می‌شود`);
    check(!noAtt.includes("{{") && !/attendance\.page\./.test(noAtt), `${lang}: حالت بدون حضور بدون نشت کلید/placeholder`);
    if (LATIN_CYRILLIC_ONLY.has(lang)) {
      let stripped = noAtt;
      for (const c of Object.values(CURRENCIES)) stripped = stripped.split(c.symbol).join(" ");
      check(!PERSIAN_ARABIC_RE.test(stripped), `${lang}: حالت بدون حضور حرف فارسی/عربی ندارد`);
    }

    const empty = render({ withAttendance: false, withData: false });
    check(!empty.includes("{{") && !/attendance\.page\./.test(empty), `${lang}: حالت بدون داده بدون نشت کلید/placeholder`);
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
