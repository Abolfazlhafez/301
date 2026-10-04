import type { BlobBackend, BlobListEntry, RowBackend, StorageOp, StoredRowJson } from "./types";

/** بک‌اند حافظه‌ای: برای تست‌ها و محیط‌های بدون ذخیره‌سازی. */
export class MemoryRowBackend implements RowBackend {
  private tables = new Map<string, Map<string, string>>();

  async open(tables: string[]): Promise<void> {
    for (const t of tables) if (!this.tables.has(t)) this.tables.set(t, new Map());
  }
  async loadAll(table: string): Promise<StoredRowJson[]> {
    return [...(this.tables.get(table) ?? new Map()).entries()].map(([key, json]) => ({ key, json }));
  }
  async apply(ops: StorageOp[]): Promise<void> {
    // اتمیک: ابتدا روی کپی، سپس جایگزینی
    const staged = new Map<string, Map<string, string>>();
    const tbl = (n: string) => {
      if (!staged.has(n)) staged.set(n, new Map(this.tables.get(n) ?? []));
      return staged.get(n)!;
    };
    for (const op of ops) {
      if (op.t === "put") tbl(op.table).set(op.key, op.json);
      else if (op.t === "del") tbl(op.table).delete(op.key);
      else tbl(op.table).clear();
    }
    for (const [n, m] of staged) this.tables.set(n, m);
  }
  async destroy(tables: string[]): Promise<void> {
    for (const t of tables) this.tables.set(t, new Map());
  }
  async close(): Promise<void> {}
}

export class MemoryBlobBackend implements BlobBackend {
  private files = new Map<string, Blob>();
  private writtenAt = new Map<string, number>();
  private urls = new Map<string, string>();

  async open(): Promise<void> {}
  async write(path: string, blob: Blob): Promise<void> {
    this.files.set(path, blob);
    this.writtenAt.set(path, Date.now());
  }
  /** فقط برای تست: تغییر زمان آخرین ویرایش یک فایل (برای شبیه‌سازی فایل قدیمی). */
  setMtimeForTests(path: string, mtime: number): void {
    this.writtenAt.set(path, mtime);
  }
  async list(): Promise<BlobListEntry[]> {
    return [...this.files.entries()].map(([path, b]) => ({ path, size: b.size, mtime: this.writtenAt.get(path) ?? 0 }));
  }
  url(path: string): string {
    let u = this.urls.get(path);
    if (!u) {
      const b = this.files.get(path);
      u = b && typeof URL.createObjectURL === "function" ? URL.createObjectURL(b) : `memory://${path}`;
      this.urls.set(path, u);
    }
    return u;
  }
  async read(path: string): Promise<Blob> {
    const b = this.files.get(path);
    if (!b) throw new Error(`فایل یافت نشد: ${path}`);
    return b;
  }
  async remove(path: string): Promise<void> {
    this.files.delete(path);
    this.writtenAt.delete(path);
    const u = this.urls.get(path);
    if (u && u.startsWith("blob:")) URL.revokeObjectURL(u);
    this.urls.delete(path);
  }
  async stat(path: string): Promise<{ size: number } | null> {
    const b = this.files.get(path);
    return b ? { size: b.size } : null;
  }
  async removeAll(): Promise<void> {
    this.files.clear();
    this.writtenAt.clear();
    this.urls.clear();
  }
}
