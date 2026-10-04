/**
 * تست تجربی واقعی: حذف یک روش دستمزد که نیروهایی به آن وصل هستند، باید
 * آیتم‌های دستمزد وابسته را غیرفعال کند (نه یتیم بگذارد یا بی‌صدا مخفی
 * کند)، و تاریخچهٔ محاسبات گذشتهٔ آن‌ها باید کاملاً سالم و قابل‌مشاهده بماند.
 *
 * این دقیقاً همان کلاس باگی است که در دفتر حساب پیدا و رفع شد (تراکنش با
 * fundId نامعتبر بی‌صدا مخفی می‌شد) — این‌جا همان الگوی محافظتی برای رابطهٔ
 * WageAssignment.wageMethodId → WageMethod اعمال می‌شود، قبل از این‌که
 * کاربری واقعاً این باگ را تجربه کند.
 */

import "fake-indexeddb/auto";

import { db, ensureDatabaseSeeded } from "../db";
import { wageMethodService } from "../services/wageMethodService";
import { wageAssignmentService } from "../services/wageAssignmentService";
import { wageCalculationService } from "../services/wageCalculationService";
import { wf } from "../wageFormula";

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

function assertTrue(condition: boolean, testName: string) {
  assertEqual(condition, true, testName);
}

async function main() {
  console.log("=".repeat(70));
  console.log("راه‌اندازی: یک نیرو، یک روش دستمزد سفارشی، و یک آیتم دستمزد فعال");
  console.log("=".repeat(70));
  await ensureDatabaseSeeded();

  const now = new Date().toISOString();
  const workerId = "worker-test-1";
  await db.workers.add({
    id: workerId,
    firstName: "علی",
    lastName: "رضایی",
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
  });

  const customMethod = await wageMethodService.create({
    formula: {
      id: "will-be-replaced",
      name: "روش سفارشی آزمایشی",
      description: "برای تست حذف",
      variables: [
        { key: "count", label: "تعداد", unit: "عدد", defaultValue: 0 },
        { key: "rate", label: "نرخ", unit: "تومان", defaultValue: 0 },
      ],
      root: wf.mul(wf.v("count"), wf.v("rate")),
    },
  });

  const assignment = await wageAssignmentService.create({
    workerId,
    wageMethodId: customMethod.id,
    label: "نصب کابینت",
    defaultVariableValues: { count: 0, rate: 200000 },
  });
  assertTrue(assignment.isActive, "آیتم دستمزد تازه‌ساخته‌شده، فعال است");

  const calc = await wageCalculationService.calculateAndSave({
    workerId,
    wageAssignmentId: assignment.id,
    date: "2026-08-01",
    variableValues: { count: 5, rate: 200000 },
    note: null,
  });
  assertEqual(calc.payableAmount, 1_000_000, "محاسبهٔ اولیه با این روش صحیح ثبت شد");

  console.log();
  console.log("=".repeat(70));
  console.log("تست: حذف روش دستمزد — آیتم وابسته باید غیرفعال شود، نه یتیم بماند");
  console.log("=".repeat(70));

  const usageCountBeforeDelete = await wageMethodService.countUsages(customMethod.id);
  assertEqual(usageCountBeforeDelete, 1, "countUsages قبل از حذف، ۱ آیتم وابسته را گزارش می‌دهد");

  await wageMethodService.remove(customMethod.id);

  const methodAfterDelete = await wageMethodService.findByIdOrNull(customMethod.id);
  assertEqual(methodAfterDelete, null, "روش دستمزد واقعاً حذف شد");

  const assignmentsIncludingInactive = await wageAssignmentService.listByWorker(workerId, true);
  assertEqual(assignmentsIncludingInactive.length, 1, "آیتم دستمزد بعد از حذف روش، همچنان در دیتابیس موجود است (یتیم/گم‌شده نیست)");
  assertEqual(assignmentsIncludingInactive[0]?.isActive, false, "آیتم دستمزد بعد از حذف روش وابسته‌اش، به‌طور خودکار غیرفعال شده است");

  const assignmentsActiveOnly = await wageAssignmentService.listByWorker(workerId, false);
  assertEqual(
    assignmentsActiveOnly.length,
    0,
    "با فیلتر پیش‌فرض (فقط فعال)، این آیتم دیگر دیده نمی‌شود — رفتار پیش‌بینی‌پذیر، نه یک باگ پنهان"
  );

  console.log();
  console.log("=".repeat(70));
  console.log("تست: تاریخچهٔ محاسبات گذشته کاملاً سالم و دست‌نخورده می‌ماند");
  console.log("=".repeat(70));

  const history = await wageCalculationService.listByAssignment(assignment.id);
  assertEqual(history.length, 1, "تاریخچهٔ محاسبات این آیتم بعد از حذف روش، همچنان کامل است");
  assertEqual(history[0]?.payableAmount, 1_000_000, "مبلغ محاسبهٔ قدیمی دست‌نخورده مانده");
  assertTrue(history[0]!.formulaSnapshot.length > 0, "formulaSnapshot تاریخچه هم مستقل از حذف روش، سالم مانده است");

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));

  if (failed > 0) {
    throw new Error(`${failed} بررسی ناموفق بود.`);
  }
}

main().catch((err) => {
  console.error("خطای اجرای تست:", err);
  throw err;
});
