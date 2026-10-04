/**
 * رگرسیون بهینه‌سازی nativeStore: where()/WhereClause به‌جای «کپی+sort کل جدول سپس فیلتر»
 * اکنون «فیلتر سپس sort فقط نتیجه» می‌کنند. خروجی باید دقیقاً همان ترتیب قبلی (بر اساس id) باشد.
 * همچنین view() سطحی برای جدول Blob نباید رکورد ذخیره‌شده را تغییر دهد.
 */
import { NativeDatabase, NativeTable } from "../storage/nativeStore";
import { MemoryBlobBackend, MemoryRowBackend } from "../storage/memoryBackend";
import type { TableDef } from "../storage/types";

let failed = 0;
function check(cond: boolean, name: string, extra?: unknown) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failed++;
    console.log(`  ❌ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}

interface Item { id: string; workerId: string; date: string; n: number }
interface Pic { id: string; caption: string; blobUrl: string }
interface PicW { id: string; caption: string; blob?: Blob }

const DEFS: TableDef[] = [{ name: "items" }, { name: "pics", blobFields: [{ field: "blob", urlField: "blobUrl" }] }];

class TestDb extends NativeDatabase {
  items: NativeTable<Item>;
  pics: NativeTable<Pic, PicW>;
  constructor() {
    super("t", DEFS, new MemoryRowBackend(), new MemoryBlobBackend());
    this.items = this.createTable<Item>("items");
    this.pics = this.createTable<Pic, PicW>("pics");
  }
}

async function main() {
  const db = new TestDb();
  // عمداً نامرتب اضافه می‌شود تا ترتیب خروجی فقط از sort بر اساس id بیاید
  await db.items.bulkAdd([
    { id: "d", workerId: "w2", date: "2025-01-05", n: 4 },
    { id: "a", workerId: "w1", date: "2025-01-01", n: 1 },
    { id: "c", workerId: "w2", date: "2025-01-02", n: 3 },
    { id: "b", workerId: "w1", date: "2025-01-02", n: 2 },
  ]);

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id).join(",");
  check(ids(await db.items.where({ workerId: "w2" }).toArray()) === "c,d", "where(criteria): ترتیب id");
  check(ids(await db.items.where({ workerId: "w1", date: "2025-01-02" }).toArray()) === "b", "where(چند شرط)");
  check((await db.items.where({ workerId: "zzz" }).toArray()).length === 0, "where بدون تطابق خالی است");
  check((await db.items.where({ workerId: "w1" }).first())?.id === "a", "first() اولین id");
  check(ids(await db.items.where("workerId").equals("w2").toArray()) === "c,d", "WhereClause.equals: ترتیب id");
  check(ids(await db.items.where("date").equals("2025-01-02").toArray()) === "b,c", "equals روی تاریخ مشترک: tie-break با id");
  check(ids(await db.items.toArray()) === "a,b,c,d", "toArray کل جدول همچنان sort‌شده");

  // view() سطحی: فیلتر روی جدول Blob نباید رکورد ذخیره‌شده را تغییر دهد
  await db.pics.add({ id: "p1", caption: "x", blob: new Blob(["hello"], { type: "image/png" }) });
  const before = await db.pics.toArray();
  const hit = await db.pics.filter((p) => p.caption === "x").toArray();
  const after = await db.pics.toArray();
  check(hit.length === 1 && hit[0].id === "p1", "filter روی جدول Blob کار می‌کند");
  check(JSON.stringify(before) === JSON.stringify(after), "filter رکورد ذخیره‌شده را تغییر نمی‌دهد");

  if (failed) {
    console.log(`\n${failed} تست ناموفق`);
    process.exit(1);
  }
  console.log("\nهمهٔ تست‌ها موفق");
}
main();
