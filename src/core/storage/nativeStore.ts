import type { BlobBackend, BlobFileRef, RowBackend, StorageOp, TableDef } from "./types";

/**
 * NativeDatabase — جایگزین Dexie با همان API مورد استفادهٔ پروژه
 * (get/put/add/update/delete/bulkAdd/where/filter/toArray/count/modify/transaction ...).
 *
 *  - همهٔ رکوردها در حافظه (Map) نگه‌داری می‌شوند و پرس‌وجوها در JS اجرا می‌شوند
 *    (حجم داده‌های این برنامه کوچک است؛ Blobها بیرون از رکورد، روی دیسک هستند).
 *  - هر تغییر قبل از resolve شدن Promise در پایگاه‌داده نیتیو (SQLite) دوام می‌گیرد.
 *  - transaction(): همهٔ تغییرات یک تراکنش با یک batch اتمیک نوشته می‌شود و در صورت
 *    خطا، حافظه به حالت قبل برمی‌گردد (rollback).
 */

type Row = Record<string, unknown>;
type StoredRow = Row & { __files?: Record<string, BlobFileRef> };

export class ConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConstraintError";
  }
}

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

function isBlob(v: unknown): v is Blob {
  return typeof Blob !== "undefined" && v instanceof Blob;
}

function cmp(a: unknown, b: unknown): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const c = cmp(a[i], b[i]);
      if (c !== 0) return c;
    }
    return a.length - b.length;
  }
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return (a as number | string) < (b as number | string) ? -1 : 1;
}

function getPath(row: Row, path: string): unknown {
  if (!path.includes(".")) return row[path];
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Row)[k]), row);
}

function setPath(row: Row, path: string, value: unknown): void {
  const parts = path.split(".");
  let o = row;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = o[parts[i]];
    if (next == null || typeof next !== "object") o[parts[i]] = {};
    o = o[parts[i]] as Row;
  }
  const last = parts[parts.length - 1];
  if (value === undefined) delete o[last];
  else o[last] = value;
}

function extFromMime(mime: string): string {
  const m = (mime || "").toLowerCase().split(";")[0].trim();
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "video/webm": "webm",
  };
  return map[m] ?? "bin";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
}

interface TxContext {
  ops: StorageOp[];
  undo: Array<() => void>;
  filesToDelete: string[];
  filesWritten: string[];
}

// ───────────────────────── Collection ─────────────────────────

export class Collection<TR extends object> {
  private readonly table: NativeTable<TR, object>;
  private readonly source: () => StoredRow[];
  private readonly predicates: Array<(row: TR) => boolean>;
  private order: { field: string; desc: boolean } | null;
  private reversed: boolean;
  private lim: number | null;
  private off: number;

  constructor(
    table: NativeTable<TR, object>,
    source: () => StoredRow[],
    opts?: { predicates?: Array<(row: TR) => boolean>; order?: { field: string; desc: boolean } | null }
  ) {
    this.table = table;
    this.source = source;
    this.predicates = opts?.predicates ? [...opts.predicates] : [];
    this.order = opts?.order ?? null;
    this.reversed = false;
    this.lim = null;
    this.off = 0;
  }

  private derive(): Collection<TR> {
    const c = new Collection<TR>(this.table, this.source, { predicates: this.predicates, order: this.order });
    c.reversed = this.reversed;
    c.lim = this.lim;
    c.off = this.off;
    return c;
  }

  filter(fn: (row: TR) => boolean): Collection<TR> {
    const c = this.derive();
    c.predicates.push(fn);
    return c;
  }

  and(fn: (row: TR) => boolean): Collection<TR> {
    return this.filter(fn);
  }

  reverse(): Collection<TR> {
    const c = this.derive();
    c.reversed = !c.reversed;
    return c;
  }

  limit(n: number): Collection<TR> {
    const c = this.derive();
    c.lim = n;
    return c;
  }

