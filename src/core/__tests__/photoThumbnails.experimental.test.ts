/**
 * پیش‌نمایش عکس‌ها (حافظهٔ کم) + پاک‌سازی فایل‌های یتیم:
 *  - attachBlob: نوشتن اتمیک یک فایل مشتق‌شده روی رکورد موجود بدون بازنویسی فیلدهای دیگر
 *  - صف ساخت پیش‌نمایش: سریالی، بدون کار برای عکس‌های ازدیدرفته، حافظه از شکست‌ها
 *  - cleanOrphanBlobs: فقط یتیم‌های قدیمی؛ محافظ‌های ضد از دست رفتن داده
 *  - computeThumbSize: ابعاد محدود و با حفظ نسبت
 */
import "fake-indexeddb/auto";
import { NativeDatabase, NativeTable } from "../storage/nativeStore";
import { MemoryBlobBackend, MemoryRowBackend } from "../storage/memoryBackend";
import { cleanOrphanBlobs } from "../storage/orphanBlobCleanup";
import type { TableDef } from "../storage/types";
import { computeThumbSize, setThumbnailEncoderForTests, THUMB_MAX_HEIGHT, THUMB_WIDTH } from "../../shared/utils/imageThumbnail";
import { db } from "../db";
import { clearPhotoUrlCachesForTests, resolvePhotoThumbUrl } from "../services/photoService";
import {
  ensurePhotoThumbnail,
  forgetThumbnailFailure,
  pendingThumbnailJobs,
  resetThumbnailQueueForTests,
} from "../services/photoThumbnailService";
import type { PhotoWithBlob } from "../dbTypes";

let passed = 0;
let failed = 0;
function check(cond: boolean, name: string, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}
const eq = (a: unknown, b: unknown, name: string) => check(JSON.stringify(a) === JSON.stringify(b), name, { a, b });
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const bytes = (s: string, type = "image/jpeg") => new Blob([new TextEncoder().encode(s)], { type });

// ───────── جدول آزمایشی برای attachBlob/یتیم‌ها ─────────
interface Pic { id: string; caption: string; blobUrl: string; thumbBlobUrl?: string }
interface PicW { id: string; caption: string; blob?: Blob; thumbBlob?: Blob }
const DEFS: TableDef[] = [
  { name: "pics", blobFields: [{ field: "blob", urlField: "blobUrl" }, { field: "thumbBlob", urlField: "thumbBlobUrl" }] },
  { name: "other" },
];
/** بک‌اند فایل کُند برای thumb: فاصلهٔ «نوشتن فایل» تا «ثبت رکورد» را بزرگ می‌کند تا رقابت واقعاً رخ دهد. */
class SlowThumbBlobBackend extends MemoryBlobBackend {
  override async write(path: string, blob: Blob): Promise<void> {
    if (path.includes("__thumbBlob__")) await tick(40);
    return super.write(path, blob);
  }
}

class TestDb extends NativeDatabase {
  pics: NativeTable<Pic, PicW>;
  constructor(rows: MemoryRowBackend, blobs: MemoryBlobBackend) {
    super("t", DEFS, rows, blobs);
    this.pics = this.createTable<Pic, PicW>("pics");
  }
}

function fakePhoto(id: string, over: Partial<PhotoWithBlob> = {}): PhotoWithBlob {
  return {
    id,
    projectId: "p1",
    relatedType: "site",
    relatedId: null,
    date: "2025-01-01",
    caption: null,
    filename: `${id}.jpg`,
    originalName: `${id}.jpg`,
    mimeType: "image/jpeg",
    fileSize: 10,
    createdAt: new Date().toISOString(),
    blob: bytes(`ORIGINAL-${id}`),
    detectedKind: "jpeg",
    ...over,
  };
}

