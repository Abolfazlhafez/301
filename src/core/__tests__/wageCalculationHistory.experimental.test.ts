/**
 * تست تجربی واقعی جریان «تاریخچه محاسبات دستمزد».
 *
 * این اسکریپت React را رندر نمی‌کند (چون منطق UI جدید فقط لایهٔ نمایشی روی
 * سرویس‌های موجود است)، اما مسیر داده‌ای واقعی پشت WageCalculationHistoryDialog
 * را — یعنی همان چیزی که خودِ کامپوننت صدا می‌زند — روی یک نمونهٔ واقعی Dexie
 * (با fake-indexeddb به‌عنوان بک‌اند درون‌حافظه‌ای، نه mock دستی) اجرا می‌کند:
 *
 *   ۱) ایجاد چند آیتم دستمزد و چند محاسبهٔ واقعی برای یک نیرو (دقیقاً همان
 *      مسیری که RunCalculationDialog با wageCalculationApi.calculateAndSave می‌رود)
 *   ۲) خواندن تاریخچه با wageCalculationApi.listByAssignment (همان تابعی که
 *      WageCalculationHistoryDialog از طریق useQuery صدا می‌زند)
 *   ۳) بررسی این‌که ترتیب، مبلغ، و formulaSnapshot هر رکورد صحیح است
 *   ۴) حذف یک رکورد با wageCalculationApi.remove و بررسی این‌که فقط همان
 *      رکورد ناپدید می‌شود و بقیه دست‌نخورده می‌مانند
 *   ۵) بررسی این‌که formulaSnapshot حتی بعد از حذف/تغییر خودِ WageMethod،
 *      در رکورد تاریخچه دست‌نخورده باقی می‌ماند (نکتهٔ کلیدی طراحی: تاریخچه
 *      باید مستقل از وضعیت فعلی روش دستمزد بماند)
 */

// --- راه‌اندازی fake-indexeddb به‌عنوان IndexedDB واقعی قبل از import کردن db.ts ---
import "fake-indexeddb/auto";

import { db, ensureDatabaseSeeded } from "../db";
import { wageCalculationService } from "../services/wageCalculationService";
import { BUILTIN_WAGE_METHOD_IDS } from "../seedWageMethods";
import { randomUUID } from "../utils/uuid";

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

