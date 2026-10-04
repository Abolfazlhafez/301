/**
 * تست تجربی واقعی: عکس‌های «گزارش کار روزانه» (relatedType="site") باید
 * پس از یک چرخهٔ کامل Backup → پاک‌سازی دیتابیس → Restore سالم بمانند —
 * دقیقاً همان الزام صریح پرامپت اصلی: «رسیدها، قبض‌ها، گزارش‌ها و سایر
 * Viewها را [بعد از Restore] آزمایش کن».
 *
 * این مسیر با تست قبلی عکس رسید (cashbookBackupRestore) تفاوت مهمی دارد:
 * عکس رسید با یک foreign key مستقیم (receiptPhotoId) به رکورد وصل است،
 * اما عکس‌های «سایت»/کار روزانه relatedId ندارند (null است) و صرفاً از
 * طریق فیلد date به یک روز خاص گروه‌بندی می‌شوند — یعنی یک الگوی رابطهٔ
 * کاملاً متفاوت که باید جداگانه با داده و کوئری واقعی بررسی شود، نه فقط
 * فرض شود که «چون رسید کار کرد، این هم کار می‌کند».
 */

import "fake-indexeddb/auto";

// --- Polyfill حداقلی FileReader برای محیط Node ---
// backupService.ts از FileReader استفاده می‌کند که یک API استاندارد
// مرورگری است و در Node.js وجود ندارد. خودِ برنامه همیشه در مرورگر/WebView
// اجرا می‌شود که FileReader واقعی آن‌جا از قبل موجود است؛ این polyfill
// صرفاً برای اجراپذیری تست در Node است.
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
        const base64 = btoa(binary);
        this.result = `data:${blob.type || "application/octet-stream"};base64,${base64}`;
        this.onloadend?.();
      })
      .catch((err) => this.onerror?.(err));
  }
}
(globalThis as { FileReader?: unknown }).FileReader ??= NodeFileReaderPolyfill;

import { db, ensureDatabaseSeeded } from "../db";
import { photoService } from "../services/photoService";
import { projectService } from "../services/projectService";
import { backupService } from "../services/backupService";

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

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function makeTestImageFile(name: string): File {
  const bytes = base64ToUint8Array(MINIMAL_PNG_BASE64);
  const arrayBuffer = new ArrayBuffer(bytes.length);
  new Uint8Array(arrayBuffer).set(bytes);
  return new File([arrayBuffer], name, { type: "image/png" });
}