async function main() {
  console.log("— computeThumbSize —");
  eq(computeThumbSize(4000, 3000), { width: THUMB_WIDTH, height: 240 }, "عکس افقی بزرگ → عرض ۳۲۰ با حفظ نسبت");
  eq(computeThumbSize(100, 80), { width: 100, height: 80 }, "عکس کوچک بزرگ نمی‌شود");
  const tall = computeThumbSize(1000, 20000);
  check(tall.height <= THUMB_MAX_HEIGHT && tall.height > 0, "عکس خیلی بلند: ارتفاع سقف دارد", tall);
  eq(computeThumbSize(0, 10), { width: 0, height: 0 }, "ابعاد نامعتبر → صفر");

  console.log("— attachBlob —");
  {
    const rows = new MemoryRowBackend();
    const blobs = new MemoryBlobBackend();
    const t = new TestDb(rows, blobs);
    await t.pics.add({ id: "a", caption: "اولیه", blob: bytes("BIG") });
    const before = await t.getBlobRef("pics", "a", "blob");

    const ok = await t.pics.attachBlob("a", "thumbBlob", bytes("T1"));
    check(ok, "attachBlob روی رکورد موجود true می‌دهد");
    const row = await t.pics.get("a");
    check(!!row?.thumbBlobUrl, "thumbBlobUrl بعد از attach در رکورد هست");
    eq(row?.caption, "اولیه", "فیلدهای دیگر دست‌نخورده");
    eq((await t.getBlobRef("pics", "a", "blob"))?.path, before?.path, "فایل اصلی دست‌نخورده (همان مسیر)");
    eq(await (await t.readBlob("pics", "a", "thumbBlob"))?.text(), "T1", "محتوای thumb درست خوانده می‌شود");

    // جایگزینی thumb قدیمی: فایل قبلی پاک می‌شود
    const oldThumb = await t.getBlobRef("pics", "a", "thumbBlob");
    await t.pics.attachBlob("a", "thumbBlob", bytes("T2"));
    check(!!oldThumb && (await blobs.stat(oldThumb.path)) === null, "thumb قدیمی بعد از جایگزینی از دیسک پاک شد");

    // ماندگاری: دیتابیس تازه از روی همان backendها
    const reopened = new TestDb(rows, blobs);
    check(!!(await reopened.pics.get("a"))?.thumbBlobUrl, "thumb بعد از «ری‌استارت» ماندگار است");

    // رکورد وجود ندارد
    const before2 = (await blobs.list()).length;
    check((await t.pics.attachBlob("zzz", "thumbBlob", bytes("X"))) === false, "رکورد ناموجود → false");
    eq((await blobs.list()).length, before2, "برای رکورد ناموجود فایلی روی دیسک نمی‌ماند");

    let threw = false;
    try { await t.pics.attachBlob("a", "nope", bytes("X")); } catch { threw = true; }
    check(threw, "فیلد ناشناخته خطا می‌دهد");

    // حذف رکورد → هر دو فایل (اصلی + thumb) پاک می‌شوند
    await t.pics.delete("a");
    eq((await blobs.list()).length, 0, "حذف رکورد، فایل اصلی و thumb را هر دو پاک می‌کند");
  }
  {
    // رقابت واقعی (با نوشتن کُند فایل): ویرایش توضیح «وسط» نوشتن thumb نباید گم شود
    const blobs = new SlowThumbBlobBackend();
    const t = new TestDb(new MemoryRowBackend(), blobs);
    await t.pics.add({ id: "r", caption: "قبل", blob: bytes("BIG") });
    const attaching = t.pics.attachBlob("r", "thumbBlob", bytes("T3"));
    await tick(5); // attach در حال نوشتن فایل است
    await t.pics.update("r", { caption: "ویرایش هم‌زمان" });
    await attaching;
    const after = await t.pics.get("r");
    eq(after?.caption, "ویرایش هم‌زمان", "ویرایش هم‌زمان توضیح با attach بازنویسی نشد");
    check(!!after?.thumbBlobUrl, "thumb هم ثبت شد");

    // رکورد وسط نوشتن حذف شود → فایل thumb یتیم نمی‌ماند
    await t.pics.add({ id: "d", caption: "x", blob: bytes("BIG2") });
    const attaching2 = t.pics.attachBlob("d", "thumbBlob", bytes("T4"));
    await tick(5);
    await t.pics.delete("d");
    check((await attaching2) === false, "رکورد وسط کار حذف شد → false");
    check(!(await blobs.list()).some((f) => f.path.startsWith("pics/d__")), "فایل‌های رکورد حذف‌شده (از جمله thumb) روی دیسک نماند");
  }

  console.log("— صف ساخت پیش‌نمایش —");
  {
    clearPhotoUrlCachesForTests();
    resetThumbnailQueueForTests();
    let calls = 0;
    let concurrent = 0;
    let maxConcurrent = 0;
    const sources: string[] = [];
    setThumbnailEncoderForTests(async (src) => {
      calls++;
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      sources.push(await src.text());
      await tick(15);
      concurrent--;
      return bytes(`THUMB(${calls})`, "image/webp");
    });

    await db.photos.add(fakePhoto("q1"));
    await db.photos.add(fakePhoto("q2"));
    await db.photos.add(fakePhoto("q3"));
    await db.photos.add(fakePhoto("heic1", { detectedKind: "heic", mimeType: "image/heic", displayConversionFailed: true }));
    await db.photos.add(fakePhoto("heic2", { detectedKind: "heic", mimeType: "image/heic", displayBlob: bytes("DISPLAY-JPEG") }));

    check(resolvePhotoThumbUrl("q1.jpg") === "", "قبل از ساخت، آدرس پیش‌نمایش خالی است (نه عکس اصلی)");
    eq(calls, 0, "هیچ پیش‌نمایشی قبل از درخواست ساخته نمی‌شود (ورود به برنامه = صفر decode)");

    const [u1, u2, u3] = await Promise.all([
      ensurePhotoThumbnail({ id: "q1", filename: "q1.jpg" }),
      ensurePhotoThumbnail({ id: "q2", filename: "q2.jpg" }),
      ensurePhotoThumbnail({ id: "q3", filename: "q3.jpg" }),
    ]);
    check(!!u1 && !!u2 && !!u3, "برای هر سه عکس پیش‌نمایش ساخته شد");
    eq(maxConcurrent, 1, "هم‌زمان فقط یک عکس decode می‌شود (صف سریالی)");
    eq(pendingThumbnailJobs(), 0, "صف بعد از اتمام خالی است");
    check(resolvePhotoThumbUrl("q1.jpg") === u1, "آدرس در کش ثبت شد");
    check(!!(await db.photos.get("q2"))?.thumbBlobUrl, "thumb روی رکورد ماندگار شد");
    eq(await (await db.readBlob("photos", "q1", "blob"))?.text(), "ORIGINAL-q1", "فایل اصلی عکس دست‌نخورده ماند");

    // درخواست دوباره: از کش، بدون کار جدید
    const callsBefore = calls;
    await ensurePhotoThumbnail({ id: "q1", filename: "q1.jpg" });
    eq(calls, callsBefore, "درخواست دوباره از کش جواب می‌گیرد، decode جدید ندارد");

    // عکس ازدیدرفته: اصلاً باز نمی‌شود
    const callsBeforeSkip = calls;
    const skipped = await Promise.all([
      ensurePhotoThumbnail({ id: "q1", filename: "q1.jpg" }, () => false), // کش دارد
      (async () => {
        await db.photos.add(fakePhoto("scrolled"));
        return ensurePhotoThumbnail({ id: "scrolled", filename: "scrolled.jpg" }, () => false);
      })(),
    ]);
    check(skipped[1] === null, "اگر دیگر لازم نیست (اسکرول شد) null برمی‌گردد");
    eq(calls, callsBeforeSkip, "برای عکس ازدیدرفته هیچ decode‌ای انجام نشد");
    check(!(await db.photos.get("scrolled"))?.thumbBlobUrl, "برای عکس ازدیدرفته thumb نوشته نشد");

    // جست‌وجو با نام فایل (رسید صندوق فقط filename دارد)
    const byName = await ensurePhotoThumbnail({ filename: "scrolled.jpg" });
    check(!!byName, "فقط با filename هم پیش‌نمایش ساخته می‌شود");

    // HEIC بدون نسخهٔ قابل‌نمایش: decode ممکن نیست → encoder صدا زده نمی‌شود
    const callsBeforeHeic = calls;
    const heicFail = await ensurePhotoThumbnail({ id: "heic1", filename: "heic1.jpg" });
    check(heicFail === null && calls === callsBeforeHeic, "HEIC بدون display → null و بدون decode");

    // HEIC با نسخهٔ JPEG: از displayBlob ساخته می‌شود
    sources.length = 0;
    await ensurePhotoThumbnail({ id: "heic2", filename: "heic2.jpg" });
    eq(sources, ["DISPLAY-JPEG"], "برای HEIC منبع پیش‌نمایش نسخهٔ JPEG قابل‌نمایش است");

    // حذف عکس قبل از رسیدن نوبت: خطا نمی‌دهد
    await db.photos.add(fakePhoto("gone"));
    const pGone = ensurePhotoThumbnail({ id: "gone", filename: "gone.jpg" });
    await db.photos.delete("gone");
    check((await pGone) === null, "عکس حذف‌شده → null بدون خطا");

    // شکست: encoder null بدهد → در این نشست دوباره تلاش نمی‌شود، تا forget
    setThumbnailEncoderForTests(async () => {
      calls++;
      return null;
    });
    await db.photos.add(fakePhoto("bad"));
    const c0 = calls;
    check((await ensurePhotoThumbnail({ id: "bad", filename: "bad.jpg" })) === null, "encoder شکست بخورد → null");
    await ensurePhotoThumbnail({ id: "bad", filename: "bad.jpg" });
    eq(calls - c0, 1, "بعد از شکست در همین نشست دوباره تلاش نمی‌شود (حلقهٔ بی‌پایان نداریم)");
    forgetThumbnailFailure("bad");
    await ensurePhotoThumbnail({ id: "bad", filename: "bad.jpg" });
    eq(calls - c0, 2, "forgetThumbnailFailure اجازهٔ تلاش دوباره می‌دهد");

    // encoder که throw می‌کند هم برنامه را نمی‌اندازد
    setThumbnailEncoderForTests(async () => {
      throw new Error("OOM");
    });
    await db.photos.add(fakePhoto("boom"));
    check((await ensurePhotoThumbnail({ id: "boom", filename: "boom.jpg" })) === null, "exception در encoder → null، بدون کرش");
    setThumbnailEncoderForTests(null);
  }

  console.log("— پاک‌سازی فایل‌های یتیم —");
  {
    const NOW = 1_000_000_000_000;
    const OLD = NOW - 60 * 60 * 1000;
    const FRESH = NOW - 60 * 1000;
    const rows = new MemoryRowBackend();
    const blobs = new MemoryBlobBackend();
    const t = new TestDb(rows, blobs);
    await t.pics.add({ id: "keep", caption: "k", blob: bytes("K"), thumbBlob: bytes("KT") });
    const keepRefs = [(await t.getBlobRef("pics", "keep", "blob"))!.path, (await t.getBlobRef("pics", "keep", "thumbBlob"))!.path];
    for (const p of keepRefs) blobs.setMtimeForTests(p, OLD);

    await blobs.write("pics/orphan-old__blob__x.jpg", bytes("O1"));
    await blobs.write("pics/orphan-fresh__blob__x.jpg", bytes("O2"));
    await blobs.write("pics/orphan-unknown__blob__x.jpg", bytes("O3"));
    blobs.setMtimeForTests("pics/orphan-old__blob__x.jpg", OLD);
    blobs.setMtimeForTests("pics/orphan-fresh__blob__x.jpg", FRESH);
    blobs.setMtimeForTests("pics/orphan-unknown__blob__x.jpg", 0);

    const dry = await cleanOrphanBlobs(t, { now: NOW, dryRun: true });
    eq(dry.orphans, ["pics/orphan-old__blob__x.jpg"], "dryRun: فقط یتیمِ قدیمی گزارش می‌شود");
    eq(dry.removed, 0, "dryRun چیزی پاک نمی‌کند");
    check((await blobs.stat("pics/orphan-old__blob__x.jpg")) !== null, "dryRun: فایل هنوز هست");

    const res = await cleanOrphanBlobs(t, { now: NOW });
    eq(res.removed, 1, "یک یتیم قدیمی پاک شد");
    check((await blobs.stat("pics/orphan-old__blob__x.jpg")) === null, "یتیم قدیمی رفت");
    check((await blobs.stat("pics/orphan-fresh__blob__x.jpg")) !== null, "یتیم تازه (ممکن است در حال نوشتن باشد) نگه داشته شد");
    check((await blobs.stat("pics/orphan-unknown__blob__x.jpg")) !== null, "فایل با زمان نامعلوم هرگز پاک نمی‌شود");
    check((await blobs.stat(keepRefs[0])) !== null && (await blobs.stat(keepRefs[1])) !== null, "فایل اصلی و thumbِ رکورد دست‌نخورده");
    check(!!(await t.pics.get("keep"))?.thumbBlobUrl, "رکورد سالم است");
  }
  {
    // محافظ: هیچ رکوردی به هیچ فایلی اشاره نمی‌کند (مثلاً خواندن دیتابیس خراب شده) → هیچ‌چیز پاک نشود
    const blobs = new MemoryBlobBackend();
    const t = new TestDb(new MemoryRowBackend(), blobs);
    for (let i = 0; i < 5; i++) {
      await blobs.write(`pics/f${i}.jpg`, bytes("X"));
      blobs.setMtimeForTests(`pics/f${i}.jpg`, 1);
    }
    const r = await cleanOrphanBlobs(t, { now: 10 ** 12 });
    eq([r.removed, r.skippedReason], [0, "no-references"], "بدون هیچ ارجاعی: پاک‌سازی لغو می‌شود");
    eq((await blobs.list()).length, 5, "همهٔ فایل‌ها سالم ماندند");
  }
  {
    // محافظ: بیش از نصف فایل‌ها یتیم → مشکوک
    const blobs = new MemoryBlobBackend();
    const t = new TestDb(new MemoryRowBackend(), blobs);
    await t.pics.add({ id: "only", caption: "x", blob: bytes("K") });
    blobs.setMtimeForTests((await t.getBlobRef("pics", "only", "blob"))!.path, 1);
    for (let i = 0; i < 30; i++) {
      await blobs.write(`pics/o${i}.jpg`, bytes("X"));
      blobs.setMtimeForTests(`pics/o${i}.jpg`, 1);
    }
    const r = await cleanOrphanBlobs(t, { now: 10 ** 12 });
    eq([r.removed, r.skippedReason], [0, "too-many-orphans"], "نسبت یتیم‌ها مشکوک است → لغو");
    eq((await blobs.list()).length, 31, "هیچ فایلی پاک نشد");
  }
  {
    const t = new TestDb(new MemoryRowBackend(), new MemoryBlobBackend());
    const r = await cleanOrphanBlobs(t);
    eq(r.skippedReason, "no-files", "بدون فایل: بی‌هزینه رد می‌شود");
  }

  console.log("\n" + "=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
