/**
 * تست موتور ذخیره‌سازی نیتیو (جایگزین Dexie): معناشناسی کوئری‌ها، تراکنش/rollback،
 * فایل‌کردن Blobها، ماندگاری بعد از «ری‌استارت» و مهاجرت یک‌باره از IndexedDB قدیمی.
 */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { NativeDatabase, NativeTable } from "../storage/nativeStore";
import { MemoryBlobBackend, MemoryRowBackend } from "../storage/memoryBackend";
import type { TableDef } from "../storage/types";

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

interface Item { id: string; workerId: string; date: string; n: number; tag?: string }
interface Pic { id: string; caption: string; blobUrl: string; displayBlobUrl?: string }
interface PicW { id: string; caption: string; blob?: Blob; displayBlob?: Blob }

const DEFS: TableDef[] = [
  { name: "items" },
  { name: "pics", blobFields: [{ field: "blob", urlField: "blobUrl" }, { field: "displayBlob", urlField: "displayBlobUrl" }] },
];

class TestDb extends NativeDatabase {
  items: NativeTable<Item>;
  pics: NativeTable<Pic, PicW>;
  constructor(rows: MemoryRowBackend, blobs: MemoryBlobBackend) {
    super("t", DEFS, rows, blobs);
    this.items = this.createTable<Item>("items");
    this.pics = this.createTable<Pic, PicW>("pics");
  }
}

const bytes = (s: string) => new Blob([new TextEncoder().encode(s)], { type: "image/png" });
async function text(b: Blob | null) {
  return b ? new TextDecoder().decode(await b.arrayBuffer()) : null;
}

