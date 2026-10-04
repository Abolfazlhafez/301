/**
 * تست واقعی سرویس «حضور گروهی» (attendanceService.bulkUpsert / undoBulk) روی
 * دیتابیس واقعی برنامه با بک‌اند درون‌حافظه‌ای (بدون mock دستی).
 */
import "fake-indexeddb/auto";

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

function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(ok, name);
  if (!ok) {
    console.log(`     انتظار: ${JSON.stringify(expected)}`);
    console.log(`     دریافت: ${JSON.stringify(actual)}`);
  }
}

const DATE = "2026-10-03";

async function main() {
  const { db, ensureDatabaseSeeded } = await import("../db");
  // مثل اجرای واقعی (DatabaseGate): رکورد تنظیمات و پروژهٔ پیش‌فرض باید قبل از هر چیز seed شود؛
  // بدون آن، «پروژهٔ فعال» به ترتیب نامعین اولین پروژه می‌افتد و تست ایزوله‌سازی ناپایدار می‌شود.
  await ensureDatabaseSeeded();
  const { attendanceService } = await import("../services/attendanceService");
  const { workerService } = await import("../services/workerService");
  const { projectService } = await import("../services/projectService");
  const { breakTimeService } = await import("../services/breakTimeService");

  async function mkWorker(first: string) {
    return workerService.create({ firstName: first, lastName: "تست", position: "بنا", dailyBaseSalary: 1000000 });
  }
  const w1 = await mkWorker("الف");
  const w2 = await mkWorker("ب");
  const w3 = await mkWorker("پ");
  const w4 = await mkWorker("ت");
  const rowOf = async (workerId: string, date = DATE) => attendanceService.findByWorkerAndDate(workerId, date);

  console.log("— ۱) حالت «هر دو»");
  {
    const res = await attendanceService.bulkUpsert(
      [
        { workerId: w1.id, checkIn: "08:00", checkOut: "17:00" },
        { workerId: w2.id, checkIn: "07:30", checkOut: "16:30" },
        { workerId: w3.id, checkIn: "09:00", checkOut: "18:00" },
      ],
      { mode: "both", date: DATE }
    );
    eq(res.saved.length, 3, "سه نفر ثبت شدند");
    eq(res.rejected.length, 0, "هیچ‌کس رد نشد");
    const r2 = await rowOf(w2.id);
    eq([r2?.checkIn, r2?.checkOut], ["07:30", "16:30"], "ساعت اختصاصی هر نفر ثبت شد");
    eq(res.saved.every((s) => s.previous === null), true, "وضعیت قبلی همه null (رکورد تازه)");
  }

  console.log("— ۲) حالت «ورود» روی رکورد موجود: checkOut دست‌نخورده");
  {
    const rej = await attendanceService.bulkUpsert([{ workerId: w1.id, checkIn: "10:00" }], { mode: "in", date: DATE });
    eq(rej.rejected, [{ workerId: w1.id, reason: "already-registered" }], "بدون جایگزینی: رد می‌شود");
    eq((await rowOf(w1.id))?.checkIn, "08:00", "رکورد رد‌شده تغییر نکرد");

    const rep = await attendanceService.bulkUpsert([{ workerId: w1.id, checkIn: "10:00" }], {
      mode: "in",
      date: DATE,
      onExisting: "replace",
    });
    eq(rep.saved.length, 1, "با جایگزینی ثبت شد");
    const r = await rowOf(w1.id);
    eq([r?.checkIn, r?.checkOut], ["10:00", "17:00"], "فقط checkIn عوض شد؛ checkOut موجود پاک نشد");

    // رکوردی که فقط خروج دارد: «ورود» تکراری نیست و خروج دست نمی‌خورد.
    await attendanceService.upsert({ workerId: w4.id, date: DATE, checkOut: "15:00" });
    const only = await attendanceService.bulkUpsert([{ workerId: w4.id, checkIn: "07:00" }], { mode: "in", date: DATE });
    eq(only.saved.length, 1, "رکورد فقط-خروج: ورود ثبت شد");
    const r4 = await rowOf(w4.id);
    eq([r4?.checkIn, r4?.checkOut], ["07:00", "15:00"], "خروج قبلی حفظ شد");
  }

  console.log("— ۳) حالت «خروج»");
  {
    const w5 = await mkWorker("ث");
    const none = await attendanceService.bulkUpsert([{ workerId: w5.id, checkOut: "17:00" }], { mode: "out", date: DATE });
    eq(none.rejected, [{ workerId: w5.id, reason: "no-check-in" }], "خروج بدون رکورد ⇒ رد «no-check-in»");
    eq(await rowOf(w5.id), null, "برای خروج بدون ورود رکوردی ساخته نشد");

    await attendanceService.upsert({ workerId: w5.id, date: DATE, checkIn: "08:00" });
    const ok = await attendanceService.bulkUpsert([{ workerId: w5.id, checkOut: "17:30" }], { mode: "out", date: DATE });
    eq(ok.saved.length, 1, "خروج روی رکورد دارای ورود ثبت شد");
    const r5 = await rowOf(w5.id);
    eq([r5?.checkIn, r5?.checkOut], ["08:00", "17:30"], "ورود دست‌نخورده، خروج ثبت شد");

    const dup = await attendanceService.bulkUpsert([{ workerId: w5.id, checkOut: "18:00" }], { mode: "out", date: DATE });
    eq(dup.rejected[0]?.reason, "already-registered", "خروج تکراری بدون جایگزینی رد می‌شود");
    const repl = await attendanceService.bulkUpsert([{ workerId: w5.id, checkOut: "18:00" }], {
      mode: "out",
      date: DATE,
      onExisting: "replace",
    });
    eq(repl.saved.length, 1, "خروج تکراری با جایگزینی ثبت می‌شود");
    eq((await rowOf(w5.id))?.checkOut, "18:00", "خروج جایگزین شد");
  }

  console.log("— ۴) جایگزینی «هر دو» در مقابل رد");
  {
    const d2 = "2026-10-04";
    await attendanceService.bulkUpsert([{ workerId: w1.id, checkIn: "08:00", checkOut: "17:00" }], { mode: "both", date: d2 });
    const rej = await attendanceService.bulkUpsert([{ workerId: w1.id, checkIn: "09:00", checkOut: "18:00" }], { mode: "both", date: d2 });
    eq(rej.rejected[0]?.reason, "already-registered", "تکراری ⇒ رد (پیش‌فرض)");
    eq((await rowOf(w1.id, d2))?.checkIn, "08:00", "مقدار قبلی حفظ شد");
    const rep = await attendanceService.bulkUpsert([{ workerId: w1.id, checkIn: "09:00", checkOut: "18:00" }], {
      mode: "both",
      date: d2,
      onExisting: "replace",
    });
    eq(rep.saved.length, 1, "تکراری ⇒ جایگزین");
    eq((await rowOf(w1.id, d2))?.checkOut, "18:00", "مقدار جدید ثبت شد");

    // replaceWorkerIds: جایگزینی فقط برای نفرِ صریح؛ نفر دیگرِ تکراری رد می‌شود.
    const d2b = "2026-10-09";
    await attendanceService.bulkUpsert(
      [{ workerId: w1.id, checkIn: "08:00", checkOut: "17:00" }, { workerId: w2.id, checkIn: "08:00", checkOut: "17:00" }],
      { mode: "both", date: d2b }
    );
    const sel = await attendanceService.bulkUpsert(
      [{ workerId: w1.id, checkIn: "09:00", checkOut: "18:00" }, { workerId: w2.id, checkIn: "09:00", checkOut: "18:00" }],
      { mode: "both", date: d2b, replaceWorkerIds: [w1.id] }
    );
    eq(sel.saved.map((x) => x.workerId), [w1.id], "replaceWorkerIds: فقط نفر انتخاب‌شده جایگزین شد");
    eq(sel.rejected, [{ workerId: w2.id, reason: "already-registered" }], "نفر تکراریِ انتخاب‌نشده رد شد");
    eq((await rowOf(w2.id, d2b))?.checkIn, "08:00", "رکورد نفر رد‌شده دست‌نخورده ماند");
  }

  console.log("— ۵) اعتبارسنجی، نیروی نامعتبر و غیرفعال");
  {
    const d3 = "2026-10-05";
    const inactive = await mkWorker("غیرفعال");
    await workerService.toggleActive(inactive.id);
    const res = await attendanceService.bulkUpsert(
      [
        { workerId: inactive.id, checkIn: "08:00", checkOut: "17:00" },
        { workerId: "nope", checkIn: "08:00", checkOut: "17:00" },
        { workerId: w2.id, checkIn: "25:99", checkOut: "17:00" },
        { workerId: w3.id, checkIn: "08:00", checkOut: "17:00" },
        { workerId: w3.id, checkIn: "09:00", checkOut: "18:00" },
      ],
      { mode: "both", date: d3 }
    );
    eq(
      res.rejected.map((r) => r.reason).sort(),
      ["invalid-time", "worker-inactive", "worker-not-found"],
      "غیرفعال/ناموجود/ساعت نامعتبر رد شدند"
    );
    eq(res.saved.map((s) => s.workerId), [w3.id], "فقط نیروی معتبر (یک‌بار، بدون تکرار ورودی) ثبت شد");
    eq(await rowOf(inactive.id, d3), null, "برای نیروی غیرفعال رکوردی ساخته نشد");
  }

  console.log("— ۶) اتمیک‌بودن تراکنش");
  {
    const d4 = "2026-10-06";
    const orig = db.attendances.add.bind(db.attendances);
    let calls = 0;
    (db.attendances as unknown as { add: unknown }).add = async (row: never) => {
      calls += 1;
      if (calls === 2) throw new Error("خطای شبیه‌سازی‌شده در نفر وسط");
      return orig(row);
    };
    let threw = false;
    try {
      await attendanceService.bulkUpsert(
        [
          { workerId: w1.id, checkIn: "08:00", checkOut: "17:00" },
          { workerId: w2.id, checkIn: "08:00", checkOut: "17:00" },
          { workerId: w3.id, checkIn: "08:00", checkOut: "17:00" },
        ],
        { mode: "both", date: d4 }
      );
    } catch {
      threw = true;
    } finally {
      (db.attendances as unknown as { add: unknown }).add = orig;
    }
    check(threw, "خطای وسط کار به بیرون پرتاب شد");
    eq((await attendanceService.findByDate(d4)).length, 0, "هیچ‌کدام ثبت نشد (نفر اول هم برگشت)");
  }

  console.log("— ۷) واگرد");
  {
    const d5 = "2026-10-07";
    // w1: رکورد موجود با استراحت (قابل جایگزینی)؛ w2: رکورد تازه؛ w3: رکورد تازه که بعداً وابسته می‌گیرد.
    const existing = await attendanceService.upsert({ workerId: w1.id, date: d5, checkIn: "08:00", checkOut: "17:00" });
    const brk = await breakTimeService.create({
      workerId: w1.id,
      attendanceId: existing.id,
      type: "lunch",
      startTime: "12:00",
      endTime: "12:30",
    });
    const res = await attendanceService.bulkUpsert(
      [
        { workerId: w1.id, checkIn: "09:00", checkOut: "18:00" },
        { workerId: w2.id, checkIn: "09:00", checkOut: "18:00" },
        { workerId: w3.id, checkIn: "09:00", checkOut: "18:00" },
      ],
      { mode: "both", date: d5, onExisting: "replace" }
    );
    eq(res.saved.length, 3, "سه نفر ثبت شد");
    const w3row = await rowOf(w3.id, d5);
    await breakTimeService.create({
      workerId: w3.id,
      attendanceId: w3row!.id,
      type: "breakfast",
      startTime: "10:00",
      endTime: "10:15",
    });

    const undone = await attendanceService.undoBulk(res.saved);
    eq(undone, 2, "دو رکورد واگرد شد (سومی وابسته دارد و دست نخورد)");
    const back = await rowOf(w1.id, d5);
    eq([back?.checkIn, back?.checkOut], ["08:00", "17:00"], "رکورد عوض‌شده به مقدار قبلی برگشت");
    eq(await rowOf(w2.id, d5), null, "رکورد تازه‌ساخته حذف شد");
    check(!!(await rowOf(w3.id, d5)), "رکورد تازه‌ساختهٔ دارای وابسته حذف نشد");
    const breaks = await db.breakTimes.where({ attendanceId: existing.id }).toArray();
    eq(breaks.map((b) => b.id), [brk.id], "استراحت رکورد موجود دست‌نخورده ماند");
  }

  console.log("— ۸) ایزوله‌سازی پروژه");
  {
    const d6 = "2026-10-08";
    const projectA = await projectService.getOrCreateActiveProjectId();
    await attendanceService.bulkUpsert([{ workerId: w1.id, checkIn: "08:00", checkOut: "17:00" }], { mode: "both", date: d6 });
    const rowA = await rowOf(w1.id, d6);
    eq(rowA?.projectId, projectA, "رکورد برای پروژهٔ فعال ثبت شد");

    const projectB = await projectService.create({ name: "پروژهٔ دوم" });
    await projectService.setActiveProjectId(projectB.id);
    eq((await attendanceService.findByDate(d6)).length, 0, "در پروژهٔ دیگر رکوردی دیده نمی‌شود");
    const res = await attendanceService.bulkUpsert([{ workerId: w1.id, checkIn: "08:00", checkOut: "17:00" }], { mode: "both", date: d6 });
    eq(res.saved.length, 0, "نیروی پروژهٔ الف در پروژهٔ ب ثبت نمی‌شود");
    await projectService.setActiveProjectId(projectA);
    eq((await attendanceService.findByDate(d6)).length, 1, "با برگشت به پروژهٔ الف رکورد سر جایش است");
  }

  console.log("— ۹) «ورود»/«خروج» روی نیروی بدون رکورد و رکورد قدیمی (فیلد undefined)");
  {
    const d7 = "2026-10-10";
    const wn = await mkWorker("ج");
    const res = await attendanceService.bulkUpsert([{ workerId: wn.id, checkIn: "08:15" }], { mode: "in", date: d7 });
    eq(res.saved.length, 1, "«ورود» روی نیروی بدون رکورد ثبت شد");
    const r = await rowOf(wn.id, d7);
    eq([r?.checkIn, r?.checkOut], ["08:15", null], "رکورد تازه فقط ورود دارد و checkOut برابر null است");

    // رکورد قدیمی که فیلد checkOut اصلاً ندارد (undefined) نباید «تکراری» حساب شود.
    const legacy = await mkWorker("چ");
    await db.attendances.put({
      id: "legacy-att-1", projectId: (await projectService.getOrCreateActiveProjectId()), workerId: legacy.id, date: d7,
      checkIn: "08:00", note: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as never);
    const out = await attendanceService.bulkUpsert([{ workerId: legacy.id, checkOut: "17:00" }], { mode: "out", date: d7 });
    eq(out.saved.length, 1, "رکورد قدیمی با checkOut تعریف‌نشده: «خروج» رد نمی‌شود");
    eq((await rowOf(legacy.id, d7))?.checkOut, "17:00", "خروج ثبت شد");
  }

  console.log(`\nنتیجه: ${passed} موفق، ${failed} ناموفق`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
