/**
 * تست رندر (SSR) شیت «حضور گروهی» با کش react-query پیش‌پر:
 * چیپ‌ها، برچسب‌های وضعیت (حاضر/ورود بدون خروج/ثبت‌نشده)، «جایگزین می‌شود»،
 * نیروی بدون ساعت پیش‌فرض، شمارندهٔ دکمهٔ پایین، نبود کلید خام i18n.
 * محدودیت: SSR افکت و تعامل (لمس، کیبورد، لمس طولانی، mutation) را اجرا نمی‌کند.
 */
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { BulkAttendanceSheet } from "../../widgets/attendance-form/BulkAttendanceSheet";
import { ToastProvider } from "../../shared/components/ToastProvider";
import { getTodayIso } from "../../shared/utils/jalaliDate";

let passed = 0;
let failed = 0;
function check(ok: boolean, name: string) {
  if (ok) { passed++; console.log(`  ✅ ${name}`); } else { failed++; console.log(`  ❌ ${name}`); }
}
function toText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<!-- -->/g, "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}

const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });
const today = getTodayIso();
const now = "2026-01-01T00:00:00.000Z";

function mk(id: string, first: string, isActive: boolean, defaults = true) {
  return {
    id, firstName: first, lastName: "Test", phoneNumber: null, cardNumber: null, cardNumbers: [], shebaNumbers: [],
    position: "Mason", jobTypeId: null, dailyBaseSalary: 1000000, description: null, avatarPhotoId: null,
    defaultCheckIn: defaults ? "08:00" : null, defaultCheckOut: defaults ? "17:00" : null, guardDutyEnabled: false,
    guardDutyRateType: "hourly", guardDutyRate: 0, guardDutyMergeWithRegularPay: false, isActive, createdAt: now, updatedAt: now,
  };
}
const att = (id: string, workerId: string, checkOut: string | null) => ({
  id, projectId: "p1", workerId, date: today, checkIn: "08:00", checkOut, note: null, createdAt: now, updatedAt: now,
});

function render(lastTemplateId: string | null, preselect: string[]): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["projects", "active"], "p1");
  qc.setQueryData(["workers", "p1"], [
    mk("w1", "Alpha", true),        // حاضر (ورود+خروج)
    mk("w2", "Bravo", true),        // ورود بدون خروج
    mk("w3", "Charlie", true),      // ثبت‌نشده
    mk("w4", "Delta", true, false), // ثبت‌نشده و بدون ساعت پیش‌فرض
    mk("w5", "Echo", false),        // غیرفعال
  ]);
  qc.setQueryData(["attendances", "by-date", today], [att("a1", "w1", "17:00"), att("a2", "w2", null)]);
  qc.setQueryData(["worker-groups"], []);
  qc.setQueryData(["settings"], {
    quickCheckInDefaultTime: "07:00", quickCheckOutDefaultTime: "16:00",
    attendanceTimeTemplates: [{ id: "t1", name: "TplName", checkIn: "06:30", checkOut: "15:30" }],
    lastAttendanceTemplateId: lastTemplateId,
  });
  return toText(
    renderToString(
      createElement(QueryClientProvider, { client: qc },
        createElement(ThemeProvider, { theme }, createElement(ToastProvider, null,
          createElement(BulkAttendanceSheet, { open: true, onClose: () => {}, initialDate: today, preselectWorkerIds: preselect, disablePortal: true }))))
    )
  );
}

async function main() {
  await i18n.changeLanguage("fa");
  const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, o) as string;

  console.log("چیپ «ساعت خود نیرو» فعال (آخرین قالب ندارد)");
  const own = render(null, ["w1", "w3", "w4"]);
  check(own.includes(t("attendance.bulk.title")), "عنوان شیت");
  for (const k of ["in", "out", "both"]) check(own.includes(t(`attendance.bulk.mode.${k}`)), `سوییچ ${k}`);
  check(own.includes(t("attendance.bulk.chips.own")), "چیپ ساعت خود نیرو");
  check(own.includes(t("attendance.bulk.chips.quick")), "چیپ ساعت سریع");
  check(own.includes("TplName"), "چیپ قالب کاربر");
  check(own.includes(t("attendance.bulk.chips.add")), "چیپ «+»");
  check(own.includes(t("attendance.bulk.status.present")), "برچسب حاضر");
  check(own.includes(t("attendance.bulk.status.inOnly")), "برچسب ورود بدون خروج");
  check(own.includes(t("attendance.bulk.status.none")), "برچسب ثبت‌نشده");
  check(own.includes(t("attendance.bulk.replaces")), "«جایگزین می‌شود» برای نیروی ثبت‌شدهٔ انتخاب‌شده");
  check(own.includes(t("attendance.bulk.noDefault")), "هشدار «ساعت پیش‌فرض ندارد»");
  check(own.includes("Alpha") && own.includes("Delta"), "نیروهای فعال هستند");
  check(!own.includes("Echo"), "نیروی غیرفعال در فهرست نیست");
  // انتخاب‌شده‌ها: w1(ثبت‌شده ولی با جایگزینی)، w3 ⇒ قابل‌ثبت؛ w4 بدون ساعت ⇒ غیرقابل‌ثبت ⇒ ۲ نفر
  check(own.includes(t("attendance.bulk.submit", { n: "۲" })), `دکمهٔ پایین «ثبت حضور ۲ نفر» (دریافت: ${(own.match(/ثبت حضور [^ ]+ نفر/) ?? [""])[0]})`);
  check(own.includes(t("attendance.bulk.shortcuts.unregistered")), "میان‌بر فقط ثبت‌نشده‌ها");
  check(own.includes(t("attendance.bulk.ownTimesHint")), "با «ساعت خود نیرو» توضیح به‌جای فیلدهای ساعت می‌آید");
  check(!own.includes(t("attendance.bulk.checkInLabel")), "با «ساعت خود نیرو» فیلد ساعت ورود رندر نمی‌شود");
  check(own.includes(t("attendance.bulk.blockedNote", { n: "۱" })), "یادداشت «۱ نفر ... ثبت نمی‌شود» بالای دکمه");
  check(!/attendance\.bulk\./.test(own), "کلید خام i18n نشت نکرده");
  check(!/\{\{/.test(own), "placeholder جایگزین‌نشده نمانده");

  console.log("قالب کاربر فعال (آخرین قالب استفاده‌شده از قبل انتخاب است)");
  const tpl = render("t1", ["w3", "w4"]);
  check(!tpl.includes(t("attendance.bulk.noDefault")), "با قالب فعال، نیروی بدون ساعت پیش‌فرض مسدود نیست");
  check(!tpl.includes(t("attendance.bulk.ownTimesHint")) && tpl.includes(t("attendance.bulk.checkInLabel")), "با قالب فعال فیلدهای ساعت دیده می‌شوند و توضیح نه");
  check(!/ثبت نمی‌شود/.test(tpl), "بدون مسدودی، یادداشت نمایش داده نمی‌شود");
  check(tpl.includes(t("attendance.bulk.submit", { n: "۲" })), "هر دو نفر قابل‌ثبت‌اند (۲ نفر)");

  console.log("بدون انتخاب");
  const none = render(null, []);
  check(none.includes(t("attendance.bulk.submit", { n: "۰" })), "شمارنده ۰");

  console.log(`\nنتیجه: ${passed} موفق، ${failed} ناموفق`);
  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