  offset(n: number): Collection<TR> {
    const c = this.derive();
    c.off = n;
    return c;
  }

  private exec(): StoredRow[] {
    let rows = this.source();
    if (this.predicates.length) {
      rows = rows.filter((r) => {
        const view = this.table.view(r);
        return this.predicates.every((p) => p(view));
      });
    }
    if (this.order) {
      const { field, desc } = this.order;
      rows = [...rows].sort((a, b) => {
        const c = cmp(getPath(a, field), getPath(b, field)) || cmp(a.id, b.id);
        return desc ? -c : c;
      });
    }
    if (this.reversed) rows = [...rows].reverse();
    if (this.off) rows = rows.slice(this.off);
    if (this.lim !== null) rows = rows.slice(0, this.lim);
    return rows;
  }

  async toArray(): Promise<TR[]> {
    await this.table.ready();
    return this.exec().map((r) => this.table.expose(r));
  }

  async count(): Promise<number> {
    await this.table.ready();
    return this.exec().length;
  }

  async first(): Promise<TR | undefined> {
    await this.table.ready();
    const r = this.exec()[0];
    return r ? this.table.expose(r) : undefined;
  }

  async last(): Promise<TR | undefined> {
    await this.table.ready();
    const rows = this.exec();
    const r = rows[rows.length - 1];
    return r ? this.table.expose(r) : undefined;
  }

  async primaryKeys(): Promise<string[]> {
    await this.table.ready();
    return this.exec().map((r) => String(r.id));
  }

  async sortBy(field: string): Promise<TR[]> {
    await this.table.ready();
    const rows = this.exec();
    // مرتب‌سازی پایدار؛ در صورت reverse() قبلی، همان ترتیب معکوس برای مقادیر برابر حفظ می‌شود.
    const sorted = rows
      .map((r, i) => ({ r, i }))
      .sort((x, y) => cmp(getPath(x.r, field), getPath(y.r, field)) || x.i - y.i)
      .map((x) => x.r);
    return sorted.map((r) => this.table.expose(r));
  }

  async each(fn: (row: TR) => void): Promise<void> {
    for (const r of await this.toArray()) fn(r);
  }

  async modify(changes: Partial<TR> | ((row: TR, ctx: { value: TR }) => void)): Promise<number> {
    await this.table.ready();
    const targets = this.exec();
    const updated: Row[] = [];
    for (const stored of targets) {
      const draft = this.table.expose(stored) as unknown as Row;
      if (typeof changes === "function") {
        (changes as (row: TR, ctx: { value: TR }) => void)(draft as unknown as TR, { value: draft as unknown as TR });
      } else {
        for (const [k, v] of Object.entries(changes)) setPath(draft, k, v);
      }
      updated.push(draft);
    }
    if (updated.length) await this.table.writeMany(updated as unknown as object[], "put");
    return updated.length;
  }

  async delete(): Promise<number> {
    await this.table.ready();
    const keys = this.exec().map((r) => String(r.id));
    await this.table.bulkDelete(keys);
    return keys.length;
  }
}

// ───────────────────────── WhereClause ─────────────────────────

export class WhereClause<TR extends object> {
  private readonly table: NativeTable<TR, object>;
  private readonly fields: string[];

  constructor(table: NativeTable<TR, object>, indexExpr: string) {
    this.table = table;
    this.fields = indexExpr.startsWith("[") ? indexExpr.slice(1, -1).split("+") : [indexExpr];
  }

  private value(row: Row): unknown {
    return this.fields.length === 1
      ? getPath(row, this.fields[0])
      : this.fields.map((f) => getPath(row, f));
  }

  private make(pred: (v: unknown) => boolean): Collection<TR> {
    const field = this.fields.length === 1 ? this.fields[0] : null;
    return new Collection<TR>(this.table, () => this.table.filterStored((r) => pred(this.value(r))), {
      order: field ? { field, desc: false } : null,
    });
  }

