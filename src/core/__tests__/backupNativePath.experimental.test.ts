/**
 * تست مسیر «بومی» بکاپ (اندروید) با یک Filesystem ساختگی در حافظه:
 *  - createAutoBackup: نوشتن تدریجی در «.part» ← تغییر نام به فایل نهایی ← کپی در پوشهٔ خارجی؛
 *  - شکست وسط کار (فایل عکس گم‌شده): هیچ فایل نیمه‌کاره/ناقصی در فهرست نمی‌ماند و بکاپ سالم قبلی دست‌نخورده است؛
 *  - پاک‌سازی فایل «.part» مانده از اجرای قطع‌شده؛ اجرای هم‌زمان = فقط یک بکاپ؛
 *  - restoreFromAutoBackup از روی همان فایل؛ exportAndShare با فایل Cache و Share.
 *
 * ⚠️ این تست منطق برنامه را روی یک Filesystem شبیه‌سازی‌شده می‌سنجد؛ رفتار واقعی bridge اندروید
 * (appendFile/rename/copy روی حافظهٔ واقعی) فقط روی گوشی قابل تأیید است.
 */
import "fake-indexeddb/auto";

type Platform = { native: boolean };
const platform: Platform = { native: false };

const files = new Map<string, string>();
const shareCalls: Array<{ title?: string; files?: string[] }> = [];
const calls = { write: 0, append: 0, rename: 0, copy: 0, readFile: 0, backupReadFile: 0, fetchOpen: 0, fetchChunks: 0 };
const writePaths: string[] = [];

const key = (directory: string, path: string) => `${directory}:${path}`;

const fakeFilesystem = {
  async mkdir(): Promise<void> {},
  async writeFile(o: { path: string; directory: string; data: string }) {
    calls.write += 1;
    writePaths.push(o.path);
    files.set(key(o.directory, o.path), o.data);
    return { uri: `file:///fake/${o.directory}/${o.path}` };
  },
  async appendFile(o: { path: string; directory: string; data: string }) {
    calls.append += 1;
    const k = key(o.directory, o.path);
    if (!files.has(k)) throw new Error("appendFile: file does not exist");
    files.set(k, files.get(k)! + o.data);
  },
  async getUri(o: { path: string; directory: string }) {
    return { uri: `file:///fake/${o.directory}/${o.path}` };
  },
  async readFile(o: { path: string; directory: string }) {
    calls.readFile += 1;
    if (o.path.includes("auto") && o.path.endsWith(".json")) calls.backupReadFile += 1;
    const v = files.get(key(o.directory, o.path));
    if (v === undefined) throw new Error("File does not exist");
    return { data: v };
  },
  async readdir(o: { path: string; directory: string }) {
    const prefix = key(o.directory, o.path) + "/";
    const out: Array<{ name: string; size: number; type: string; mtime: number; uri: string }> = [];
    for (const [k, v] of files) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      if (rest.includes("/")) continue;
      out.push({ name: rest, size: v.length, type: "file", mtime: 0, uri: `file:///fake/${k}` });
    }
    return { files: out };
  },
  async deleteFile(o: { path: string; directory: string }) {
    if (!files.delete(key(o.directory, o.path))) throw new Error("File does not exist");
  },
  async rename(o: { from: string; to: string; directory: string; toDirectory?: string }) {
    calls.rename += 1;
    const from = key(o.directory, o.from);
    const v = files.get(from);
    if (v === undefined) throw new Error("rename: source does not exist");
    files.delete(from);
    files.set(key(o.toDirectory ?? o.directory, o.to), v);
  },
  async copy(o: { from: string; directory: string; to: string; toDirectory?: string }) {
    calls.copy += 1;
    const v = files.get(key(o.directory, o.from));
    if (v === undefined) throw new Error("copy: source does not exist");
    files.set(key(o.toDirectory ?? o.directory, o.to), v);
    return { uri: `file:///fake/${o.toDirectory ?? o.directory}/${o.to}` };
  },
};


// fetch ساختگی برای آدرس فایل‌های fake: بایت‌ها را در تکه‌های ۶۴ کیلوبایتی (مثل استریم WebView) برمی‌گرداند.
let fetchEnabled = true;
(globalThis as { fetch?: unknown }).fetch = async (input: string) => {
  if (!fetchEnabled) throw new Error("fetch unavailable");
  const m = String(input).match(/fake\/(.+)$/);
  const k = m ? decodeURIComponent(m[1]).replace("/", ":") : "";
  const v = files.get(k);
  if (v === undefined) return new Response(null, { status: 404 });
  calls.fetchOpen += 1;
  const bytes = new TextEncoder().encode(v);
  let off = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (off >= bytes.length) return controller.close();
      calls.fetchChunks += 1;
      controller.enqueue(bytes.slice(off, off + 65536));
      off += 65536;
    },
  });
  return new Response(body, { status: 200 });
};