async function main() {
  console.log("=".repeat(70));
  console.log("راه‌اندازی: seed دیتابیس واقعی (Dexie روی fake-indexeddb)");
  console.log("=".repeat(70));
  await ensureDatabaseSeeded();
  const methodCount = await db.wageMethods.count();
  assertEqual(methodCount > 0, true, `روش‌های دستمزد پیش‌فرض seed شدند (${methodCount} روش)`);

  // یک نیروی واقعی برای تست — تمام فیلدهای Worker (بدون cast، دقیقاً همان
  // شکلی که workersApi.create در تولید واقعی می‌سازد).
  const workerId = randomUUID();
  const now = new Date().toISOString();
  await db.workers.add({
    id: workerId,
    firstName: "رضا",
    lastName: "احمدی",
    phoneNumber: null,
    cardNumber: null,
    cardNumbers: [],
    shebaNumbers: [],
    position: "بنا",
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

  // یک آیتم دستمزد واقعی روی روش «متراژ منهای پرت».
  const assignmentId = randomUUID();
  await db.wageAssignments.add({
    id: assignmentId,
    workerId,
    wageMethodId: BUILTIN_WAGE_METHOD_IDS.meterMinusWaste,
    label: "دیوارچینی حیاط",
    defaultVariableValues: { length: 0, waste: 0, rate: 135000 },
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۱: ثبت سه محاسبهٔ واقعی پشت‌سرهم (دقیقاً مسیر RunCalculationDialog)");
  console.log("=".repeat(70));

  const calc1 = await wageCalculationService.calculateAndSave({
    workerId,
    wageAssignmentId: assignmentId,
    date: "2026-08-01",
    variableValues: { length: 20, waste: 2, rate: 135000 },
    note: "روز اول",
  });
  assertEqual(calc1.payableAmount, 2430000, "محاسبه ۱: مبلغ صحیح (20-2)×135000");
  assertEqual(calc1.formulaSnapshot.length > 0, true, "محاسبه ۱: formulaSnapshot ذخیره شد");

  const calc2 = await wageCalculationService.calculateAndSave({
    workerId,
    wageAssignmentId: assignmentId,
    date: "2026-08-05",
    variableValues: { length: 15, waste: 0, rate: 135000 },
    note: null,
  });
  assertEqual(calc2.payableAmount, 2025000, "محاسبه ۲: مبلغ صحیح 15×135000");

  const calc3 = await wageCalculationService.calculateAndSave({
    workerId,
    wageAssignmentId: assignmentId,
    date: "2026-08-10",
    variableValues: { length: 30, waste: 5, rate: 140000 },
    note: "نرخ جدید از این تاریخ",
  });
  assertEqual(calc3.payableAmount, 3500000, "محاسبه ۳: مبلغ صحیح (30-5)×140000");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۲: خواندن تاریخچه از همان مسیر wageCalculationApi.listByAssignment");
  console.log("   که WageCalculationHistoryDialog با useQuery صدا می‌زند");
  console.log("=".repeat(70));

  const history = await wageCalculationService.listByAssignment(assignmentId);
  assertEqual(history.length, 3, "دقیقاً ۳ رکورد در تاریخچه برگشت");
  // سرویس بر اساس createdAt نزولی (جدیدترین اول) مرتب می‌کند.
  assertEqual(history[0].id, calc3.id, "ترتیب: جدیدترین محاسبه (calc3) اول قرار دارد");
  assertEqual(history[2].id, calc1.id, "ترتیب: قدیمی‌ترین محاسبه (calc1) آخر قرار دارد");

  const totalAmount = history.reduce((sum, r) => sum + r.payableAmount, 0);
  assertEqual(totalAmount, 2430000 + 2025000 + 3500000, "مجموع مبالغ تاریخچه صحیح است (همان چیزی که در هدر دیالوگ نمایش داده می‌شود)");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۳: حذف یک رکورد از تاریخچه (دقیقاً دکمهٔ «حذف» در دیالوگ)");
  console.log("=".repeat(70));

  await wageCalculationService.remove(calc2.id);
  const afterDelete = await wageCalculationService.listByAssignment(assignmentId);
  assertEqual(afterDelete.length, 2, "بعد از حذف، دقیقاً ۲ رکورد باقی ماند");
  assertEqual(
    afterDelete.some((r) => r.id === calc2.id),
    false,
    "رکورد حذف‌شده (calc2) دیگر در تاریخچه نیست"
  );
  assertEqual(
    afterDelete.some((r) => r.id === calc1.id) && afterDelete.some((r) => r.id === calc3.id),
    true,
    "دو رکورد دیگر (calc1، calc3) دست‌نخورده باقی ماندند"
  );

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۴: formulaSnapshot در تاریخچه از تغییر بعدی خودِ WageMethod تأثیر نمی‌گیرد");
  console.log("   (این دقیقاً همان چیزی است که WageCalculationHistoryDialog به آن متکی است تا");
  console.log("   بتواند «نحوهٔ محاسبه» یک رکورد قدیمی را حتی بعد از تغییر فرمول نشان دهد)");
  console.log("=".repeat(70));

  const snapshotBefore = calc1.formulaSnapshot;
  const methodBefore = await db.wageMethods.get(BUILTIN_WAGE_METHOD_IDS.meterMinusWaste);
  if (!methodBefore) throw new Error("روش دستمزد پایه پیدا نشد");

  // شبیه‌سازی این‌که کاربر بعداً نام/توضیح روش دستمزد را عوض می‌کند (کاری که
  // در WageMethodFormDialog قابل انجام است) — formulaSnapshot رکورد قدیمی
  // نباید تحت تأثیر قرار بگیرد چون در خودِ رکورد کپی شده، نه رفرنس زنده.
  await db.wageMethods.update(BUILTIN_WAGE_METHOD_IDS.meterMinusWaste, {
    formula: { ...methodBefore.formula, name: "متراژ منهای پرت (نام تغییریافته)" },
  });

  const historyAfterMethodChange = await wageCalculationService.listByAssignment(assignmentId);
  const calc1AfterChange = historyAfterMethodChange.find((r) => r.id === calc1.id);
  assertEqual(
    calc1AfterChange?.formulaSnapshot,
    snapshotBefore,
    "formulaSnapshot رکورد تاریخی حتی بعد از تغییر نام روش دستمزد فعلی، بدون تغییر باقی ماند"
  );

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));

  if (failed > 0) {
    throw new Error(`${failed} بررسی ناموفق بود.`);
  }
}

main().catch((err) => {
  // throw کردن (نه process.exitCode): این فایل داخل src/ پروژه است و
  // tsconfig.app.json فقط types: ["vite/client"] دارد (بدون node)، چون کل
  // src برای مرورگر/Capacitor کامپایل می‌شود. throw هم exit code ناموفق را
  // به tsx منتقل می‌کند، بدون نیاز به @types/node در tsconfig اصلی برنامه.
  console.error("خطای اجرای تست:", err);
  throw err;
});