  equals(v: unknown): Collection<TR> {
    return this.make((x) => cmp(x, v) === 0 && x !== undefined);
  }
  notEqual(v: unknown): Collection<TR> {
    return this.make((x) => cmp(x, v) !== 0);
  }
  anyOf(...vals: unknown[]): Collection<TR> {
    const list = vals.length === 1 && Array.isArray(vals[0]) && this.fields.length === 1 ? (vals[0] as unknown[]) : vals;
    return this.make((x) => list.some((v) => cmp(x, v) === 0));
  }
  noneOf(...vals: unknown[]): Collection<TR> {
    const list = vals.length === 1 && Array.isArray(vals[0]) ? (vals[0] as unknown[]) : vals;
    return this.make((x) => !list.some((v) => cmp(x, v) === 0));
  }
  above(v: unknown): Collection<TR> {
    return this.make((x) => x !== undefined && x !== null && cmp(x, v) > 0);
  }
  aboveOrEqual(v: unknown): Collection<TR> {
    return this.make((x) => x !== undefined && x !== null && cmp(x, v) >= 0);
  }
  below(v: unknown): Collection<TR> {
    return this.make((x) => x !== undefined && x !== null && cmp(x, v) < 0);
  }
  belowOrEqual(v: unknown): Collection<TR> {
    return this.make((x) => x !== undefined && x !== null && cmp(x, v) <= 0);
  }
  between(lower: unknown, upper: unknown, includeLower = true, includeUpper = false): Collection<TR> {
    return this.make((x) => {
      if (x === undefined || x === null) return false;
      const lo = cmp(x, lower);
      const hi = cmp(x, upper);
      return (includeLower ? lo >= 0 : lo > 0) && (includeUpper ? hi <= 0 : hi < 0);
    });
  }
  startsWith(prefix: string): Collection<TR> {
    return this.make((x) => typeof x === "string" && x.startsWith(prefix));
  }
  equalsIgnoreCase(s: string): Collection<TR> {
    return this.make((x) => typeof x === "string" && x.toLowerCase() === s.toLowerCase());
  }
}

// ───────────────────────── Table ─────────────────────────

export class NativeTable<TR extends object, TW extends object = TR> {
  readonly name: string;
  readonly schema: { name: string };
  private readonly db: NativeDatabase;
  private readonly def: TableDef;

  constructor(db: NativeDatabase, def: TableDef) {
    this.db = db;
    this.def = def;
    this.name = def.name;
    this.schema = { name: def.name };
  }

  async ready(): Promise<void> {
    await this.db.open();
    if (this.def.lazy) await this.db.ensureLoaded(this.name);
  }

  /** @internal رکوردهای ذخیره‌شده (مرجع واقعی؛ نباید تغییر داده شوند). */
  allStored(): StoredRow[] {
    return [...this.db.rowsOf(this.name).values()].sort((a, b) => cmp(a.id, b.id));
  }

  /**
   * @internal معادل `allStored().filter(pred)` با نتیجهٔ دقیقاً یکسان (همان ترتیب بر اساس id)،
   * ولی ابتدا فیلتر و سپس فقط ردیف‌های منطبق sort می‌شوند. قبلاً هر where() کل جدول را کپی و
   * sort می‌کرد (O(n log n) به‌ازای هر کوئری؛ در گزارش ماهانه هزاران بار).
   */
  filterStored(pred: (r: StoredRow) => boolean): StoredRow[] {
    const out: StoredRow[] = [];
    for (const r of this.db.rowsOf(this.name).values()) if (pred(r)) out.push(r);
    return out.sort((a, b) => cmp(a.id, b.id));
  }

