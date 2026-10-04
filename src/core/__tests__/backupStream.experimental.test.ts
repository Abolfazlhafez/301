/**
 * تست فرمت بکاپ تکه‌تکه (نسخهٔ ۲):
 *  الف) سطح فرمت (بدون دیتابیس): رفت‌وبرگشت، رمز اشتباه، دستکاری/حذف/جابه‌جایی/تکرار تکه‌ها، بریده‌شدن فایل،
 *       انتقال تکه بین دو فایل، خواندن خط‌به‌خط از Blob با مرزهای چندبایتی UTF-8، تشخیص فرمت قدیمی؛
 *  ب) سطح سرویس (با دیتابیس): بکاپ واقعی با عکس/صوت، «هر رکورد یک خط» (نه یک JSON غول‌پیکر)،
 *       Restore بایت‌به‌بایت، و مهم‌تر از همه: فایل خراب/رمز اشتباه → دیتابیس فعلی دست‌نخورده می‌ماند؛
 *       فایل قدیمی نسخهٔ ۱ (رمزنگاری‌شده با رمز عبور) همچنان Restore می‌شود.
 */
import "fake-indexeddb/auto";

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

import { db, ensureDatabaseSeeded } from "../db";
import { photoService } from "../services/photoService";
import { projectService } from "../services/projectService";
import { backupService } from "../services/backupService";
import { createChunkCipher, encryptWithPassword, WRONG_PASSWORD_MESSAGE } from "../services/backupCrypto";
import {
  BackupCorruptError,
  BackupKeyError,
  StreamBackupReader,
  StreamBackupWriter,
  blobSource,
  fetchSource,
  textSource,
  isStreamBackup,
  type StreamRecord,
} from "../services/backupStream";

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

async function rejectsWith(fn: () => Promise<unknown>, ctor: new (...a: never[]) => Error): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof ctor;
  }
}

async function rejects(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

const DEVICE_KEY = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 1)));

async function buildFile(opts: { password?: string; rowCount?: number; photos?: number }): Promise<string[]> {
  const cipher = opts.password
    ? await createChunkCipher({ keySource: "password" }, opts.password)
    : await createChunkCipher({ keySource: "device" }, DEVICE_KEY);
  const lines: string[] = [];
  const w = await StreamBackupWriter.create({
    cipher,
    exportedAt: "2026-10-03T00:00:00.000Z",
    dataVersion: 1,
    emit: async (l) => {
      lines.push(l);
    },
  });
  const rows = Array.from({ length: opts.rowCount ?? 3 }, (_, i) => JSON.stringify({ id: `r${i}`, title: `عنوان محرمانه ${i}`, amount: 9_876_543 + i }));
  // دو دسته برای اینکه چند تکهٔ rows داشته باشیم
  await w.writeRows("workers", rows.slice(0, 2));
  await w.writeRows("workers", rows.slice(2));
  for (let i = 0; i < (opts.photos ?? 1); i += 1) {
    await w.writePhoto({ meta: { id: `p${i}`, mimeType: "image/png" }, blobBase64: "QUJD".repeat(50 + i) });
  }
  await w.writeVoice({ meta: { id: "v0", mimeType: "audio/webm" }, blobBase64: "REVG" });
  await w.finish();
  return lines;
}

async function readAll(lines: string[], secrets: { password: string | null }): Promise<{ recs: StreamRecord[]; reader: StreamBackupReader }> {
  const reader = await StreamBackupReader.open(textSource(lines.join("")), {
    password: secrets.password,
    getDeviceKey: async () => DEVICE_KEY,
  });
  const recs: StreamRecord[] = [];
  for await (const r of reader.chunks()) recs.push(r);
  return { recs, reader };
}

