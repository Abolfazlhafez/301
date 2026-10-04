/**
 * تست واقعی «قالب‌های ساعت حضور گروهی» (settingsService.*AttendanceTemplate*):
 * ایجاد/ویرایش/حذف، اعتبارسنجی، سقف ۱۰، نام تکراری، آخرین قالب استفاده‌شده،
 * سازگاری با رکورد تنظیمات قدیمی (بدون فیلد) و رفت‌وبرگشت بکاپ واقعی.
 */
import "fake-indexeddb/auto";

// polyfill حداقلی FileReader (همان الگوی تست بکاپ دفتر حساب؛ در WebView واقعی وجود دارد).
class NodeFileReaderPolyfill {
  onloadend: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  result: string | ArrayBuffer | null = null;
  readAsDataURL(blob: Blob): void {
    blob
      .arrayBuffer()
      .then((buf) => {
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
        this.result = `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
        this.onloadend?.();
      })
      .catch((err) => this.onerror?.(err));
  }
}
(globalThis as { FileReader?: unknown }).FileReader ??= NodeFileReaderPolyfill;

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
async function rejects(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const { db, ensureDatabaseSeeded, SETTINGS_ROW_ID } = await import("../db");
  const { settingsService } = await import("../services/settingsService");
  const { backupService } = await import("../services/backupService");
  await ensureDatabaseSeeded();

  console.log("— سازگاری با تنظیمات قدیمی (بدون فیلد)");
  {
    const row = (await db.settings.get(SETTINGS_ROW_ID))!;
    const legacy = { ...row } as Record<string, unknown>;
    delete legacy.attendanceTimeTemplates;
    delete legacy.lastAttendanceTemplateId;
    await db.settings.put(legacy as never);
    const s = await settingsService.get();
    eq(s.attendanceTimeTemplates, [], "رکورد قدیمی ⇒ آرایهٔ خالی");
    eq(s.lastAttendanceTemplateId, null, "رکورد قدیمی ⇒ آخرین قالب null");
  }

  console.log("— ایجاد/ویرایش/حذف");
  const a = await settingsService.createAttendanceTemplate({ name: "  روزکاری  ", checkIn: "08:00", checkOut: "17:00" });
  eq(a.name, "روزکاری", "نام trim می‌شود");
  const b = await settingsService.createAttendanceTemplate({ name: "نیمه‌روز", checkIn: "07:00", checkOut: "12:30" });
  eq((await settingsService.listAttendanceTemplates()).map((t) => t.name), ["روزکاری", "نیمه‌روز"], "دو قالب ذخیره شد");

  const edited = await settingsService.updateAttendanceTemplate(b.id, { name: "نیمه‌روز ۲", checkIn: "07:30", checkOut: "13:00" });
  eq([edited.id, edited.name, edited.checkIn, edited.checkOut], [b.id, "نیمه‌روز ۲", "07:30", "13:00"], "ویرایش با حفظ شناسه");
  check(await rejects(() => settingsService.updateAttendanceTemplate("nope", { name: "x", checkIn: "08:00", checkOut: "09:00" })), "ویرایش قالب ناموجود رد می‌شود");
  // ویرایش بدون تغییر نام (نام خودش) نباید «تکراری» حساب شود.
  check(!(await rejects(() => settingsService.updateAttendanceTemplate(a.id, { name: "روزکاری", checkIn: "08:30", checkOut: "17:00" }))), "ویرایش با همان نام خودش مجاز است");

  await settingsService.setLastAttendanceTemplateId(a.id);
  eq((await settingsService.get()).lastAttendanceTemplateId, a.id, "آخرین قالب استفاده‌شده ذخیره شد");
  check(await rejects(() => settingsService.setLastAttendanceTemplateId("nope")), "شناسهٔ ناموجود برای آخرین قالب رد می‌شود");
  await settingsService.deleteAttendanceTemplate(a.id);
  eq((await settingsService.get()).lastAttendanceTemplateId, null, "حذف قالبِ «آخرین» اشارهٔ معلق را پاک می‌کند");
  eq((await settingsService.listAttendanceTemplates()).map((t) => t.id), [b.id], "فقط قالب حذف‌شده رفت");
  check(await rejects(() => settingsService.deleteAttendanceTemplate("nope")), "حذف قالب ناموجود رد می‌شود");

  console.log("— اعتبارسنجی");
  check(await rejects(() => settingsService.createAttendanceTemplate({ name: "   ", checkIn: "08:00", checkOut: "17:00" })), "نام خالی رد می‌شود");
  check(await rejects(() => settingsService.createAttendanceTemplate({ name: "بد۱", checkIn: "8:00", checkOut: "17:00" })), "ساعت ورود نامعتبر رد می‌شود");
  check(await rejects(() => settingsService.createAttendanceTemplate({ name: "بد۲", checkIn: "08:00", checkOut: "24:00" })), "ساعت خروج نامعتبر رد می‌شود");
  check(await rejects(() => settingsService.createAttendanceTemplate({ name: "نیمه‌روز ۲", checkIn: "08:00", checkOut: "17:00" })), "نام تکراری رد می‌شود");
  check(await rejects(() => settingsService.updateAttendanceTemplate(b.id, { name: "", checkIn: "08:00", checkOut: "17:00" })), "ویرایش با نام خالی رد می‌شود");
  eq((await settingsService.listAttendanceTemplates()).length, 1, "ردشده‌ها چیزی ذخیره نکردند");

  console.log("— سقف ۱۰ قالب");
  for (let i = 0; i < 9; i++) {
    await settingsService.createAttendanceTemplate({ name: `قالب ${i}`, checkIn: "08:00", checkOut: "17:00" });
  }
  eq((await settingsService.listAttendanceTemplates()).length, 10, "ده قالب ذخیره شد");
  check(await rejects(() => settingsService.createAttendanceTemplate({ name: "یازدهم", checkIn: "08:00", checkOut: "17:00" })), "قالب یازدهم رد می‌شود");
  eq((await settingsService.listAttendanceTemplates()).length, 10, "سقف رعایت شد");

  console.log("— رفت‌وبرگشت بکاپ");
  {
    await settingsService.setLastAttendanceTemplateId(b.id);
    const before = await settingsService.get();
    const blob = await backupService.exportAll();
    // خراب‌کردن وضعیت فعلی، سپس بازیابی.
    for (const t of before.attendanceTimeTemplates) await settingsService.deleteAttendanceTemplate(t.id);
    eq((await settingsService.listAttendanceTemplates()).length, 0, "قبل از بازیابی همهٔ قالب‌ها پاک شده‌اند");
    await backupService.importAll(new File([blob], "bk.json", { type: "application/json" }));
    const after = await settingsService.get();
    eq(after.attendanceTimeTemplates, before.attendanceTimeTemplates, "قالب‌ها با بکاپ برگشتند (بدون تغییر)");
    eq(after.lastAttendanceTemplateId, b.id, "آخرین قالب استفاده‌شده هم برگشت");
  }

  console.log("— بکاپ قدیمی بدون فیلد قالب‌ها");
  {
    const row = (await db.settings.get(SETTINGS_ROW_ID))!;
    const legacy = { ...row } as Record<string, unknown>;
    delete legacy.attendanceTimeTemplates;
    delete legacy.lastAttendanceTemplateId;
    await db.settings.put(legacy as never);
    const s = await settingsService.get();
    eq([s.attendanceTimeTemplates, s.lastAttendanceTemplateId], [[], null], "بازیابی/خواندن رکورد قدیمی خطا نمی‌دهد");
    // قالب خراب داخل رکورد (دست‌کاری/بکاپ ناقص) فیلتر می‌شود، نه کرش.
    await db.settings.put({
      ...legacy,
      attendanceTimeTemplates: [{ id: "x", name: "", checkIn: "08:00", checkOut: "17:00" }, { id: "y", name: "خوب", checkIn: "08:00", checkOut: "17:00" }, 5, null],
    } as never);
    eq((await settingsService.get()).attendanceTimeTemplates.map((t) => t.id), ["y"], "قالب‌های خراب فیلتر می‌شوند");
  }

  console.log(`\nنتیجه: ${passed} موفق، ${failed} ناموفق`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