  /** @internal نمای فقط‌خواندنی برای filter (بدون کپی). */
  view(stored: StoredRow): TR {
    if (!this.def.blobFields?.length) return stored as unknown as TR;
    // کپی سطحی (نه JSON clone عمیق): filter فقط می‌خواند؛ برای جدول عکس/صوت با هزاران ردیف،
    // هر پرس‌وجو قبلاً کل رکوردها را عمیق کپی می‌کرد.
    const { __files, ...rest } = stored;
    const out = { ...rest } as Row;
    for (const bf of this.def.blobFields) {
      const ref = __files?.[bf.field];
      if (ref) out[bf.urlField] = this.db.blobs.url(ref.path);
    }
    return out as unknown as TR;
  }

  /** @internal کپی مستقل از رکورد + تبدیل مرجع فایل به آدرس. */
  expose(stored: StoredRow): TR {
    const { __files, ...rest } = stored;
    const out = clone(rest) as Row;
    for (const bf of this.def.blobFields ?? []) {
      const ref = __files?.[bf.field];
      if (ref) out[bf.urlField] = this.db.blobs.url(ref.path);
    }
    return out as unknown as TR;
  }

  // ----- خواندن -----
  async get(key: string | Partial<TR>): Promise<TR | undefined> {
    await this.ready();
    if (typeof key === "object" && key !== null) {
      return this.where(key as Record<string, unknown>).first();
    }
    const r = this.db.rowsOf(this.name).get(String(key));
    return r ? this.expose(r) : undefined;
  }

  async toArray(): Promise<TR[]> {
    await this.ready();
    return this.allStored().map((r) => this.expose(r));
  }

  async count(): Promise<number> {
    await this.ready();
    return this.db.rowsOf(this.name).size;
  }

  async map<U>(fn: (row: TR) => U): Promise<U[]> {
    return (await this.toArray()).map(fn);
  }

  toCollection(): Collection<TR> {
    return new Collection<TR>(this as unknown as NativeTable<TR, object>, () => this.allStored());
  }

  filter(fn: (row: TR) => boolean): Collection<TR> {
    return this.toCollection().filter(fn);
  }

  orderBy(field: string): Collection<TR> {
    return new Collection<TR>(this as unknown as NativeTable<TR, object>, () => this.allStored(), {
      order: { field, desc: false },
    });
  }

  reverse(): Collection<TR> {
    return this.toCollection().reverse();
  }

  where(index: string): WhereClause<TR>;
  where(criteria: Record<string, unknown>): Collection<TR>;
  where(arg: string | Record<string, unknown>): WhereClause<TR> | Collection<TR> {
    // Dexie: where(string) → WhereClause ؛ where({a,b}) → Collection
    if (typeof arg === "string") return new WhereClause<TR>(this as unknown as NativeTable<TR, object>, arg);
    const entries = Object.entries(arg);
    return new Collection<TR>(this as unknown as NativeTable<TR, object>, () =>
      this.filterStored((r) => entries.every(([k, v]) => cmp(getPath(r, k), v) === 0 && getPath(r, k) !== undefined))
    );
  }

  // ----- نوشتن -----
  async add(item: TW | TR): Promise<string> {
    await this.writeMany([item as object], "add");
    return String((item as Row).id);
  }

  async put(item: TW | TR): Promise<string> {
    await this.writeMany([item as object], "put");
    return String((item as Row).id);
  }

  async bulkAdd(items: Array<TW | TR>): Promise<string> {
    await this.writeMany(items as object[], "add");
    return items.length ? String((items[items.length - 1] as Row).id) : "";
  }

  async bulkPut(items: Array<TW | TR>): Promise<string> {
    await this.writeMany(items as object[], "put");
    return items.length ? String((items[items.length - 1] as Row).id) : "";
  }

  async update(key: string, changes: Record<string, unknown>): Promise<number> {
    await this.ready();
    const stored = this.db.rowsOf(this.name).get(String(key));
    if (!stored) return 0;
    const draft = this.expose(stored) as unknown as Row;
    for (const [k, v] of Object.entries(changes)) setPath(draft, k, v);
    await this.writeMany([draft], "put");
    return 1;
  }