async function formatLevelTests() {
  console.log("=".repeat(70));
  console.log("الف) سطح فرمت");
  console.log("=".repeat(70));

  // ۱) رفت‌وبرگشت (کلید دستگاهی)
  const devLines = await buildFile({ rowCount: 3, photos: 2 });
  const dev = await readAll(devLines, { password: null });
  check(dev.recs[0].t === "meta", "کلید دستگاهی: اولین تکه meta است");
  check(dev.recs.filter((r) => r.t === "rows").length === 2, "کلید دستگاهی: دو دستهٔ rows برگشت");
  check(dev.recs.filter((r) => r.t === "photo").length === 2 && dev.recs.filter((r) => r.t === "voice").length === 1, "کلید دستگاهی: عکس‌ها و صوت برگشت");
  check(dev.reader.end?.counts.workers === 3 && dev.reader.end?.counts.photos === 2 && dev.reader.end?.counts.voiceNotes === 1, "تکهٔ end شمارش‌های درست دارد");
  const rowsBack = dev.recs.filter((r): r is Extract<StreamRecord, { t: "rows" }> => r.t === "rows").flatMap((r) => r.rows as { title: string }[]);
  check(rowsBack[2]?.title === "عنوان محرمانه 2", "محتوای فارسی ردیف‌ها دقیق برمی‌گردد");

  // ۲) رفت‌وبرگشت (رمز عبور) + هیچ متن آشکاری در فایل نیست
  const pwLines = await buildFile({ password: "رمز-من-۱۲۳", rowCount: 3 });
  const pw = await readAll(pwLines, { password: "رمز-من-۱۲۳" });
  check(pw.recs.length === 5 && pw.reader.end !== null, "رمز عبور: رفت‌وبرگشت کامل");
  const pwText = pwLines.join("");
  check(!pwText.includes("محرمانه") && !pwText.includes("9876543"), "هیچ داده‌ای از کاربر در فایل آشکار نیست");
  check(JSON.parse(pwLines[0]).keySource === "password" && JSON.parse(pwLines[0]).iterations === 210000, "هدر: نوع کلید و iterations");

  // ۳) رمز اشتباه / بدون رمز
  check(await rejectsWith(() => readAll(pwLines, { password: "اشتباه" }), BackupKeyError), "رمز اشتباه → BackupKeyError");
  let msg = "";
  try {
    await readAll(pwLines, { password: "اشتباه" });
  } catch (e) {
    msg = (e as Error).message;
  }
  check(msg === WRONG_PASSWORD_MESSAGE, "پیام رمز اشتباه همان پیام قبلی برنامه است");
  check(await rejects(() => readAll(pwLines, { password: null })), "بدون رمز برای فایل رمزدار → خطا");

  // ۴) فایل بریده‌شده (بدون تکهٔ end)
  check(await rejectsWith(() => readAll(devLines.slice(0, -1), { password: null }), BackupCorruptError), "فایل بدون تکهٔ end (بریده‌شده) → BackupCorruptError");
  // بریده‌شدن وسط یک خط
  const cutMid = devLines.slice(0, -1).concat([devLines[devLines.length - 1].slice(0, 30)]);
  check(await rejectsWith(() => readAll(cutMid, { password: null }), BackupCorruptError), "بریده‌شدن وسط یک خط → BackupCorruptError");

  // ۵) حذف تکه از وسط / جابه‌جایی / تکرار
  const dropMid = [...devLines.slice(0, 2), ...devLines.slice(3)];
  check(await rejectsWith(() => readAll(dropMid, { password: null }), BackupCorruptError), "حذف یک تکه از وسط → BackupCorruptError");
  const swapped = [...devLines];
  [swapped[2], swapped[3]] = [swapped[3], swapped[2]];
  check(await rejectsWith(() => readAll(swapped, { password: null }), BackupCorruptError), "جابه‌جایی دو تکه → BackupCorruptError");
  const dup = [...devLines.slice(0, 3), devLines[2], ...devLines.slice(3)];
  check(await rejectsWith(() => readAll(dup, { password: null }), BackupCorruptError), "تکرار یک تکه → BackupCorruptError");

  // ۶) دستکاری بایت‌های یک تکهٔ بعدی → خراب (نه «رمز اشتباه»)
  const tampered = [...devLines];
  const env = JSON.parse(tampered[3]) as { i: number; iv: string; ct: string };
  env.ct = (env.ct[0] === "A" ? "B" : "A") + env.ct.slice(1);
  tampered[3] = JSON.stringify(env) + "\n";
  check(await rejectsWith(() => readAll(tampered, { password: null }), BackupCorruptError), "دستکاری یک تکه → BackupCorruptError (نه خطای کلید)");

  // ۷) انتقال تکه از فایل دیگر (AAD شامل fileId)
  const other = await buildFile({ rowCount: 3, photos: 2 });
  const spliced = [...devLines];
  spliced[2] = other[2];
  check(await rejectsWith(() => readAll(spliced, { password: null }), BackupCorruptError), "تکهٔ منتقل‌شده از فایل دیگر → BackupCorruptError");

  // ۸) خط اضافه بعد از end
  check(await rejectsWith(() => readAll([...devLines, devLines[1]], { password: null }), BackupCorruptError), "خط اضافه بعد از end → BackupCorruptError");
  check((await readAll([...devLines, "\n"], { password: null })).reader.end !== null, "خط خالی بعد از end بی‌ضرر است");

  // ۹) هدر خراب / هدر قدیمی
  check(await rejectsWith(() => readAll(["{not json}\n", ...devLines.slice(1)], { password: null }), BackupCorruptError), "هدر خراب → BackupCorruptError");

  // ۱۰) خواندن خط‌به‌خط از Blob با گام ۷ بایت (مرز UTF-8 وسط حروف فارسی) = همان خطوط
  const persianLines = ["سلام دنیا ✓", "خط دوم با متن فارسی طولانی‌تر برای عبور از مرز بایت‌ها", "x"];
  const persianText = persianLines.join("\n") + "\n";
  const got: string[] = [];
  for await (const l of blobSource(new Blob([persianText]), 7).lines()) got.push(l);
  check(JSON.stringify(got) === JSON.stringify(persianLines), "blobSource با گام کوچک خطوط فارسی را دقیق برمی‌گرداند");

  // fetchSource: برش تکه‌ها وسط کاراکترهای چندبایتی UTF-8 نباید متن را خراب کند
  const encoded = new TextEncoder().encode(persianText);
  const makeFetch = (stepBytes: number) => async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          for (let o = 0; o < encoded.length; o += stepBytes) c.enqueue(encoded.slice(o, o + stepBytes));
          c.close();
        },
      }),
      { status: 200 },
    );
  for (const step of [1, 3, 7]) {
    const g: string[] = [];
    for await (const l of fetchSource("x://f", makeFetch(step)).lines()) g.push(l);
    check(JSON.stringify(g) === JSON.stringify(persianLines), `fetchSource با تکه‌های ${step} بایتی خطوط فارسی را دقیق برمی‌گرداند`);
  }
  const headGot = await fetchSource("x://f", makeFetch(5)).head(12);
  check(headGot === new TextDecoder().decode(encoded).slice(0, 12), "fetchSource.head فقط ابتدای فایل را می‌خواند");
  check(
    await rejectsWith(async () => {
      for await (const _ of fetchSource("x://f", async () => new Response(null, { status: 404 })).lines()) void _;
    }, Error),
    "fetchSource روی پاسخ ۴۰۴ خطا می‌دهد",
  );
  const gotNoTrailing: string[] = [];
  for await (const l of blobSource(new Blob(["a\nb"]), 2).lines()) gotNoTrailing.push(l);
  check(JSON.stringify(gotNoTrailing) === JSON.stringify(["a", "b"]), "خط آخر بدون \\n هم خوانده می‌شود");

  // ۱۱) خواندن کامل فایل از Blob (مسیر واقعی importAll)
  const blob = new Blob(devLines, { type: "application/json" });
  const rb = await StreamBackupReader.open(blobSource(blob, 64), { password: null, getDeviceKey: async () => DEVICE_KEY });
  let n = 0;
  for await (const _ of rb.chunks()) n += 1;
  check(n === 6 && rb.end?.chunks === 6, "خواندن از Blob با گام ۶۴ بایت: همهٔ تکه‌ها و end درست");

  // ۱۲) تشخیص فرمت
  check((await isStreamBackup(textSource(devLines.join("")))) === true, "تشخیص: فایل نسخهٔ ۲");
  check((await isStreamBackup(textSource(JSON.stringify({ encrypted: true, formatVersion: 1, payload: {} })))) === false, "تشخیص: فایل رمزنگاری‌شدهٔ نسخهٔ ۱ → قدیمی");
  check((await isStreamBackup(textSource(JSON.stringify({ app: "karegah-yar", version: 1, tables: {} })))) === false, "تشخیص: JSON ساده قدیمی → قدیمی");
  check((await isStreamBackup(textSource(""))) === false, "تشخیص: فایل خالی → قدیمی (با خطای معمول قدیمی رد می‌شود)");
}

