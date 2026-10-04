import type { BlobBackend, BlobListEntry, RowBackend, StorageOp, StoredRowJson } from "./types";

/**
 * ⚠️ فقط برای اجرای وب (npm run dev / PWA در مرورگر) که SQLite نیتیو در دسترس نیست.
 * در اپ اندروید (Capacitor) هرگز استفاده نمی‌شود — آنجا SQLite + فایل است.
 */
const DB = "karegah-yar-native-web";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("rows");
      req.result.createObjectStore("blobs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

let sharedDb: Promise<IDBDatabase> | null = null;
const shared = () => (sharedDb ??= openIdb());

export class IdbRowBackend implements RowBackend {
  async open(): Promise<void> {
    await shared();
  }
  async loadAll(table: string): Promise<StoredRowJson[]> {
    const db = await shared();
    const store = db.transaction("rows", "readonly").objectStore("rows");
    const range = IDBKeyRange.bound(`${table}/`, `${table}/\uffff`);
    const [keys, vals] = await Promise.all([reqP(store.getAllKeys(range)), reqP(store.getAll(range))]);
    return keys.map((k, i) => ({ key: String(k).slice(table.length + 1), json: String(vals[i]) }));
  }
  async apply(ops: StorageOp[]): Promise<void> {
    const db = await shared();
    const tx = db.transaction("rows", "readwrite");
    const store = tx.objectStore("rows");
    for (const op of ops) {
      if (op.t === "put") store.put(op.json, `${op.table}/${op.key}`);
      else if (op.t === "del") store.delete(`${op.table}/${op.key}`);
      else store.delete(IDBKeyRange.bound(`${op.table}/`, `${op.table}/\uffff`));
    }
    await done(tx);
  }
  async destroy(tables: string[]): Promise<void> {
    await this.apply(tables.map((t) => ({ t: "clear", table: t }) as StorageOp));
  }
  async close(): Promise<void> {}
}

export class IdbBlobBackend implements BlobBackend {
  private urls = new Map<string, string>();

  async open(): Promise<void> {
    const db = await shared();
    const store = db.transaction("blobs", "readonly").objectStore("blobs");
    const [keys, vals] = await Promise.all([reqP(store.getAllKeys()), reqP(store.getAll())]);
    keys.forEach((k, i) => {
      if (!this.urls.has(String(k))) this.urls.set(String(k), URL.createObjectURL(vals[i] as Blob));
    });
  }
  async write(path: string, blob: Blob): Promise<void> {
    const db = await shared();
    const tx = db.transaction("blobs", "readwrite");
    tx.objectStore("blobs").put(blob, path);
    await done(tx);
    this.urls.set(path, URL.createObjectURL(blob));
  }
  url(path: string): string {
    return this.urls.get(path) ?? "";
  }
  async read(path: string): Promise<Blob> {
    const db = await shared();
    const b = await reqP(db.transaction("blobs", "readonly").objectStore("blobs").get(path));
    if (!b) throw new Error(`فایل یافت نشد: ${path}`);
    return b as Blob;
  }
  async remove(path: string): Promise<void> {
    const db = await shared();
    const tx = db.transaction("blobs", "readwrite");
    tx.objectStore("blobs").delete(path);
    await done(tx);
    const u = this.urls.get(path);
    if (u) URL.revokeObjectURL(u);
    this.urls.delete(path);
  }
  async stat(path: string): Promise<{ size: number } | null> {
    try {
      return { size: (await this.read(path)).size };
    } catch {
      return null;
    }
  }
  async list(): Promise<BlobListEntry[]> {
    const db = await shared();
    const store = db.transaction("blobs", "readonly").objectStore("blobs");
    const [keys, vals] = await Promise.all([reqP(store.getAllKeys()), reqP(store.getAll())]);
    // در IndexedDB زمان تغییر ذخیره نمی‌شود؛ 0 یعنی «نامعلوم» و پاک‌سازی یتیم‌ها در وب اجرا نمی‌شود.
    return keys.map((k, i) => ({ path: String(k), size: (vals[i] as Blob).size, mtime: 0 }));
  }
  async removeAll(): Promise<void> {
    const db = await shared();
    const tx = db.transaction("blobs", "readwrite");
    tx.objectStore("blobs").clear();
    await done(tx);
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls.clear();
  }
}