  async delete(key: string): Promise<void> {
    await this.bulkDelete([key]);
  }

  async bulkDelete(keys: string[]): Promise<void> {
    await this.ready();
    const rows = this.db.rowsOf(this.name);
    const ops: StorageOp[] = [];
    const undo: Array<() => void> = [];
    const files: string[] = [];
    for (const k of keys) {
      const key = String(k);
      const prev = rows.get(key);
      if (!prev) continue;
      rows.delete(key);
      undo.push(() => rows.set(key, prev));
      ops.push({ t: "del", table: this.name, key });
      for (const ref of Object.values(prev.__files ?? {})) files.push(ref.path);
    }
    if (ops.length) await this.db.commit(ops, undo, files, []);
  }

  async clear(): Promise<void> {
    await this.ready();
    const rows = this.db.rowsOf(this.name);
    const snapshot = new Map(rows);
    const files: string[] = [];
    for (const prev of snapshot.values()) for (const ref of Object.values(prev.__files ?? {})) files.push(ref.path);
    rows.clear();
    await this.db.commit([{ t: "clear", table: this.name }], [() => snapshot.forEach((v, k) => rows.set(k, v))], files, []);
  }

  /**
   * فقط یک فیلد Blob را روی رکورد «موجود» می‌نویسد، بدون دست‌زدن به بقیهٔ فیلدها.
   * برای فایل‌های مشتق‌شده (مثل پیش‌نمایش عکس) که پس از ساخت رکورد، در پس‌زمینه تولید می‌شوند:
   * رکورد بعد از نوشتن فایل «دوباره» از حافظه خوانده می‌شود، پس ویرایش هم‌زمان کاربر
   * (مثلاً تغییر توضیح عکس) هرگز با نسخهٔ کهنه بازنویسی نمی‌شود.
   * اگر رکورد در این فاصله حذف شده باشد، فایل تازه پاک می‌شود و false برمی‌گردد.
   */
  async attachBlob(key: string, field: string, blob: Blob): Promise<boolean> {
    await this.ready();
    const bf = (this.def.blobFields ?? []).find((f) => f.field === field);
    if (!bf) throw new Error(`فیلد Blob ناشناخته: ${this.name}.${field}`);
    const rows = this.db.rowsOf(this.name);
    const id = String(key);
    if (!rows.has(id)) return false;

    const path = `${this.name}/${id}__${field}__${randomSuffix()}.${extFromMime(blob.type)}`;
    await this.db.blobs.write(path, blob);

    const prev = rows.get(id);
    if (!prev) {
      await this.db.blobs.remove(path).catch(() => {});
      return false;
    }
    const oldRef = prev.__files?.[field];
    const next: StoredRow = { ...prev, __files: { ...(prev.__files ?? {}), [field]: { path, size: blob.size, type: blob.type } } };
    rows.set(id, next);
    try {
      await this.db.commit(
        [{ t: "put", table: this.name, key: id, json: JSON.stringify(next) }],
        [() => rows.set(id, prev)],
        oldRef ? [oldRef.path] : [],
        [path]
      );
    } catch (e) {
      await this.db.blobs.remove(path).catch(() => {});
      throw e;
    }
    return true;
  }