// ───────────────────────── سطح سرویس ─────────────────────────

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function makePngFile(name: string, paddingBytes: number, seed: number): File {
  const bin = atob(MINIMAL_PNG_BASE64);
  const png = new Uint8Array(bin.length + paddingBytes);
  for (let i = 0; i < bin.length; i += 1) png[i] = bin.charCodeAt(i);
  // بایت‌های پس از IEND (تصویر معتبر می‌ماند ولی هر عکس محتوای یکتا دارد)
  for (let i = bin.length; i < png.length; i += 1) png[i] = (i * 31 + seed * 17) & 0xff;
  return new File([png], name, { type: "image/png" });
}

async function blobHash(b: Blob): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", await b.arrayBuffer());
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

async function serviceLevelTests() {
  console.log();
  console.log("=".repeat(70));
  console.log("ب) سطح سرویس (دیتابیس واقعی)");
  console.log("=".repeat(70));
  await ensureDatabaseSeeded();
  const projectId = await projectService.getOrCreateActiveProjectId();
  const day = "2026-10-03";

  await db.workLogNotes.add({ id: day, projectId, date: day, description: "یادداشت روز برای تست بکاپ تکه‌ای", updatedAt: new Date().toISOString() });

  const PHOTO_COUNT = 12;
  const PADDING = 150_000;
  const photoHashes = new Map<string, string>();
  for (let i = 0; i < PHOTO_COUNT; i += 1) {
    const p = await photoService.upload({ file: makePngFile(`عکس-${i}.png`, PADDING, i), relatedType: "site", relatedId: null, date: day, caption: `عکس ${i}` });
    photoHashes.set(p.id, await blobHash((await db.readBlob("photos", p.id, "blob"))!));
  }
  const voiceId = crypto.randomUUID();
  const voiceBytes = new Uint8Array(40_000).map((_, i) => (i * 7) & 0xff);
  await db.voiceNotes.add({
    id: voiceId,
    projectId,
    relatedType: "site",
    relatedId: day,
    floorId: null,
    date: day,
    durationSeconds: 12,
    mimeType: "audio/webm",
    fileSize: voiceBytes.length,
    createdAt: new Date().toISOString(),
    blob: new Blob([voiceBytes], { type: "audio/webm" }),
  } as never);
  const voiceHash = await blobHash(new Blob([voiceBytes]));
  check((await db.photos.count()) === PHOTO_COUNT, `آماده‌سازی: ${PHOTO_COUNT} عکس ۱۵۰ کیلوبایتی + یک صوت + یک یادداشت`);

  // بکاپ واقعی
  const backup = await backupService.exportAll();
  const text = await backup.text();
  const lines = text.split("\n").filter((l) => l.length > 0);
  const maxLine = Math.max(...lines.map((l) => l.length));
  const photoBase64Len = Math.ceil((PADDING + 100) / 3) * 4;
  check(lines.length >= PHOTO_COUNT + 4, `هر رکورد یک خط جدا (${lines.length} خط)`);
  check(maxLine < photoBase64Len * 1.6, `طولانی‌ترین خط در حد یک عکس است، نه کل بکاپ (${maxLine} کاراکتر از ${text.length})`);
  check(maxLine * 4 < text.length, "هیچ خطی بخش بزرگی از کل فایل نیست");
  check(!text.includes("یادداشت روز برای تست"), "متن یادداشت در فایل آشکار نیست");

  // Restore بایت‌به‌بایت
  await db.photos.clear();
  await db.voiceNotes.clear();
  await db.workLogNotes.clear();
  await backupService.importAll(new File([backup], "b.json", { type: "application/json" }));
  check((await db.photos.count()) === PHOTO_COUNT, "Restore: تعداد عکس‌ها درست");
  let allSame = true;
  for (const [id, hash] of photoHashes) {
    const b = await db.readBlob("photos", id, "blob");
    if (!b || (await blobHash(b)) !== hash) allSame = false;
  }
  check(allSame, "Restore: همهٔ عکس‌ها بایت‌به‌بایت یکسان‌اند");
  const vb = await db.readBlob("voiceNotes", voiceId, "blob");
  check(!!vb && (await blobHash(vb)) === voiceHash, "Restore: یادداشت صوتی بایت‌به‌بایت یکسان است");
  check((await db.workLogNotes.get(day))?.description === "یادداشت روز برای تست بکاپ تکه‌ای", "Restore: ردیف‌های متنی درست");

  // با رمز عبور
  const pwBackup = await backupService.exportAll("رمز-قوی-۱۴۰۵");
  const pwFile = new File([pwBackup], "pw.json", { type: "application/json" });
  const countBefore = await db.photos.count();
  check(await rejects(() => backupService.importAll(pwFile)), "بدون رمز → خطا");
  check(await rejects(() => backupService.importAll(pwFile, "غلط")), "رمز غلط → خطا");
  check((await db.photos.count()) === countBefore && !!(await db.workLogNotes.get(day)), "رمز غلط/نبود رمز: دیتابیس دست‌نخورده");
  await backupService.importAll(pwFile, "رمز-قوی-۱۴۰۵");
  check((await db.photos.count()) === PHOTO_COUNT, "رمز درست: Restore کامل");

  // مهم‌ترین تست ایمنی: فایل بریده‌شده/خراب نباید هیچ دادهٔ فعلی را پاک کند
  const truncated = lines.slice(0, lines.length - 1).join("\n") + "\n"; // بدون end
  check(await rejects(() => backupService.importAll(new File([truncated], "t.json"))), "فایل بریده‌شده → Restore رد می‌شود");
  check((await db.photos.count()) === PHOTO_COUNT && !!(await db.workLogNotes.get(day)), "فایل بریده‌شده: دیتابیس فعلی کاملاً دست‌نخورده");

  const corrupt = [...lines];
  const mid = Math.floor(corrupt.length / 2);
  const e = JSON.parse(corrupt[mid]) as { i: number; iv: string; ct: string };
  const originalCt = e.ct;
  e.ct = (e.ct[0] === "A" ? "B" : "A").concat(e.ct.slice(1)); // حرف اول را عوض می‌کنیم، پس شرط هم باید روی همان حرف باشد
  check(e.ct !== originalCt, "پیش‌شرط تست: تکهٔ دستکاری‌شده واقعاً با اصلی فرق دارد");
  corrupt[mid] = JSON.stringify(e);
  check(await rejects(() => backupService.importAll(new File([corrupt.join("\n") + "\n"], "c.json"))), "تکهٔ دستکاری‌شده در وسط فایل → Restore رد می‌شود");
  let intact = (await db.photos.count()) === PHOTO_COUNT;
  for (const [id, hash] of photoHashes) {
    const b = await db.readBlob("photos", id, "blob");
    if (!b || (await blobHash(b)) !== hash) intact = false;
  }
  check(intact, "تکهٔ دستکاری‌شده: همهٔ عکس‌های فعلی هنوز سالم‌اند (هیچ پاک‌سازی انجام نشد)");

  // سازگاری عقب‌رو: فایل نسخهٔ ۱ رمزنگاری‌شده با رمز عبور (همان فرمت قدیمی، دقیقاً مثل برنامهٔ نسخه‌های قبل)
  const legacyPayload = {
    app: "karegah-yar",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      workLogNotes: [{ id: "legacy-day", projectId, date: "2026-01-01", description: "از فایل نسخهٔ ۱", updatedAt: "2026-01-01T00:00:00.000Z" }],
      photos: [],
      voiceNotes: [],
    },
  };
  const legacyEncrypted = await encryptWithPassword(JSON.stringify(legacyPayload), "رمز-قدیمی");
  const legacyFile = new File([JSON.stringify({ encrypted: true, formatVersion: 1, payload: legacyEncrypted })], "legacy-v1.json");
  check(await rejects(() => backupService.importAll(legacyFile)), "فایل نسخهٔ ۱ رمزدار بدون رمز → خطا");
  await backupService.importAll(legacyFile, "رمز-قدیمی");
  check(!!(await db.workLogNotes.get("legacy-day")) && (await db.photos.count()) === 0, "فایل نسخهٔ ۱ رمزنگاری‌شده همچنان Restore می‌شود (مسیر قدیمی)");

  // بازگشت از بکاپ جدید روی دیتابیسِ حاصل از فایل قدیمی
  await backupService.importAll(new File([backup], "b2.json"));
  check((await db.photos.count()) === PHOTO_COUNT && !(await db.workLogNotes.get("legacy-day")), "بعد از فایل قدیمی، Restore فایل جدید هم کامل کار می‌کند");
}

async function main() {
  await formatLevelTests();
  await serviceLevelTests();
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
