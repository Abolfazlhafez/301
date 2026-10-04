/**
 * تست تجربی واقعی منطق فیلتر جستجوی سراسری (filterGlobalSearchResults) —
 * این دقیقاً همان بخشی از GlobalSearchDialog است که واقعاً منطق دارد و
 * مستعد باگ است (تطبیق رشته، تبدیل ارقام فارسی، محدودیت تعداد نتایج،
 * ساخت مسیر ناوبری)، جدا از رندر React که در این محیط تست قابل اجرا نیست.
 */

import {
  filterGlobalSearchResults,
  getGlobalSearchResultRoute,
  GLOBAL_SEARCH_MIN_QUERY_LENGTH,
} from "../../widgets/search/globalSearchFilter";
import type { Worker } from "../../entities/Worker";
import type { CashbookEntry } from "../../entities/Cashbook";
import type { FutureActivity } from "../../entities/FutureActivity";
import type { Equipment } from "../../entities/Equipment";

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, testName: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}`);
    console.log(`     انتظار: ${JSON.stringify(expected)}`);
    console.log(`     دریافت: ${JSON.stringify(actual)}`);
  }
}

const now = new Date().toISOString();

function makeWorker(overrides: Partial<Worker>): Worker {
  return {
    id: "w1",
    firstName: "رضا",
    lastName: "احمدی",
    phoneNumber: null,
    cardNumber: null,
    cardNumbers: [],
    shebaNumbers: [],
    position: "نصاب",
    jobTypeId: null,
    dailyBaseSalary: 0,
    description: null,
    avatarPhotoId: null,
    defaultCheckIn: null,
    defaultCheckOut: null,
    guardDutyEnabled: false,
    guardDutyRateType: "hourly",
    guardDutyRate: 0,
    guardDutyMergeWithRegularPay: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCashbookEntry(overrides: Partial<CashbookEntry>): CashbookEntry {
  return {
    id: "c1",
    type: "expense",
    title: "خرید سیمان",
    amount: 4_500_000,
    date: "2026-08-01",
    description: null,
    fundId: "fund-1",
    workerId: null,
    receiptPhotoId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeActivity(overrides: Partial<FutureActivity>): FutureActivity {
  return {
    id: "a1",
    title: "بازدید مهندس ناظر",
    description: null,
    date: "2026-09-01",
    isCompleted: false,
    isRecurring: false,
    recurrenceRule: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FutureActivity;
}

function makeEquipment(overrides: Partial<Equipment>): Equipment {
  return {
    id: "e1",
    projectId: "test-project",
    code: "M-0001",
    name: "بیل و کلنگ",
    unit: "عدد",
    totalQuantity: 12,
    description: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

console.log("=".repeat(70));
console.log("تست ۱: عبارت کوتاه‌تر از حداقل طول، هیچ نتیجه‌ای برنمی‌گرداند");
console.log("=".repeat(70));
{
  const results = filterGlobalSearchResults(
    "ر",
    { workers: [makeWorker({})], cashbookEntries: [], activities: [], equipment: [] },
    "2026-08-31"
  );
  assertEqual(results.length, 0, `عبارت یک‌حرفی (کمتر از حداقل ${GLOBAL_SEARCH_MIN_QUERY_LENGTH}) نتیجه‌ای نمی‌دهد`);
}

console.log();
console.log("=".repeat(70));
console.log("تست ۲: جستجوی نیرو با نام، تلفن، و شغل — هرکدام باید کار کند");
console.log("=".repeat(70));
{
  const workers = [
    makeWorker({ id: "w1", firstName: "رضا", lastName: "احمدی", phoneNumber: "09121234567", position: "نصاب" }),
    makeWorker({ id: "w2", firstName: "علی", lastName: "محمدی", phoneNumber: null, position: "بنا" }),
  ];
  const byName = filterGlobalSearchResults("رضا", { workers, cashbookEntries: [], activities: [], equipment: [] }, "2026-08-31");
  assertEqual(byName.length, 1, "جستجو با نام کوچک دقیقاً همان نیرو را پیدا می‌کند");
  assertEqual(byName[0]?.id, "w1", "شناسهٔ نتیجه درست است");

  const byPosition = filterGlobalSearchResults("بنا", { workers, cashbookEntries: [], activities: [], equipment: [] }, "2026-08-31");
  assertEqual(byPosition.length, 1, "جستجو با نوع شغل هم کار می‌کند");
  assertEqual(byPosition[0]?.id, "w2", "نیروی درست بر اساس شغل پیدا شد");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۳: تبدیل ارقام فارسی/عربی به‌درستی در جستجوی شماره تلفن اعمال می‌شود");
console.log("   (کاربر ممکن است با کیبورد فارسی رقم‌ها را وارد کند)");
console.log("=".repeat(70));
{
  const workers = [makeWorker({ id: "w1", phoneNumber: "09121234567" })];
  // کاربر بخشی از شماره را با ارقام فارسی جستجو می‌کند: "۰۹۱۲"
  const persianDigitQuery = "\u06f0\u06f9\u06f1\u06f2";
  const results = filterGlobalSearchResults(
    persianDigitQuery,
    { workers, cashbookEntries: [], activities: [], equipment: [] },
    "2026-08-31"
  );
  assertEqual(results.length, 1, "جستجو با ارقام فارسی، شمارهٔ تلفن (که با ارقام انگلیسی ذخیره شده) را پیدا می‌کند");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۴: جستجوی دفتر حساب با مبلغ عددی هم کار می‌کند");
console.log("=".repeat(70));
{
  const entries = [
    makeCashbookEntry({ id: "c1", title: "خرید سیمان", amount: 4_500_000 }),
    makeCashbookEntry({ id: "c2", title: "خرید میلگرد", amount: 8_200_000 }),
  ];
  const results = filterGlobalSearchResults("4500000", { workers: [], cashbookEntries: entries, activities: [], equipment: [] }, "2026-08-31");
  assertEqual(results.length, 1, "جستجو با مبلغ دقیق، تراکنش مربوطه را پیدا می‌کند");
  assertEqual(results[0]?.id, "c1", "شناسهٔ تراکنش درست است");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۵: جستجوی فعالیت‌ها با عنوان و توضیحات");
console.log("=".repeat(70));
{
  const activities = [
    makeActivity({ id: "a1", title: "بازدید مهندس ناظر", description: null }),
    makeActivity({ id: "a2", title: "تحویل مصالح", description: "بارگیری سیمان و میلگرد از انبار" }),
  ];
  const byTitle = filterGlobalSearchResults(
    "ناظر",
    { workers: [], cashbookEntries: [], activities, equipment: [] },
    "2026-08-31"
  );
  assertEqual(byTitle.length, 1, "جستجو با عنوان فعالیت کار می‌کند");
  const byDesc = filterGlobalSearchResults(
    "میلگرد",
    { workers: [], cashbookEntries: [], activities, equipment: [] },
    "2026-08-31"
  );
  assertEqual(byDesc.length, 1, "جستجو با توضیحات فعالیت هم کار می‌کند");
  assertEqual(byDesc[0]?.id, "a2", "فعالیت درست بر اساس توضیحات پیدا شد");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۶: جستجوی تجهیزات با نام و توضیحات");
console.log("=".repeat(70));
{
  const equipment = [
    makeEquipment({ id: "e1", name: "بیل و کلنگ", description: null }),
    makeEquipment({ id: "e2", name: "فرغون", description: "برای حمل مصالح سبک" }),
  ];
  const byName = filterGlobalSearchResults("فرغون", { workers: [], cashbookEntries: [], activities: [], equipment }, "2026-08-31");
  assertEqual(byName.length, 1, "جستجو با نام تجهیزات کار می‌کند");
  const byDescription = filterGlobalSearchResults(
    "مصالح",
    { workers: [], cashbookEntries: [], activities: [], equipment },
    "2026-08-31"
  );
  assertEqual(byDescription.length, 1, "جستجو با توضیحات تجهیزات هم کار می‌کند");
  assertEqual(byDescription[0]?.id, "e2", "تجهیزات درست بر اساس توضیحات پیدا شد");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۷: نتایج هر دسته حداکثر به ۸ مورد محدود می‌شوند (نه بیشتر)");
console.log("=".repeat(70));
{
  const manyWorkers = Array.from({ length: 15 }, (_, i) => makeWorker({ id: `w${i}`, firstName: "کارگر", lastName: `شمارهٔ${i}` }));
  const results = filterGlobalSearchResults(
    "کارگر",
    { workers: manyWorkers, cashbookEntries: [], activities: [], equipment: [] },
    "2026-08-31"
  );
  assertEqual(results.length, 8, "با ۱۵ نیروی مطابق، فقط ۸ نتیجهٔ اول برگردانده می‌شود");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۸: جستجو در چند دسته هم‌زمان، نتایج همهٔ دسته‌ها را با هم برمی‌گرداند");
console.log("=".repeat(70));
{
  const results = filterGlobalSearchResults(
    "سیمان",
    {
      workers: [makeWorker({ id: "w1", firstName: "سیمان", lastName: "پور" })],
      cashbookEntries: [makeCashbookEntry({ id: "c1", title: "خرید سیمان" })],
      activities: [],
      equipment: [],
    },
    "2026-08-31"
  );
  assertEqual(results.length, 2, "نتایج از دو دستهٔ متفاوت (نیرو و دفتر حساب) با هم در یک آرایه برگشتند");
  const kinds = results.map((r) => r.kind).sort();
  assertEqual(kinds, ["cashbook", "worker"], "هر دو نوع نتیجه با kind درست حاضرند");
}

console.log();
console.log("=".repeat(70));
console.log("تست ۹: مسیر ناوبری هر نوع نتیجه دقیقاً درست است");
console.log("=".repeat(70));
assertEqual(getGlobalSearchResultRoute("worker"), "/resources?tab=workers", "مسیر نیرو درست است");
assertEqual(
  getGlobalSearchResultRoute("cashbook"),
  "/reports?tab=cashbook",
  "مسیر دفتر حساب درست است (بعد از بازطراحی ناوبری، به «تیم و تجهیزات» منتقل شده)"
);
assertEqual(getGlobalSearchResultRoute("equipment"), "/resources?tab=equipment", "مسیر تجهیزات درست است");
assertEqual(getGlobalSearchResultRoute("activity"), "/activities?tab=upcoming", "مسیر فعالیت‌ها درست است");

console.log();
console.log("=".repeat(70));
console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
console.log("=".repeat(70));

if (failed > 0) {
  throw new Error(`${failed} بررسی ناموفق بود.`);
}