const prefsStore = new Map<string, string>();

const fakePlugins: Record<string, unknown> = {
  Filesystem: fakeFilesystem,
  // @capacitor/preferences (فلگ مهاجرت دیتابیس و تنظیمات) — نسخهٔ حافظه‌ای
  Preferences: {
    async get(o: { key: string }) {
      return { value: prefsStore.get(o.key) ?? null };
    },
    async set(o: { key: string; value: string }) {
      prefsStore.set(o.key, o.value);
    },
    async remove(o: { key: string }) {
      prefsStore.delete(o.key);
    },
    async keys() {
      return { keys: [...prefsStore.keys()] };
    },
    async clear() {
      prefsStore.clear();
    },
  },
  Share: {
    async share(o: { title?: string; files?: string[] }) {
      shareCalls.push(o);
      return { activityType: "fake" };
    },
  },
};

// باید پیش از اولین import از @capacitor/core ثبت شود (به همین دلیل importهای زیر dynamic‌اند)
(globalThis as Record<string, unknown>).CapacitorPlatforms = {
  currentPlatform: {
    name: "android",
    getPlatform: () => (platform.native ? "android" : "web"),
    isNativePlatform: () => platform.native,
    registerPlugin: (name: string) => fakePlugins[name] ?? new Proxy({}, { get: () => async () => undefined }),
    isPluginAvailable: () => true,
  },
  platforms: new Map(),
};

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
function check(ok: boolean, name: string, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
function makePngFile(name: string, padding: number, seed: number): File {
  const bin = atob(MINIMAL_PNG_BASE64);
  const png = new Uint8Array(bin.length + padding);
  for (let i = 0; i < bin.length; i += 1) png[i] = bin.charCodeAt(i);
  for (let i = bin.length; i < png.length; i += 1) png[i] = (i * 29 + seed * 13) & 0xff;
  return new File([png], name, { type: "image/png" });
}
async function blobHash(b: Blob): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", await b.arrayBuffer());
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const { db, ensureDatabaseSeeded } = await import("../db");
  const { photoService } = await import("../services/photoService");
  const { projectService } = await import("../services/projectService");
  const { backupService } = await import("../services/backupService");

  // دیتابیس در حالت غیر بومی (IndexedDB شبیه‌سازی‌شده) باز می‌شود؛ بعد پلتفرم «اندروید» می‌شود
  platform.native = false;
  await ensureDatabaseSeeded();
  const projectId = await projectService.getOrCreateActiveProjectId();
  const day = "2026-10-03";
  await db.workLogNotes.add({ id: day, projectId, date: day, description: "یادداشت مسیر بومی", updatedAt: new Date().toISOString() });
  const hashes = new Map<string, string>();
  for (let i = 0; i < 6; i += 1) {
    const p = await photoService.upload({ file: makePngFile(`n-${i}.png`, 120_000, i), relatedType: "site", relatedId: null, date: day, caption: `n${i}` });
    hashes.set(p.id, await blobHash((await db.readBlob("photos", p.id, "blob"))!));
  }
  platform.native = true;

  console.log("=".repeat(70));
  console.log("۱) بکاپ خودکار موفق");
  console.log("=".repeat(70));
  await backupService.createAutoBackup();
  const list1 = await backupService.listAutoBackups();
  check(list1.length === 1, "یک بکاپ خودکار در فهرست است");
  const finalKey = key("DATA", `auto-backups/${list1[0].fileName}`);
  const content = files.get(finalKey) ?? "";
  check(content.length > 600_000, `فایل نهایی کامل نوشته شده (${content.length} کاراکتر)`);
  check(![...files.keys()].some((k) => k.endsWith(".part")), "هیچ فایل «.part» باقی نمانده");
  const partWrites = writePaths.filter((w) => w.endsWith(".part")).length;
  check(partWrites === 1 && calls.append >= 1, `نوشتن تدریجی: ${partWrites} writeFile روی .part + ${calls.append} appendFile`);
  check(calls.rename === 1, "فایل نیمه‌کاره با rename به نام نهایی رفت");
  check(files.has(key("EXTERNAL", `KaregahYar/backups/${list1[0].fileName}`)) && calls.copy === 1, "کپی خارجی با copy بومی انجام شد");
  check(files.get(key("EXTERNAL", `KaregahYar/backups/${list1[0].fileName}`)) === content, "کپی خارجی دقیقاً همان فایل است");
  check(content.startsWith('{"encrypted":true,"formatVersion":2,') && !content.includes("یادداشت مسیر بومی"), "فایل نسخهٔ ۲ و رمزنگاری‌شده است");

  console.log();
  console.log("=".repeat(70));
  console.log("۲) Restore از بکاپ خودکار");
  console.log("=".repeat(70));
  platform.native = false;
  await db.photos.clear();
  await db.workLogNotes.clear();
  platform.native = true;
  const readFileBefore = calls.backupReadFile;
  await backupService.restoreFromAutoBackup(list1[0].fileName);
  check(calls.backupReadFile === readFileBefore && calls.fetchOpen >= 3, `Restore استریمی بود (readFile صدا نخورد؛ ${calls.fetchOpen} بار باز شدن استریم، ${calls.fetchChunks} تکه)`);
  check((await db.photos.count()) === 6 && !!(await db.workLogNotes.get(day)), "ردیف‌ها و عکس‌ها بازگشتند");
  let same = true;
  for (const [id, h] of hashes) {
    const b = await db.readBlob("photos", id, "blob");
    if (!b || (await blobHash(b)) !== h) same = false;
  }
  check(same, "همهٔ عکس‌ها بایت‌به‌بایت یکسان‌اند");

  // اگر fetch روی WebView کار نکند، باید به readFile یک‌جا برگردد و باز هم درست Restore شود.
  fetchEnabled = false;
  await db.photos.clear();
  const readFileBefore2 = calls.backupReadFile;
  await backupService.restoreFromAutoBackup(list1[0].fileName);
  check(calls.backupReadFile === readFileBefore2 + 1 && (await db.photos.count()) === 6, "با خرابی fetch به readFile برمی‌گردد و Restore کامل می‌شود");
  fetchEnabled = true;

  console.log();
  console.log("=".repeat(70));
  console.log("۳) شکست وسط بکاپ (فایل عکس گم‌شده)");
  console.log("=".repeat(70));
  const victimId = [...hashes.keys()][3];
  const victimRef = await db.getBlobRef("photos", victimId, "blob");
  await db.blobs.remove(victimRef!.path);
  const filesBefore = new Set(files.keys());
  let threw = false;
  try {
    await backupService.createAutoBackup();
  } catch {
    threw = true;
  }
  check(threw, "بکاپ ناقص خطا می‌دهد (نه موفقیت دروغین)");
  check(![...files.keys()].some((k) => k.endsWith(".part")), "فایل «.part» نیمه‌کاره پاک شد");
  const list2 = await backupService.listAutoBackups();
  check(list2.length === 1 && list2[0].fileName === list1[0].fileName, "فقط بکاپ سالم قبلی در فهرست است");
  check(files.get(finalKey) === content, "بکاپ سالم قبلی دست‌نخورده است");
  check([...files.keys()].every((k) => filesBefore.has(k)), "هیچ فایل تازه‌ای (حتی در پوشهٔ خارجی) ساخته نشد");

  console.log();
  console.log("=".repeat(70));
  console.log("۴) فایل .part مانده از اجرای قطع‌شده + اجرای هم‌زمان");
  console.log("=".repeat(70));
  // اول عکس گم‌شده را از دیتابیس حذف می‌کنیم تا بکاپ بتواند موفق شود
  platform.native = false;
  await db.photos.delete(victimId);
  platform.native = true;
  files.set(key("DATA", "auto-backups/auto-backup-2020-01-01T00-00-00.000Z.json.part"), "نیمه‌کاره");
  const [a, b] = await Promise.allSettled([backupService.createAutoBackup(), backupService.createAutoBackup()]);
  check(a.status === "fulfilled" && b.status === "fulfilled", "دو فراخوانی هم‌زمان هر دو بدون خطا تمام شدند");
  const list3 = await backupService.listAutoBackups();
  check(list3.length === 2, `هم‌زمانی فقط یک بکاپ تازه ساخت (مجموع ${list3.length})`);
  check(![...files.keys()].some((k) => k.endsWith(".part")), "فایل «.part» مانده از قبل پاک شد");

  console.log();
  console.log("=".repeat(70));
  console.log("۵) بکاپ دستی با اشتراک‌گذاری (exportAndShare) روی گوشی");
  console.log("=".repeat(70));
  await backupService.exportAndShare("رمز-اشتراک-۱");
  check(shareCalls.length === 1 && (shareCalls[0].files?.[0] ?? "").includes("/CACHE/karegah-yar-backup-"), "Share با فایل داخل Cache صدا زده شد");
  const cacheKey = [...files.keys()].find((k) => k.startsWith("CACHE:"));
  const shared = cacheKey ? files.get(cacheKey)! : "";
  check(shared.startsWith('{"encrypted":true,"formatVersion":2,') && shared.includes('"keySource":"password"'), "فایل اشتراکی نسخهٔ ۲ و با رمز عبور است");
  platform.native = false;
  await db.photos.clear();
  await db.workLogNotes.clear();
  await backupService.importAll(new File([shared], "shared.json"), "رمز-اشتراک-۱");
  check((await db.photos.count()) === 5 && !!(await db.workLogNotes.get(day)), "فایل اشتراکی دوباره Restore می‌شود");

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));
  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
}

main().catch((err) => {
  console.error("خطای اجرای تست:", err);
  throw err;
});
