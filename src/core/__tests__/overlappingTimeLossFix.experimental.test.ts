/**
 * تست تجربی برای یافتهٔ بازبینی منطقی (مورد ۵ گروه دوم فهرست کارها):
 * «بازه‌های هم‌پوشانِ اتلاف‌وقت دوبار در دستمزد کسر می‌شدند».
 *
 * سناریوی واقعی باگ: یک نیرو از ۸:۰۰ تا ۱۷:۰۰ حضور داشته (۵۴۰ دقیقه). دو
 * رکورد اتلاف‌وقت برایش ثبت شده که با هم هم‌پوشانی دارند:
 *   - رکورد ۱: ۱۰:۰۰ تا ۱۱:۰۰ (۶۰ دقیقه)
 *   - رکورد ۲: ۱۰:۳۰ تا ۱۱:۳۰ (۶۰ دقیقه)
 * زمان واقعیِ غیرحاضر بودنِ او فقط ۱۰:۰۰ تا ۱۱:۳۰ است (۹۰ دقیقه)، نه
 * ۶۰+۶۰=۱۲۰ دقیقه. قبل از رفع، `calculateDailyPayroll` این دو را جدا جمع
 * می‌زد (۱۲۰ دقیقه کسر)، یعنی ۳۰ دقیقه بیشتر از واقعیت از دستمزد نیرو کم
 * می‌شد. این تست دقیقاً از تابع سطح‌بالای `calculateDailyPayroll` (نه
 * مستقیم از تابع داخلی merge) استفاده می‌کند — همان مسیری که واقعاً حقوق
 * محاسبه می‌کند.
 */

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
  const { calculateDailyPayroll, sumNonOverlappingMinutes } = await import("../payroll");

  console.log("=".repeat(70));
  console.log("تست ۱: دو بازهٔ اتلاف‌وقت با هم‌پوشانی جزئی — نباید دوبار شمرده شوند");
  console.log("=".repeat(70));

  const overlapResult = calculateDailyPayroll({
    dailyBaseSalary: 4_000_000,
    checkIn: "08:00",
    checkOut: "17:00",
    timeLosses: [
      { startTime: "10:00", endTime: "11:00" },
      { startTime: "10:30", endTime: "11:30" },
    ],
  });
  assertEqual(overlapResult.totalAttendanceMinutes, 540, "کل حضور: ۹ ساعت = ۵۴۰ دقیقه");
  assertEqual(overlapResult.totalTimeLossMinutes, 90, "اتلاف‌وقت واقعی: ۱۰:۰۰ تا ۱۱:۳۰ = ۹۰ دقیقه (نه ۱۲۰)");
  assertEqual(overlapResult.usefulMinutes, 450, "زمان مفید: ۵۴۰ - ۹۰ = ۴۵۰ دقیقه");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۲: همان سناریو ولی بدون هم‌پوشانی — باید دقیقاً جمع ساده باشد");
  console.log("   (اطمینان از عدم رگرسیون در رایج‌ترین حالت استفاده)");
  console.log("=".repeat(70));

  const noOverlapResult = calculateDailyPayroll({
    dailyBaseSalary: 4_000_000,
    checkIn: "08:00",
    checkOut: "17:00",
    timeLosses: [
      { startTime: "10:00", endTime: "10:30" },
      { startTime: "14:00", endTime: "14:15" },
    ],
  });
  assertEqual(noOverlapResult.totalTimeLossMinutes, 45, "بدون هم‌پوشانی: ۳۰ + ۱۵ = ۴۵ دقیقه (جمع سادهٔ قبلی حفظ شده)");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۳: یک بازه کاملاً داخل بازهٔ دیگر فرو رفته باشد");
  console.log("=".repeat(70));

  const nestedResult = sumNonOverlappingMinutes([
    { startTime: "09:00", endTime: "12:00" }, // 180 دقیقه
    { startTime: "10:00", endTime: "10:15" }, // کاملاً داخل بازهٔ بالا
  ]);
  assertEqual(nestedResult, 180, "بازهٔ کوچک‌تر که کاملاً داخل بزرگ‌تر است، چیزی اضافه نمی‌کند");

  console.log();
  console.log("=".repeat(70));
  console.log("تست ۴: سه بازهٔ زنجیره‌ای هم‌پوشان (۱ با ۲، ۲ با ۳، ولی ۱ با ۳ نه)");
  console.log("=".repeat(70));

  const chainResult = sumNonOverlappingMinutes([
    { startTime: "08:00", endTime: "09:00" },
    { startTime: "08:45", endTime: "09:45" },
    { startTime: "09:30", endTime: "10:00" },
  ]);
  assertEqual(chainResult, 120, "زنجیرهٔ هم‌پوشان باید یک بازهٔ پیوستهٔ ۸:۰۰ تا ۱۰:۰۰ = ۱۲۰ دقیقه شود");

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("خطای غیرمنتظره در اجرای تست:", err);
  process.exitCode = 1;
});