  /** @internal */
  async writeMany(items: object[], mode: "add" | "put"): Promise<void> {
    await this.ready();
    const rows = this.db.rowsOf(this.name);
    const blobFields = this.def.blobFields ?? [];

    // ۱) اعتبارسنجی قبل از هر تغییر (add روی کلید موجود → ConstraintError)
    const seen = new Set<string>();
    for (const item of items) {
      const id = (item as Row).id;
      if (id === undefined || id === null || id === "") throw new Error(`رکورد جدول ${this.name} بدون id است.`);
      const key = String(id);
      if (mode === "add" && (rows.has(key) || seen.has(key))) {
        throw new ConstraintError(`Key already exists in the object store: ${this.name}/${key}`);
      }
      seen.add(key);
    }

    // ۲) نوشتن Blobها روی دیسک (قبل از رکورد) و ساخت رکورد ذخیره‌شده
    const ops: StorageOp[] = [];
    const undo: Array<() => void> = [];
    const filesToDelete: string[] = [];
    const filesWritten: string[] = [];
    const staged: Array<{ key: string; next: StoredRow; prev: StoredRow | undefined }> = [];

    try {
      for (const item of items) {
        const src = item as Row;
        const key = String(src.id);
        const prev = rows.get(key);
        const next = clone(
          Object.fromEntries(
            Object.entries(src).filter(
              ([k, v]) => !isBlob(v) && !blobFields.some((bf) => bf.field === k || bf.urlField === k) && k !== "__files"
            )
          )
        ) as StoredRow;

        if (blobFields.length) {
          const files: Record<string, BlobFileRef> = { ...(prev?.__files ?? {}) };
          for (const bf of blobFields) {
            const v = src[bf.field];
            if (isBlob(v)) {
              const path = `${this.name}/${key}__${bf.field}__${randomSuffix()}.${extFromMime(v.type)}`;
              await this.db.blobs.write(path, v);
              filesWritten.push(path);
              if (files[bf.field]) filesToDelete.push(files[bf.field].path);
              files[bf.field] = { path, size: v.size, type: v.type };
            }
          }
          if (Object.keys(files).length) next.__files = files;
        }
        staged.push({ key, next, prev });
      }
    } catch (e) {
      await Promise.all(filesWritten.map((p) => this.db.blobs.remove(p).catch(() => {})));
      throw e;
    }

    // ۳) اعمال در حافظه + آماده‌سازی op
    for (const { key, next, prev } of staged) {
      rows.set(key, next);
      undo.push(() => (prev ? rows.set(key, prev) : rows.delete(key)));
      ops.push({ t: "put", table: this.name, key, json: JSON.stringify(next) });
    }
    try {
      await this.db.commit(ops, undo, filesToDelete, filesWritten);
    } catch (e) {
      await Promise.all(filesWritten.map((p) => this.db.blobs.remove(p).catch(() => {})));
      throw e;
    }
  }
}

// ───────────────────────── Database ─────────────────────────

export class NativeDatabase {
  readonly name: string;
  readonly blobs: BlobBackend;
  private readonly backend: RowBackend;
  private readonly defs: TableDef[];
  private data = new Map<string, Map<string, StoredRow>>();
  private openPromise: Promise<void> | null = null;
  private opened = false;
  /** جدول‌هایی که ردیف‌هایشان الان در RAM است (جدول‌های lazy تا اولین دسترسی اینجا نیستند). */
  private loadedTables = new Set<string>();
  private lazyLoads = new Map<string, Promise<void>>();
  private writeChain: Promise<unknown> = Promise.resolve();
  private txLock: Promise<unknown> = Promise.resolve();
  private activeTx: TxContext | null = null;
  /** قبل از اولین باز شدن اجرا می‌شود (مثلاً مهاجرت از IndexedDB قدیمی). */
  beforeFirstUse: ((db: NativeDatabase) => Promise<void>) | null = null;
  readonly tables: Array<NativeTable<object, object>> = [];

  constructor(name: string, defs: TableDef[], backend: RowBackend, blobs: BlobBackend) {
    this.name = name;
    this.defs = defs;
    this.backend = backend;
    this.blobs = blobs;
    for (const d of defs) {
      if (d.lazy && d.blobFields?.length) {
        throw new Error(`جدول lazy نمی‌تواند فیلد Blob داشته باشد: ${d.name}`);
      }
      this.data.set(d.name, new Map());
    }
  }

