/**
 * تست رندر واقعی (SSR) هستهٔ یکپارچهٔ «نیروها» (TeamHub) — ادغام فهرست نیروها،
 * حضور و غیاب و حقوق (بازطراحی سوم ناوبری).
 *  - کارت «وضعیت امروز» اعداد درست را از کش نشان می‌دهد (۲ نیروی فعال، ۱ حاضر، ۱ ثبت‌نشده؛
 *    نیروی غیرفعال و حضور نیروی غیرفعال شمرده نمی‌شوند)؛
 *  - هر سه برچسب سوییچ هست و کلید خام i18n نشت نمی‌کند؛
 *  - پارامتر view=attendance / view=payroll همان نما را mount می‌کند و نماهای دیگر mount نمی‌شوند؛
 *  - لینک قدیمی ?tab=attendance روی نمای حضور می‌نشیند.
 * محدودیت: SSR افکت اجرا نمی‌کند؛ هم‌گام‌سازی بعدی با تغییر URL (useEffect) و کلیک روی کاشی‌ها
 * فقط با تست منطق (resourcesPageTabs) و بازبینی دستی پوشش داده می‌شود.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../shared/i18n";
import { TeamHub } from "../../pages/workers/TeamHub";
import { ToastProvider } from "../../shared/components/ToastProvider";
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
  return html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<!-- -->/g, "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}

const theme = createTheme({ components: { MuiDialog: { defaultProps: { disablePortal: true } } } });
const today = getTodayIso();
const now = "2026-01-01T00:00:00.000Z";

function mk(id: string, first: string, isActive: boolean) {
  return {
    id, firstName: first, lastName: "Test", phoneNumber: null, cardNumber: null, cardNumbers: [], shebaNumbers: [],
    position: "Mason", jobTypeId: null, dailyBaseSalary: 1000000, description: null, avatarPhotoId: null,
    defaultCheckIn: "08:00", defaultCheckOut: "17:00", guardDutyEnabled: false, guardDutyRateType: "hourly",
    guardDutyRate: 0, guardDutyMergeWithRegularPay: false, isActive, createdAt: now, updatedAt: now,
  };
}
const att = (id: string, workerId: string) => ({
  id, projectId: "p1", workerId, date: today, checkIn: "08:00", checkOut: null, note: null, createdAt: now, updatedAt: now,
});

function render(search: string): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["projects", "active"], "p1");
  qc.setQueryData(["workers", "p1"], [mk("w1", "Alpha", true), mk("w2", "Bravo", true), mk("w3", "Charlie", false)]);
  // w1 فعال و حاضر؛ w3 غیرفعال ولی حضور دارد (نباید شمرده شود)
  qc.setQueryData(["attendance", "team-today", "p1", today], [att("a1", "w1"), att("a3", "w3")]);
  qc.setQueryData(["workers", "active"], [mk("w1", "Alpha", true), mk("w2", "Bravo", true)]);
  qc.setQueryData(["attendances", "by-date", today], [att("a1", "w1")]);
  return toText(
    renderToString(
      createElement(
        MemoryRouter,
        { initialEntries: [`/resources${search}`] },
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(ThemeProvider, { theme }, createElement(ToastProvider, null, createElement(TeamHub)))
        )
      )
    )
  );
}

async function main() {
  await i18n.changeLanguage("fa");
  const t = (k: string) => i18n.t(k) as string;

  console.log("نمای پیش‌فرض (فهرست)");
  const list = render("?tab=workers");
  check(list.includes(t("team.hero.title")), "عنوان کارت وضعیت امروز");
  check(list.includes(t("team.hero.activeWorkers")), "برچسب نیروی فعال");
  check(list.includes(t("team.hero.presentToday")), "برچسب حاضر امروز");
  check(list.includes(t("team.hero.pendingToday")), "برچسب ثبت‌نشده");
  for (const v of ["list", "attendance", "payroll"]) check(list.includes(t(`team.views.${v}`)), `برچسب سوییچ ${v}`);
  check(/نیروی فعال/.test(list), "متن فارسی نیروی فعال");
  // اعداد: ۲ فعال، ۱ حاضر، ۱ ثبت‌نشده (به ارقام فارسی)
  const nums = (list.match(/[۰-۹0-9]+(?= (?:نیروی فعال|حاضر امروز|ثبت‌نشده))/g) ?? []).map((s) =>
    s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  );
  check(JSON.stringify(nums) === JSON.stringify(["2", "1", "1"]), `شمارش‌ها ۲/۱/۱ است (دریافت: ${JSON.stringify(nums)})`);
  check(list.includes("Alpha"), "فهرست نیروها در نمای پیش‌فرض رندر می‌شود");
  check(!/team\.(hero|views|switchAria)/.test(list), "کلید خام i18n نشت نکرده");
  check(!/\{\{/.test(list), "placeholder جایگزین‌نشده نمانده");

  const LIST_MARK = t("workers.sort.activeFirst"); // چیپ مرتب‌سازی، فقط در نمای فهرست
  const ATT_MARK = t("attendance.page.emptySelectTitle"); // حالت «نیرویی انتخاب نشده»، فقط در نمای حضورِ بدون قفل

  check(list.includes(LIST_MARK), "نمای فهرست: چیپ مرتب‌سازی هست");
  check(!list.includes(ATT_MARK), "نمای فهرست: نمای حضور mount نشده");

  console.log("حضور گروهی (ورودی‌ها)");
  check(list.includes(t("attendance.bulk.entryChip")), "نمای فهرست: چیپ «حضور گروهی» هست");
  check(!list.includes(t("attendance.bulk.chips.add")), "شیت حضور گروهی تا لمس چیپ mount نشده (بسته است)");
  {
    // SSR کلیک اجرا نمی‌کند؛ رفتار کاشی «ثبت‌نشده» با بررسی ایستای منبع پوشش داده می‌شود (تأییدنشده روی دستگاه).
    const src = readFileSync("src/pages/workers/TeamHub.tsx", "utf8");
    const at = src.indexOf("team.hero.pendingToday");
    const pendingTile = src.slice(at, src.indexOf("/>", at)); // فقط خود کاشی «ثبت‌نشده»
    check(/setBulkSheet\(\{ date: today, preselect: pendingWorkerIds \}\)/.test(pendingTile), "کاشی «ثبت‌نشده» شیت را با افراد ثبت‌نشده باز می‌کند");
    check(!/selectView\("attendance"\)/.test(pendingTile), "کاشی «ثبت‌نشده» دیگر به نمای حضور نمی‌رود");
    check(/selectView\("attendance"\)/.test(src), "کاشی «حاضر امروز» همچنان رفتار قبلی را دارد");
  }

  console.log("نمای حضور (view=attendance)");
  const attendance = render("?tab=workers&view=attendance");
  check(attendance.includes(t("team.hero.title")), "کارت وضعیت امروز بالای نمای حضور هم هست");
  check(attendance.includes(ATT_MARK), "نمای حضور (بدون قفل نیرو، با انتخابگر) رندر شد");
  check(!attendance.includes(LIST_MARK), "نمای حضور: فهرست نیروها mount نشده");

  console.log("لینک قدیمی ?tab=attendance");
  const legacy = render("?tab=attendance");
  check(legacy.includes(ATT_MARK), "tab=attendance قدیمی روی نمای حضور می‌نشیند");
  check(!legacy.includes(LIST_MARK), "tab=attendance قدیمی: فهرست mount نشده");

  console.log("نمای حقوق (view=payroll)");
  const payroll = render("?tab=workers&view=payroll");
  check(payroll.includes(t("team.hero.title")), "کارت وضعیت امروز بالای نمای حقوق هم هست");
  check(!payroll.includes(LIST_MARK), "نمای حقوق: فهرست mount نشده");
  check(!payroll.includes(ATT_MARK), "نمای حقوق: نمای حضور mount نشده");
  check(!/payrollSummary\./.test(payroll), "کلید خام payrollSummary نشت نکرده");

  console.log(`\nنتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