async function main() {
  const rows = new MemoryRowBackend();
  const blobs = new MemoryBlobBackend();
  const db = new TestDb(rows, blobs);

  console.log("— کوئری‌ها و CRUD —");
  await db.items.bulkAdd([
    { id: "a", workerId: "w1", date: "2025-01-01", n: 1 },
    { id: "b", workerId: "w1", date: "2025-01-02", n: 2 },
    { id: "c", workerId: "w2", date: "2025-01-02", n: 3 },
    { id: "d", workerId: "w2", date: "2025-01-05", n: 4 },
  ]);
  eq(await db.items.count(), 4, "count بعد از bulkAdd");
  let dup = "";
  try { await db.items.add({ id: "a", workerId: "x", date: "x", n: 0 }); } catch (e) { dup = (e as Error).name; }
  eq(dup, "ConstraintError", "add روی کلید موجود → ConstraintError");
  eq((await db.items.where({ workerId: "w1" }).toArray()).map((r) => r.id), ["a", "b"], "where({field}) شیء");
  eq((await (db.items.where("date") as never as { equals(v: unknown): { toArray(): Promise<Item[]> } }).equals("2025-01-02").toArray()).map((r) => r.id), ["b", "c"], "where(field).equals");
  eq((await (db.items.where("[workerId+date]") as never as { equals(v: unknown): { first(): Promise<Item> } }).equals(["w2", "2025-01-05"]).first())?.id, "d", "ایندکس مرکب [a+b]");
  eq((await (db.items.where("n") as never as { between(a: unknown, b: unknown, c?: boolean, d?: boolean): { toArray(): Promise<Item[]> } }).between(2, 4).toArray()).map((r) => r.id), ["b", "c"], "between (بازهٔ نیم‌باز)");
  eq((await (db.items.where("workerId") as never as { anyOf(...v: unknown[]): { count(): Promise<number> } }).anyOf("w1", "w2").count()), 4, "anyOf");
  eq((await db.items.orderBy("n").reverse().limit(2).toArray()).map((r) => r.id), ["d", "c"], "orderBy + reverse + limit");
  eq((await db.items.filter((r) => r.n > 1).sortBy("date")).map((r) => r.id), ["b", "c", "d"], "filter + sortBy");
  const got = await db.items.get("a");
  got!.n = 999; // تغییر نسخهٔ برگشتی نباید کش را خراب کند
  eq((await db.items.get("a"))?.n, 1, "get کپی مستقل برمی‌گرداند");
  eq(await db.items.update("a", { tag: "x" }), 1, "update رکورد موجود → 1");
  await db.items.update("a", { tag: undefined });
  eq("tag" in ((await db.items.get("a")) as object), false, "update با undefined فیلد را حذف می‌کند (مثل Dexie)");
  eq(await db.items.where({ workerId: "w2" }).modify({ n: 0 }), 2, "modify({}) تعداد را برمی‌گرداند");
  await db.items.where({ workerId: "w2" }).modify((r) => { r.n += 10; });
  eq((await db.items.get("c"))?.n, 10, "modify(fn)");
  await db.items.bulkDelete(["a", "b"]);
  eq(await db.items.count(), 2, "bulkDelete");

  console.log("— تراکنش و rollback —");
  let threw = false;
  try {
    await db.transaction("rw", [db.items], async () => {
      await db.items.add({ id: "t1", workerId: "w9", date: "d", n: 1 });
      await db.items.delete("c");
      throw new Error("boom");
    });
  } catch { threw = true; }
  check(threw, "خطا از تراکنش بیرون می‌آید");
  eq((await db.items.toArray()).map((r) => r.id), ["c", "d"], "rollback: حافظه دقیقاً به حالت قبل برگشت");
  const db2probe = new TestDb(rows, blobs);
  eq((await db2probe.items.toArray()).map((r) => r.id), ["c", "d"], "rollback: چیزی روی دیسک نوشته نشده");
  await db.transaction("rw", [db.items], async () => {
    await db.items.add({ id: "t2", workerId: "w9", date: "d", n: 1 });
    await db.items.delete("c");
  });
  eq((await new TestDb(rows, blobs).items.toArray()).map((r) => r.id), ["d", "t2"], "تراکنش موفق به‌صورت اتمیک ماندگار شد");

  console.log("— Blob → فایل —");
  const png = bytes("PNG-BYTES-1");
  await db.pics.add({ id: "p1", caption: "c1", blob: png });
  const p1 = await db.pics.get("p1");
  check(!!p1 && !("blob" in (p1 as object)), "خواندن، Blob داخل رکورد برنمی‌گرداند");
  check(!!p1?.blobUrl, "به‌جایش blobUrl می‌دهد");
  eq(await text(await db.readBlob("pics", "p1", "blob")), "PNG-BYTES-1", "readBlob دقیقاً همان بایت‌ها را برمی‌گرداند");
  const ref1 = await db.getBlobRef("pics", "p1", "blob");
  check(!!ref1 && (await blobs.stat(ref1.path))?.size === png.size, "فایل واقعاً روی backend نوشته شده");
  // put بدون blob باید فایل موجود را حفظ کند
  await db.pics.put({ ...p1!, caption: "c1-edited" });
  eq(await text(await db.readBlob("pics", "p1", "blob")), "PNG-BYTES-1", "put بدون blob فایل قبلی را حفظ می‌کند");
  eq((await db.pics.get("p1"))?.caption, "c1-edited", "متادیتا به‌روز شد");
  // افزودن displayBlob
  await db.pics.put({ ...(await db.pics.get("p1"))!, displayBlob: bytes("JPEG-DISPLAY") });
  eq(await text(await db.readBlob("pics", "p1", "displayBlob")), "JPEG-DISPLAY", "displayBlob به‌عنوان فایل دوم ذخیره شد");
  // جایگزینی blob → فایل قدیمی پاک شود
  await db.pics.put({ ...(await db.pics.get("p1"))!, blob: bytes("PNG-BYTES-2") });
  eq(await text(await db.readBlob("pics", "p1", "blob")), "PNG-BYTES-2", "جایگزینی Blob");
  check((await blobs.stat(ref1!.path)) === null, "فایل قدیمی بعد از جایگزینی پاک شد (نشتی فایل نداریم)");
  const refNow = (await db.getBlobRef("pics", "p1", "blob"))!;
  await db.pics.delete("p1");
  check((await blobs.stat(refNow.path)) === null, "حذف رکورد → فایل‌هایش هم پاک شد");

  console.log("— rollback و فایل‌های یتیم —");
  let leaked = "";
  try {
    await db.transaction("rw", [db.pics], async () => {
      await db.pics.add({ id: "p2", caption: "x", blob: bytes("ROLLED") });
      leaked = (await db.getBlobRef("pics", "p2", "blob"))?.path ?? "";
      throw new Error("fail");
    });
  } catch { /* انتظار می‌رود */ }
  check(leaked !== "" && (await blobs.stat(leaked)) === null, "تراکنش ناموفق: فایل‌های نوشته‌شده پاک شدند");
  eq(await db.pics.count(), 0, "تراکنش ناموفق: رکورد عکس نیست");

  console.log("— ماندگاری بعد از ری‌استارت —");
  await db.pics.add({ id: "p3", caption: "persist", blob: bytes("PERSIST") });
  const reopened = new TestDb(rows, blobs);
  eq((await reopened.pics.get("p3"))?.caption, "persist", "رکورد بعد از باز شدن دوبارهٔ دیتابیس هست");
  eq(await text(await reopened.readBlob("pics", "p3", "blob")), "PERSIST", "فایل هم هست");

  console.log("— مهاجرت یک‌باره از IndexedDB قدیمی (شامل عکس و صوت واقعی) —");
  const old = new Dexie("karegah-yar-db");
  old.version(1).stores({ workers: "id, isActive", photos: "id, relatedType, relatedId, date, createdAt", settings: "id" });
  await old.open();
  const photoBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5]);
  await old.table("photos").add({
    id: "legacy-photo", relatedType: "site", relatedId: null, date: "2025-02-02", createdAt: "x",
    filename: "legacy-photo.png", originalName: "a.png", mimeType: "image/png", fileSize: photoBytes.length,
    blob: new Blob([photoBytes], { type: "image/png" }),
  });
  await old.table("workers").add({ id: "w-old", firstName: "Ali", lastName: "R", isActive: true, createdAt: "x" });
  old.close();
  const { db: realDb, ensureDatabaseSeeded } = await import("../db");
  await ensureDatabaseSeeded();
  const migratedPhoto = await realDb.photos.get("legacy-photo");
  check(!!migratedPhoto, "عکس قدیمی بعد از مهاجرت در دیتابیس جدید هست");
  check(!!migratedPhoto?.blobUrl && !("blob" in (migratedPhoto as object)), "عکس مهاجرت‌شده فایل‌محور است (Blob داخل رکورد نیست)");
  const migratedBlob = await realDb.readBlob("photos", "legacy-photo", "blob");
  eq(Array.from(new Uint8Array((await migratedBlob!.arrayBuffer()))), Array.from(photoBytes), "بایت‌به‌بایت همان عکس قدیمی");
  eq((await realDb.workers.get("w-old"))?.firstName, "Ali", "رکوردهای عادی هم منتقل شدند");
  eq(await Dexie.exists("karegah-yar-db"), false, "IndexedDB قدیمی بعد از مهاجرت موفق پاک شد (آزادسازی WebView)");

  console.log("\n" + "=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));
  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
}

main().catch((e) => {
  console.error("خطای اجرای تست:", e);
  process.exit(1);
});