async function main() {
  console.log("=".repeat(70));
  console.log("راه‌اندازی: یک روز کاری با توضیح متنی و دو عکس واقعی (relatedType=site)");
  console.log("=".repeat(70));
  await ensureDatabaseSeeded();

  const workDate = "2026-08-15";
  const activeProjectId = await projectService.getOrCreateActiveProjectId();

  await db.workLogNotes.add({
    id: workDate,
    projectId: activeProjectId,
    date: workDate,
    description: "بتن‌ریزی سقف طبقهٔ دوم انجام شد؛ آرماتوربندی دیوار برشی هم تکمیل شد.",
    updatedAt: new Date().toISOString(),
  });

  const photo1 = await photoService.upload({
    file: makeTestImageFile("سقف-طبقه-دوم.png"),
    relatedType: "site",
    relatedId: null,
    date: workDate,
    caption: "بتن‌ریزی سقف",
  });
  const photo2 = await photoService.upload({
    file: makeTestImageFile("آرماتوربندی-دیوار.png"),
    relatedType: "site",
    relatedId: null,
    date: workDate,
    caption: "آرماتوربندی دیوار برشی",
  });

  const photosBeforeBackup = await photoService.list({ relatedType: "site", from: workDate, to: workDate });
  assertEqual(photosBeforeBackup.length, 2, "قبل از بکاپ: هر دو عکس روز کاری با کوئری relatedType=site+date دیده می‌شوند");

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۱: گرفتن Backup واقعی و پاک‌سازی کامل دیتابیس");
  console.log("=".repeat(70));

  const backupBlob = await backupService.exportAll();
  assertTrue(backupBlob.size > 0, "فایل بکاپ خالی نیست");

  await db.workLogNotes.clear();
  await db.photos.clear();
  const notesAfterClear = await db.workLogNotes.count();
  const photosAfterClear = await db.photos.count();
  assertEqual(notesAfterClear, 0, "بعد از پاک‌سازی، هیچ توضیح گزارش کاری باقی نمانده");
  assertEqual(photosAfterClear, 0, "بعد از پاک‌سازی، هیچ عکسی باقی نمانده");

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۲: Restore از همان فایل بکاپ");
  console.log("=".repeat(70));

  const backupAsFile = new File([backupBlob], "test-backup.json", { type: "application/json" });
  await backupService.importAll(backupAsFile);

  const restoredNote = await db.workLogNotes.get(workDate);
  assertTrue(!!restoredNote, "توضیح متنی گزارش کار روزانه بعد از Restore موجود است");
  assertEqual(
    restoredNote?.description,
    "بتن‌ریزی سقف طبقهٔ دوم انجام شد؛ آرماتوربندی دیوار برشی هم تکمیل شد.",
    "محتوای توضیح گزارش کار دقیقاً دست‌نخورده بازیابی شد"
  );

  console.log();
  console.log("=".repeat(70));
  console.log("مرحلهٔ ۳: بازیابی عکس‌ها — همان کوئری واقعی UI (WorkLogPage/TodayWorkLogCard)");
  console.log("=".repeat(70));

  const photosAfterRestore = await photoService.list({ relatedType: "site", from: workDate, to: workDate });
  assertEqual(photosAfterRestore.length, 2, "بعد از Restore، همان کوئری UI هر دو عکس روز کاری را دوباره نشان می‌دهد");

  const restoredPhoto1 = await db.photos.get(photo1.id);
  const restoredPhoto2 = await db.photos.get(photo2.id);
  assertTrue(!!restoredPhoto1 && !!restoredPhoto2, "هر دو رکورد عکس با همان شناسهٔ اصلی در دیتابیس بازیابی شدند");
  assertTrue((await db.readBlob("photos", restoredPhoto1!.id, "blob")) instanceof Blob, "blob عکس اول بعد از Restore یک Blob واقعی است (نه رشتهٔ base64 خام)");
  assertTrue((await db.readBlob("photos", restoredPhoto2!.id, "blob")) instanceof Blob, "blob عکس دوم بعد از Restore یک Blob واقعی است");

  const captions = photosAfterRestore.map((p) => p.caption).sort();
  assertEqual(
    captions,
    ["آرماتوربندی دیوار برشی", "بتن‌ریزی سقف"],
    "توضیح (caption) هر دو عکس دقیقاً دست‌نخورده بازیابی شد"
  );

  console.log();
  console.log("=".repeat(70));
  console.log("تست تکمیلی: عکس یک روز دیگر (متفاوت) با این روز قاطی نشده");
  console.log("=".repeat(70));

  const otherDate = "2026-08-16";
  await photoService.upload({
    file: makeTestImageFile("روز-دیگر.png"),
    relatedType: "site",
    relatedId: null,
    date: otherDate,
    caption: "عکس یک روز کاملاً دیگر",
  });
  const photosForOriginalDateOnly = await photoService.list({ relatedType: "site", from: workDate, to: workDate });
  assertEqual(
    photosForOriginalDateOnly.length,
    2,
    "بعد از اضافه‌شدن عکس یک روز دیگر، کوئری روز اصلی هنوز دقیقاً همان ۲ عکس را می‌دهد (بدون قاطی‌شدن تاریخ‌ها)"
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
  console.error("خطای اجرای تست:", err);
  throw err;
});
