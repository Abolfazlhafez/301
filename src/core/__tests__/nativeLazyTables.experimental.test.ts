/**
 * جدول‌های lazy: هنگام open() در RAM نمی‌آیند، اولین دسترسی آن‌ها را یک‌بار (حتی با دسترسی همزمان) می‌خواند،
 * نوشتن/خواندن درست کار می‌کند، و بعد از close+open مجدد داده از backend برمی‌گردد. جدول lazy با فیلد Blob مجاز نیست.
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

interface Row { id: string; n: number }

class SpyRows extends MemoryRowBackend {
  loads: string[] = [];
  override async loadAll(table: string) {
    this.loads.push(table);
    return super.loadAll(table);
  }
}

const DEFS: TableDef[] = [{ name: "hot" }, { name: "cold", lazy: true }];

class TestDb extends NativeDatabase {
  hot: NativeTable<Row>;
  cold: NativeTable<Row>;
  constructor(rows: SpyRows) {
    super("t", DEFS, rows, new MemoryBlobBackend());
    this.hot = this.createTable<Row>("hot");
    this.cold = this.createTable<Row>("cold");
  }
}

async function main() {
  const rows = new SpyRows();
  const db = new TestDb(rows);

  await db.hot.add({ id: "h1", n: 1 });
  check(!rows.loads.includes("cold"), "open() جدول lazy را نخواند", rows.loads);

  // دسترسی همزمان ⇒ فقط یک بار بارگذاری
  await Promise.all([db.cold.add({ id: "c2", n: 2 }), db.cold.add({ id: "c1", n: 1 }), db.cold.toArray()]);
  check(rows.loads.filter((x) => x === "cold").length === 1, "دسترسی همزمان فقط یک بار می‌خواند", rows.loads);
  check((await db.cold.toArray()).map((r) => r.id).join(",") === "c1,c2", "نوشتن و خواندن جدول lazy");
  check((await db.cold.count()) === 2, "count درست است");

  // بسته/باز مجدد ⇒ داده از backend برمی‌گردد و دوباره تنبل است
  await db.close();
  rows.loads = [];
  check((await db.hot.count()) === 1, "جدول عادی بعد از open مجدد");
  check(!rows.loads.includes("cold"), "بعد از open مجدد هم lazy است", rows.loads);
  check((await db.cold.toArray()).length === 2, "داده lazy ماندگار است");

  // تراکنش با جدول lazy
  await db.transaction("rw", [db.hot, db.cold], async () => {
    await db.cold.add({ id: "c3", n: 3 });
    await db.hot.add({ id: "h2", n: 2 });
  });
  check((await db.cold.count()) === 3 && (await db.hot.count()) === 2, "تراکنش روی جدول lazy");
  try {
    await db.transaction("rw", [db.hot, db.cold], async () => {
      await db.cold.add({ id: "c4", n: 4 });
      throw new Error("boom");
    });
  } catch {
    // مورد انتظار
  }
  check((await db.cold.count()) === 3, "rollback روی جدول lazy");

  // محافظ: lazy + Blob ممنوع
  let threw = false;
  try {
    new NativeDatabase("x", [{ name: "p", lazy: true, blobFields: [{ field: "blob", urlField: "blobUrl" }] }], new MemoryRowBackend(), new MemoryBlobBackend());
  } catch {
    threw = true;
  }
  check(threw, "lazy همراه با فیلد Blob رد می‌شود");

  if (failed) {
    console.log(`\n${failed} تست ناموفق`);
    process.exit(1);
  }
  console.log("\nهمهٔ تست‌ها موفق");
}
main();