  /**
   * سازگاری با Dexie فقط برای تست‌ها: db.version(n).stores({ name: "id" }) جدول جدید ثبت می‌کند
   * (مثلاً تست «جدول فراموش‌شده در بکاپ»). باید قبل از اولین استفاده/open صدا زده شود.
   */
  version(_n: number): { stores: (schema: Record<string, string>) => void } {
    return {
      stores: (schema) => {
        for (const name of Object.keys(schema)) {
          if (this.defs.some((d) => d.name === name)) continue;
          this.defs.push({ name });
          this.data.set(name, new Map());
          (this as unknown as Record<string, unknown>)[name] = this.createTable(name);
        }
      },
    };
  }

  protected createTable<TR extends object, TW extends object = TR>(name: string): NativeTable<TR, TW> {
    const def = this.defs.find((d) => d.name === name);
    if (!def) throw new Error(`جدول ناشناخته: ${name}`);
    const t = new NativeTable<TR, TW>(this, def);
    this.tables.push(t as unknown as NativeTable<object, object>);
    return t;
  }

  /** @internal */
  rowsOf(table: string): Map<string, StoredRow> {
    const m = this.data.get(table);
    if (!m) throw new Error(`جدول ناشناخته: ${table}`);
    return m;
  }

  table(name: string): NativeTable<object, object> {
    const t = this.tables.find((x) => x.name === name);
    if (!t) throw new Error(`جدول ناشناخته: ${name}`);
    return t;
  }

  isOpen(): boolean {
    return this.opened;
  }

  open(): Promise<void> {
    if (!this.openPromise) {
      this.openPromise = (async () => {
        await this.backend.open(this.defs.map((d) => d.name));
        await this.blobs.open();
        if (this.beforeFirstUse) await this.beforeFirstUse(this);
        await this.loadFromBackend(false);
        this.opened = true;
      })().catch((e) => {
        this.openPromise = null; // اجازهٔ تلاش مجدد
        throw e;
      });
    }
    return this.openPromise;
  }

  /** @internal استفاده در مهاجرت: خواندن دوبارهٔ «همهٔ» جدول‌ها (حتی lazy) از backend. */
  async loadAllFromBackend(): Promise<void> {
    await this.loadFromBackend(true);
  }

  private async loadFromBackend(includeLazy: boolean): Promise<void> {
    for (const d of this.defs) {
      if (d.lazy && !includeLazy) continue;
      await this.loadTable(d.name);
    }
  }

  private async loadTable(name: string): Promise<void> {
    const map = new Map<string, StoredRow>();
    for (const { key, json } of await this.backend.loadAll(name)) {
      try {
        map.set(key, JSON.parse(json) as StoredRow);
      } catch {
        // رکورد خراب نباید کل برنامه را از کار بیندازد؛ نادیده گرفته می‌شود (در SQLite دست‌نخورده می‌ماند).
        // فقط نام جدول و کلید لاگ می‌شود، نه محتوای رکورد.
        console.warn(`[nativeStore] skipped unparsable row in "${name}" (key: ${key})`);
      }
    }
    this.data.set(name, map);
    this.loadedTables.add(name);
  }

  /** @internal بارگذاری تنبل یک جدول؛ همزمانی امن (همهٔ فراخوان‌ها یک Promise مشترک می‌گیرند). */
  ensureLoaded(name: string): Promise<void> {
    if (this.loadedTables.has(name)) return Promise.resolve();
    let p = this.lazyLoads.get(name);
    if (!p) {
      p = this.loadTable(name).finally(() => this.lazyLoads.delete(name));
      this.lazyLoads.set(name, p);
    }
    return p;
  }

  /** @internal ذخیره خام (برای مهاجرت): بدون کش حافظه. */
  async rawApply(ops: StorageOp[]): Promise<void> {
    await this.backend.open(this.defs.map((d) => d.name));
    await this.backend.apply(ops);
  }

  async close(): Promise<void> {
    await this.writeChain.catch(() => {});
    await this.backend.close();
    this.openPromise = null;
    this.opened = false;
    this.loadedTables.clear();
    this.lazyLoads.clear();
  }

