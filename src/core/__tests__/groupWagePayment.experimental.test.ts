/**
 * تست تجربی واقعی: قابلیت «اکیپ» و «پرداخت جمعی» — ساخت یک اکیپ چند-نفره،
 * ثبت یک پرداخت جمعی برای آن (مبلغ کل، نه سرانه)، و اطمینان از این‌که:
 *  ۱. مبلغ ثبت‌شده دقیقاً همان مبلغ کل وارد شده است (هیچ تقسیمی روی آن
 *     اعمال نمی‌شود، طبق نیاز صریح کاربر که «۱۰ میلیون برای کل گروه، نه
 *     هرکدام ۱۰ میلیون»).
 *  ۲. این پرداخت یک تراکنش «پرداخت حقوق» در دفتر حساب کلی می‌سازد که
 *     workerId آن null است (چون به یک نفر خاص تعلق ندارد).
 *  ۳. حذف یک اکیپ با سابقهٔ پرداخت جمعی رد می‌شود (HasDependenciesError)،
 *     دقیقاً مثل رفتار محافظتی نیروها/تیپ‌های نیرو.
 *  ۴. حذف خود پرداخت جمعی، تراکنش دفتر حساب مرتبط را هم حذف می‌کند.
 */

import "fake-indexeddb/auto";

import { db, ensureDatabaseSeeded } from "../db";
import { workerGroupService } from "../services/workerGroupService";
import { groupWagePaymentService } from "../services/groupWagePaymentService";
import { HasDependenciesError } from "../errors";

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
  console.log("راه‌اندازی: دو نیرو و یک اکیپ گچ‌کار");
  console.log("=".repeat(70));
  await ensureDatabaseSeeded();

  const now = new Date().toISOString();
  const worker1Id = "worker-crew-1";
  const worker2Id = "worker-crew-2";
  for (const [id, firstName] of [
    [worker1Id, "رضا"],
    [worker2Id, "حسین"],
  ] as const) {
    await db.workers.add({
      id,
      firstName,
      lastName: "گچ‌کار",
      phoneNumber: null,
      cardNumber: null,
      cardNumbers: [],
      shebaNumbers: [],
      position: "گچ‌کار",
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
  }

  const group = await workerGroupService.create({
    name: "اکیپ گچ‌کار محمدی",
    memberWorkerIds: [worker1Id, worker2Id],
  });
  assertEqual(group.memberWorkerIds.length, 2, "اکیپ با دو عضو ساخته شد");

  console.log();
  console.log("=".repeat(70));
  console.log("تست: ثبت پرداخت جمعی ۱۰ میلیونی — باید کل ۱۰ میلیون بماند، نه تقسیم‌شده");
  console.log("=".repeat(70));

  const payment = await groupWagePaymentService.create({
    groupId: group.id,
    label: "گچ‌کاری طبقهٔ دوم",
    totalAmount: 10_000_000,
    date: "2026-06-01",
  });
  assertEqual(payment.totalAmount, 10_000_000, "مبلغ پرداخت جمعی دقیقاً همان مبلغ کل وارد شده است (بدون تقسیم)");
  assertTrue(!!payment.cashbookEntryId, "یک تراکنش دفتر حساب مرتبط برای این پرداخت ساخته شده است");

  const cashbookEntry = payment.cashbookEntryId ? await db.cashbookEntries.get(payment.cashbookEntryId) : null;
  assertTrue(!!cashbookEntry, "تراکنش دفتر حساب واقعاً در پایگاه‌داده وجود دارد");
  assertEqual(cashbookEntry?.amount, 10_000_000, "مبلغ تراکنش دفتر حساب با مبلغ کل پرداخت جمعی یکسان است");
  assertEqual(cashbookEntry?.workerId, null, "تراکنش دفتر حساب به هیچ نیروی مشخصی نسبت داده نشده (چون گروهی است)");
  assertEqual(cashbookEntry?.type, "salary", "نوع تراکنش «پرداخت حقوق» است");

  const total = await groupWagePaymentService.totalForGroup(group.id);
  assertEqual(total, 10_000_000, "جمع کل پرداخت‌های این اکیپ درست محاسبه می‌شود");

  console.log();
  console.log("=".repeat(70));
  console.log("تست: حذف اکیپی که سابقهٔ پرداخت جمعی دارد باید رد شود");
  console.log("=".repeat(70));

  let blockedCorrectly = false;
  try {
    await workerGroupService.remove(group.id);
  } catch (err) {
    blockedCorrectly = err instanceof HasDependenciesError;
  }
  assertTrue(blockedCorrectly, "حذف اکیپ با سابقهٔ پرداخت جمعی با HasDependenciesError رد می‌شود");

  const deactivated = await workerGroupService.toggleActive(group.id);
  assertEqual(deactivated.isActive, false, "به‌جای حذف، غیرفعال‌کردن اکیپ ممکن است");

  console.log();
  console.log("=".repeat(70));
  console.log("تست: حذف پرداخت جمعی، تراکنش دفتر حساب مرتبط را هم حذف می‌کند");
  console.log("=".repeat(70));

  await groupWagePaymentService.remove(payment.id);
  const remainingPayments = await groupWagePaymentService.listByGroup(group.id);
  assertEqual(remainingPayments.length, 0, "پرداخت جمعی حذف شد");

  const cashbookEntryAfterDelete = payment.cashbookEntryId ? await db.cashbookEntries.get(payment.cashbookEntryId) : null;
  assertTrue(!cashbookEntryAfterDelete, "تراکنش دفتر حساب مرتبط هم به همراه پرداخت جمعی حذف شد");

  // حالا که پرداختی باقی نمانده، حذف کامل اکیپ باید ممکن باشد.
  await workerGroupService.remove(group.id);
  const groupAfterDelete = await workerGroupService.findByIdOrNull(group.id);
  assertTrue(!groupAfterDelete, "بعد از حذف تمام پرداخت‌ها، حذف کامل خود اکیپ هم ممکن شد");

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
