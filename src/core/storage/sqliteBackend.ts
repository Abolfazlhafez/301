import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import type { RowBackend, StorageOp, StoredRowJson } from "./types";

const DB_NAME = "karegahyar_native";
const BATCH = 400; // سقف تعداد statement در هر executeSet برای batchهای خیلی بزرگ (restore)

function tbl(name: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`نام جدول نامعتبر: ${name}`);
  return `t_${name}`;
}

/**
 * ذخیره‌سازی رکوردها در SQLite نیتیو (Android) — خارج از WebView.
 * هر «جدول» یک جدول SQLite با دو ستون است: id (کلید اصلی) و data (JSON).
 */
export class SqliteRowBackend implements RowBackend {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private conn: SQLiteDBConnection | null = null;

  async open(tables: string[]): Promise<void> {
    if (!this.conn) {
      const consistent = (await this.sqlite.checkConnectionsConsistency()).result;
      const exists = (await this.sqlite.isConnection(DB_NAME, false)).result;
      this.conn =
        consistent && exists
          ? await this.sqlite.retrieveConnection(DB_NAME, false)
          : await this.sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
      await this.conn.open();
    }
    const ddl = tables
      .map((t) => `CREATE TABLE IF NOT EXISTS ${tbl(t)} (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);`)
      .join("\n");
    await this.conn.execute(ddl, true);
  }

  private c(): SQLiteDBConnection {
    if (!this.conn) throw new Error("SQLite باز نشده است.");
    return this.conn;
  }

  async loadAll(table: string): Promise<StoredRowJson[]> {
    const res = await this.c().query(`SELECT id, data FROM ${tbl(table)};`);
    return (res.values ?? []).map((r: { id: string; data: string }) => ({ key: r.id, json: r.data }));
  }

  async apply(ops: StorageOp[]): Promise<void> {
    if (!ops.length) return;
    const set = ops.map((op) => {
      if (op.t === "put") {
        return { statement: `INSERT OR REPLACE INTO ${tbl(op.table)} (id, data) VALUES (?, ?);`, values: [op.key, op.json] };
      }
      if (op.t === "del") return { statement: `DELETE FROM ${tbl(op.table)} WHERE id = ?;`, values: [op.key] };
      return { statement: `DELETE FROM ${tbl(op.table)};`, values: [] as unknown[] };
    });
    // یک تراکنش اتمیک برای کل batch. (executeSet با transaction=true همه را در یک BEGIN/COMMIT می‌گذارد.)
    // فقط وقتی خیلی بزرگ است برای جلوگیری از سقف حافظهٔ پل، به تکه‌ها تقسیم می‌شود.
    if (set.length <= BATCH * 5) {
      await this.c().executeSet(set, true);
      return;
    }
    for (let i = 0; i < set.length; i += BATCH) {
      await this.c().executeSet(set.slice(i, i + BATCH), true);
    }
  }

  async destroy(tables: string[]): Promise<void> {
    await this.c().execute(tables.map((t) => `DELETE FROM ${tbl(t)};`).join("\n"), true);
  }

  async close(): Promise<void> {
    if (this.conn) {
      await this.sqlite.closeConnection(DB_NAME, false).catch(() => {});
      this.conn = null;
    }
  }
}