  /** حذف کامل همهٔ داده‌ها (رکوردها + فایل‌ها). برای تست و ریست. */
  async delete(): Promise<void> {
    await this.writeChain.catch(() => {});
    await this.backend.open(this.defs.map((d) => d.name));
    await this.backend.destroy(this.defs.map((d) => d.name));
    await this.blobs.removeAll().catch(() => {});
    for (const d of this.defs) this.data.set(d.name, new Map());
    this.loadedTables.clear();
    this.lazyLoads.clear();
    this.openPromise = null;
    this.opened = false;
  }

  /** @internal */
  async commit(ops: StorageOp[], undo: Array<() => void>, filesToDelete: string[], filesWritten: string[]): Promise<void> {
    const tx = this.activeTx;
    if (tx) {
      tx.ops.push(...ops);
      tx.undo.push(...undo);
      tx.filesToDelete.push(...filesToDelete);
      tx.filesWritten.push(...filesWritten);
      return;
    }
    const run = this.writeChain.then(() => this.backend.apply(ops));
    this.writeChain = run.catch(() => {});
    try {
      await run;
    } catch (e) {
      for (const u of undo.reverse()) u();
      throw e;
    }
    await Promise.all(filesToDelete.map((p) => this.blobs.remove(p).catch(() => {})));
  }

  /**
   * transaction("rw", [t1, t2], fn) یا transaction("rw", t1, t2, fn)
   * تراکنش‌ها پشت سر هم اجرا می‌شوند (مثل Dexie روی جدول‌های هم‌پوشان).
   */
  async transaction<T>(_mode: "r" | "rw" | "readonly" | "readwrite", ...rest: unknown[]): Promise<T> {
    const fn = rest[rest.length - 1] as () => Promise<T>;
    await this.open();
    if (this.activeTx) return fn(); // تراکنش تودرتو: داخل همان تراکنش بیرونی

    const prev = this.txLock;
    let release!: () => void;
    this.txLock = new Promise<void>((r) => (release = r));
    await prev.catch(() => {});

    const ctx: TxContext = { ops: [], undo: [], filesToDelete: [], filesWritten: [] };
    this.activeTx = ctx;
    try {
      const result = await fn();
      this.activeTx = null;
      if (ctx.ops.length) {
        const run = this.writeChain.then(() => this.backend.apply(ctx.ops));
        this.writeChain = run.catch(() => {});
        await run;
      }
      await Promise.all(ctx.filesToDelete.map((p) => this.blobs.remove(p).catch(() => {})));
      return result;
    } catch (e) {
      this.activeTx = null;
      for (const u of ctx.undo.reverse()) u();
      await Promise.all(ctx.filesWritten.map((p) => this.blobs.remove(p).catch(() => {})));
      throw e;
    } finally {
      this.activeTx = null;
      release();
    }
  }

  /** مسیر همهٔ فایل‌هایی که حداقل یک رکورد به آن‌ها اشاره می‌کند (همهٔ جدول‌ها). */
  referencedBlobPaths(): Set<string> {
    const out = new Set<string>();
    for (const rows of this.data.values()) {
      for (const row of rows.values()) {
        for (const ref of Object.values(row.__files ?? {})) out.add(ref.path);
      }
    }
    return out;
  }

  /** Blob واقعی یک فیلد (برای اشتراک‌گذاری، تبدیل HEIC، بکاپ). null اگر فایلی نباشد. */
  async readBlob(table: string, id: string, field: string): Promise<Blob | null> {
    await this.open();
    const ref = this.rowsOf(table).get(String(id))?.__files?.[field];
    if (!ref) return null;
    return this.blobs.read(ref.path);
  }

  /** مرجع فایل یک فیلد Blob (مسیر/اندازه/نوع). */
  async getBlobRef(table: string, id: string, field: string): Promise<BlobFileRef | null> {
    await this.open();
    return this.rowsOf(table).get(String(id))?.__files?.[field] ?? null;
  }
}
