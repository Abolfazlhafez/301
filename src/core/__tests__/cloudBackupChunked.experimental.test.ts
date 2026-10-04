/**
 * تست بکاپ ابری تکه‌ای (۱.۵.۰) با یک «Supabase ساختگی در حافظه».
 *
 * ⚠️ این تست فقط منطق کلاینت را می‌سنجد (تکه‌بندی، فعال‌سازی اتمیک، بازیابی، سازگاری با ردیف قدیمی).
 * رفتار واقعی PostgREST/RLS/محدودیت اندازهٔ درخواست روی Supabase واقعی در اینجا تأیید نمی‌شود.
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

import type { SupabaseClient } from "@supabase/supabase-js";
import { db, ensureDatabaseSeeded } from "../db";
import { projectService } from "../services/projectService";
import { settingsService } from "../services/settingsService";
import { backupService } from "../services/backupService";
import { cloudBackupService, cloudBackupTestHooks } from "../services/cloudBackupService";

let passed = 0;
let failed = 0;
function check(condition: boolean, name: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name}`);
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
function section(title: string): void {
  console.log();
  console.log("=".repeat(70));
  console.log(title);
  console.log("=".repeat(70));
}

// ───────────────────────── Supabase ساختگی ─────────────────────────
const LEGACY = "karegah_yar_device_backups";
const CHUNKS = "karegah_yar_backup_chunks";
const HEADS = "karegah_yar_backup_heads";
const PK: Record<string, string[]> = {
  [LEGACY]: ["device_id"],
  [HEADS]: ["device_id"],
  [CHUNKS]: ["device_id", "upload_id", "chunk_index"],
};

type Row = Record<string, unknown>;
interface FailSpec {
  table: string;
  nth: number;
  mode: "error" | "throw";
}

class FakeServer {
  tables: Record<string, Row[]> = {};
  missing = new Set<string>();
  upsertCount: Record<string, number> = {};
  failAt: FailSpec | null = null;

  resetCounters(): void {
    this.upsertCount = {};
    this.failAt = null;
  }

  client(): SupabaseClient {
    return { from: (table: string) => this.builder(table) } as unknown as SupabaseClient;
  }

  private builder(table: string) {
    let op: "select" | "upsert" | "delete" = "select";
    let row: Row | null = null;
    const filters: Array<[string, unknown, boolean]> = [];
    let single = false;
    let lim: number | undefined;

    const run = async () => {
      if (this.missing.has(table)) {
        return { data: null, error: { code: "42P01", message: `relation "${table}" does not exist` } };
      }
      const rows = (this.tables[table] ??= []);
      const match = (r: Row) => filters.every(([c, v, neg]) => (r[c] === v) !== neg);

      if (op === "upsert") {
        this.upsertCount[table] = (this.upsertCount[table] ?? 0) + 1;
        const f = this.failAt;
        if (f && f.table === table && f.nth === this.upsertCount[table]) {
          if (f.mode === "throw") throw new Error("network down");
          return { data: null, error: { message: "network error" } };
        }
        const pk = PK[table];
        const idx = rows.findIndex((r) => pk.every((k) => r[k] === row![k]));
        const copy = { ...row! };
        if (idx >= 0) rows[idx] = copy;
        else rows.push(copy);
        return { data: null, error: null };
      }
      if (op === "delete") {
        this.tables[table] = rows.filter((r) => !match(r));
        return { data: null, error: null };
      }
      let out = rows.filter(match).map((r) => ({ ...r }));
      if (lim !== undefined) out = out.slice(0, lim);
      return single ? { data: out[0] ?? null, error: null } : { data: out, error: null };
    };

    const b: Record<string, unknown> = {
      select: () => b,
      upsert: (r: Row) => {
        op = "upsert";
        row = r;
        return b;
      },
      delete: () => {
        op = "delete";
        return b;
      },
      eq: (c: string, v: unknown) => {
        filters.push([c, v, false]);
        return b;
      },
      neq: (c: string, v: unknown) => {
        filters.push([c, v, true]);
        return b;
      },
      limit: (n: number) => {
        lim = n;
        return b;
      },
      maybeSingle: () => {
        single = true;
        return b;
      },
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => run().then(res, rej),
    };
    return b;
  }

  rows(table: string): Row[] {
    return this.tables[table] ?? [];
  }
}

// ───────────────────────── کمک‌ها ─────────────────────────
const DAY = "2026-10-03";
const NOTE_COUNT = 24;
const VOICE_BYTES = new Uint8Array(20_000).map((_, i) => (i * 13) & 0xff);

async function armSettings(): Promise<string> {
  const s = await settingsService.get();
  await db.settings.update("app-settings", {
    cloudBackupEnabled: true,
    cloudBackupSupabaseUrl: "https://fake-project.supabase.co",
    cloudBackupSupabaseAnonKey: "fake-key",
    cloudBackupIntervalHours: 1,
    lastCloudBackupAt: undefined,
  });
  return s.cloudBackupDeviceId;
}

async function noteDescriptions(): Promise<string[]> {
  return (await db.workLogNotes.toArray()).map((n) => n.description).sort();
}

async function voiceBytesEqual(id: string): Promise<boolean> {
  const b = await db.readBlob("voiceNotes", id, "blob");
  if (!b) return false;
  const got = new Uint8Array(await b.arrayBuffer());
  return got.length === VOICE_BYTES.length && got.every((v, i) => v === VOICE_BYTES[i]);
}

async function wipeUserData(): Promise<void> {
  await db.workLogNotes.clear();
  await db.voiceNotes.clear();
}

async function main() {
  await ensureDatabaseSeeded();
  const projectId = await projectService.getOrCreateActiveProjectId();
  const server = new FakeServer();
  cloudBackupTestHooks.setClientFactory(() => server.client());
  cloudBackupTestHooks.setChunkChars(3000);

  for (let i = 0; i < NOTE_COUNT; i += 1) {
    await db.workLogNotes.add({
      id: `2026-09-${String(i + 1).padStart(2, "0")}`,
      projectId,
      date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      description: `یادداشت شمارهٔ ${i} — ${"متن نمونه ".repeat(40)}`,
      updatedAt: new Date().toISOString(),
    });
  }
  const voiceId = crypto.randomUUID();
  await db.voiceNotes.add({
    id: voiceId,
    projectId,
    relatedType: "site",
    relatedId: DAY,
    floorId: null,
    date: DAY,
    durationSeconds: 9,
    mimeType: "audio/webm",
    fileSize: VOICE_BYTES.length,
    createdAt: new Date().toISOString(),
    blob: new Blob([VOICE_BYTES], { type: "audio/webm" }),
  } as never);
  const originalNotes = await noteDescriptions();

  // ── ۱) آپلود تکه‌ای ──
  section("۱) آپلود تکه‌ای: چند تکه + یک ردیف heads، بدون نوشتن ردیف قدیمی");
  const deviceId = await armSettings();
  await cloudBackupService.runCloudBackupIfDue();
  const heads1 = server.rows(HEADS);
  check(heads1.length === 1 && heads1[0].device_id === deviceId, "یک ردیف heads برای این دستگاه ساخته شد");
  const head1 = heads1[0] as { upload_id: string; chunk_count: number; total_chars: number };
  const chunks1 = server.rows(CHUNKS);
  check(chunks1.length === head1.chunk_count && head1.chunk_count >= 3, `چند تکه آپلود شد (${head1.chunk_count} تکه)`);
  check(chunks1.every((c) => c.upload_id === head1.upload_id), "همهٔ تکه‌ها زیر upload_id فعال‌اند");
  const sortedIdx = chunks1.map((c) => c.chunk_index as number).sort((a, b) => a - b);
  check(sortedIdx.every((v, i) => v === i), "شمارهٔ تکه‌ها پیوسته و از صفر است");
  check(
    chunks1.every((c) => typeof c.payload === "string" && (c.payload as string).endsWith("\n")),
    "هر تکه فقط خطوط کامل دارد (با \\n پایانی)"
  );
  check(
    chunks1.reduce((sum, c) => sum + (c.payload as string).length, 0) === head1.total_chars,
    "مجموع اندازهٔ تکه‌ها با total_chars می‌خواند"
  );
  check(server.rows(LEGACY).length === 0, "ردیف قدیمی payload تکی نوشته نشد");
  check(!!(await settingsService.get()).lastCloudBackupAt, "lastCloudBackupAt بعد از فعال‌سازی ثبت شد");
  check(!server.rows(CHUNKS).some((c) => (c.payload as string).includes("یادداشت شمارهٔ")), "متن یادداشت‌ها در تکه‌ها آشکار نیست");

  // ── ۲) بازیابی رفت‌وبرگشت ──
  section("۲) بازیابی از بکاپ تکه‌ای");
  await wipeUserData();
  check((await db.workLogNotes.count()) === 0, "آماده‌سازی: دادهٔ محلی پاک شد");
  await cloudBackupService.restoreFromCloud("https://fake-project.supabase.co", "fake-key", deviceId);
  check(JSON.stringify(await noteDescriptions()) === JSON.stringify(originalNotes), "همهٔ یادداشت‌ها دقیقاً برگشتند");
  check(await voiceBytesEqual(voiceId), "یادداشت صوتی بایت‌به‌بایت برگشت");

  // ── ۳) قطع وسط آپلود ──
  section("۳) قطع شبکه وسط آپلود: بکاپ سالم قبلی نسخهٔ فعال می‌ماند");
  await armSettings();
  await db.workLogNotes.add({ id: "2026-10-01", projectId, date: "2026-10-01", description: "نسخهٔ جدید (v2)", updatedAt: new Date().toISOString() });
  const lastBefore = (await settingsService.get()).lastCloudBackupAt;
  server.resetCounters();
  server.failAt = { table: CHUNKS, nth: 3, mode: "error" };
  await cloudBackupService.runCloudBackupIfDue();
  const headAfterFail = server.rows(HEADS)[0] as { upload_id: string };
  check(headAfterFail.upload_id === head1.upload_id, "heads هنوز به نسخهٔ سالم قبلی اشاره می‌کند");
  check(server.rows(CHUNKS).every((c) => c.upload_id === head1.upload_id), "تکه‌های آپلود ناقص پاک شدند و تکه‌های نسخهٔ سالم مانده‌اند");
  check(server.rows(CHUNKS).length === head1.chunk_count, "تعداد تکه‌های نسخهٔ سالم دست‌نخورده است");
  check((await settingsService.get()).lastCloudBackupAt === lastBefore, "lastCloudBackupAt بعد از آپلود ناقص ثبت نشد");
  check(!!(await settingsService.get()).lastCloudBackupErrorMessage, "شکست آپلود برای نمایش در تنظیمات ثبت شد");

  await wipeUserData();
  await cloudBackupService.restoreFromCloud("https://fake-project.supabase.co", "fake-key", deviceId);
  check(JSON.stringify(await noteDescriptions()) === JSON.stringify(originalNotes), "بازیابی بعد از آپلود ناقص، بکاپ سالم قبلی را برمی‌گرداند (نه v2)");

  // ── ۴) شکست در فعال‌سازی (heads) و استثنا ──
  section("۴) شکست در مرحلهٔ فعال‌سازی heads / استثنای شبکه");
  await armSettings();
  await db.workLogNotes.add({ id: "2026-10-01", projectId, date: "2026-10-01", description: "نسخهٔ جدید (v2)", updatedAt: new Date().toISOString() });
  server.resetCounters();
  server.failAt = { table: HEADS, nth: 1, mode: "error" };
  await cloudBackupService.runCloudBackupIfDue();
  check((server.rows(HEADS)[0] as { upload_id: string }).upload_id === head1.upload_id, "شکست heads: نسخهٔ فعال عوض نشد");
  check(server.rows(CHUNKS).every((c) => c.upload_id === head1.upload_id), "شکست heads: تکه‌های نیمه‌فعال پاک شدند");

  server.resetCounters();
  server.failAt = { table: CHUNKS, nth: 2, mode: "throw" };
  let threw = false;
  try {
    await cloudBackupService.runCloudBackupIfDue();
  } catch {
    threw = true;
  }
  check(!threw, "استثنای شبکه وسط آپلود از runCloudBackupIfDue بیرون نمی‌زند");
  check((server.rows(HEADS)[0] as { upload_id: string }).upload_id === head1.upload_id, "استثنای شبکه: نسخهٔ فعال عوض نشد");

  // ── ۵) آپلود موفق دوم ──
  section("۵) آپلود موفق دوم: نسخهٔ فعال عوض و تکه‌های قدیمی پاک می‌شود");
  server.resetCounters();
  await armSettings();
  await cloudBackupService.runCloudBackupIfDue();
  const head2 = server.rows(HEADS)[0] as { upload_id: string; chunk_count: number };
  check(head2.upload_id !== head1.upload_id, "heads به upload_id جدید اشاره می‌کند");
  check(server.rows(CHUNKS).every((c) => c.upload_id === head2.upload_id), "تکه‌های نسخهٔ قبلی پاک شدند");
  check(server.rows(CHUNKS).length === head2.chunk_count, "فقط تکه‌های نسخهٔ جدید مانده‌اند");

  // ── ۶) یکپارچگی هنگام بازیابی ──
  section("۶) بکاپ ابری ناقص/خراب هنگام بازیابی رد می‌شود و دیتابیس دست‌نخورده می‌ماند");
  const url = "https://fake-project.supabase.co";
  const notesNow = await noteDescriptions();
  const savedChunks = server.rows(CHUNKS).map((c) => ({ ...c }));

  server.tables[CHUNKS] = savedChunks.filter((c) => c.chunk_index !== 3).map((c) => ({ ...c }));
  check(await rejects(() => cloudBackupService.restoreFromCloud(url, "k", deviceId)), "تکهٔ گم‌شده → بازیابی رد می‌شود");
  check(JSON.stringify(await noteDescriptions()) === JSON.stringify(notesNow), "تکهٔ گم‌شده: دیتابیس دست‌نخورده");

  server.tables[CHUNKS] = savedChunks.map((c) => (c.chunk_index === 2 ? { ...c, payload: (c.payload as string).replace(/[A-Za-z]/, "#") } : { ...c }));
  check(await rejects(() => cloudBackupService.restoreFromCloud(url, "k", deviceId)), "تکهٔ دستکاری‌شده (چک‌سام غلط) → رد می‌شود");
  check(JSON.stringify(await noteDescriptions()) === JSON.stringify(notesNow), "تکهٔ دستکاری‌شده: دیتابیس دست‌نخورده");

  server.tables[CHUNKS] = savedChunks.map((c) => ({ ...c }));
  const goodHead = { ...(server.rows(HEADS)[0] as Record<string, unknown>) };
  (server.rows(HEADS)[0] as Record<string, unknown>).total_chars = (goodHead.total_chars as number) + 1;
  check(await rejects(() => cloudBackupService.restoreFromCloud(url, "k", deviceId)), "total_chars نامتناسب → رد می‌شود");
  (server.rows(HEADS)[0] as Record<string, unknown>).total_chars = goodHead.total_chars;
  (server.rows(HEADS)[0] as Record<string, unknown>).manifest_checksum = "0".repeat(64);
  check(await rejects(() => cloudBackupService.restoreFromCloud(url, "k", deviceId)), "manifest_checksum غلط → رد می‌شود");
  check(JSON.stringify(await noteDescriptions()) === JSON.stringify(notesNow), "heads نامعتبر: دیتابیس دست‌نخورده");
  server.tables[HEADS] = [goodHead];
  await wipeUserData();
  await cloudBackupService.restoreFromCloud(url, "k", deviceId);
  check((await noteDescriptions()).length === notesNow.length && (await voiceBytesEqual(voiceId)), "بعد از ترمیم، بازیابی سالم دوباره کار می‌کند");

  // ── ۷) سازگاری با ردیف قدیمی ──
  section("۷) سازگاری با ردیف قدیمی payload تکی");
  const legacyText = await (await backupService.exportAll()).text();
  server.tables[HEADS] = [];
  server.tables[CHUNKS] = [];
  server.tables[LEGACY] = [{ device_id: deviceId, payload: legacyText, updated_at: new Date().toISOString() }];
  await wipeUserData();
  await cloudBackupService.restoreFromCloud(url, "k", deviceId);
  check((await noteDescriptions()).length === notesNow.length && (await voiceBytesEqual(voiceId)), "بدون heads: از ردیف قدیمی بازیابی می‌شود");

  server.missing = new Set([HEADS, CHUNKS]);
  await wipeUserData();
  await cloudBackupService.restoreFromCloud(url, "k", deviceId);
  check((await noteDescriptions()).length === notesNow.length, "جدول‌های جدید اصلاً وجود ندارند: از ردیف قدیمی بازیابی می‌شود");

  server.missing = new Set();
  server.tables[LEGACY] = [];
  check(await rejects(() => cloudBackupService.restoreFromCloud(url, "k", deviceId)), "هیچ بکاپی نیست → خطای روشن");

  // کاربر جدید: فقط جدول‌های تکه‌ای ساخته شده‌اند، جدول قدیمی اصلاً نیست و heads خالی است.
  server.missing = new Set([LEGACY]);
  let noBackupMsg = "";
  try {
    await cloudBackupService.restoreFromCloud(url, "k", deviceId);
  } catch (err) {
    noBackupMsg = err instanceof Error ? err.message : "";
  }
  check(noBackupMsg.includes("هیچ بکاپ"), "کاربر جدید بدون جدول قدیمی: پیام «هیچ بکاپی نیست» (نه خطای خام Postgres)");
  server.missing = new Set();

  // ── ۸) آپلود وقتی SQL جدید اجرا نشده ──
  section("۸) آپلود وقتی جدول‌های جدید ساخته نشده‌اند: برگشت به ردیف قدیمی");
  server.missing = new Set([HEADS, CHUNKS]);
  server.tables = {};
  server.resetCounters();
  await armSettings();
  await cloudBackupService.runCloudBackupIfDue();
  check(server.rows(LEGACY).length === 1 && (server.rows(LEGACY)[0].payload as string).length > 0, "بکاپ در ردیف قدیمی ذخیره شد");
  check(!!(await settingsService.get()).lastCloudBackupAt, "lastCloudBackupAt ثبت شد");
  server.missing = new Set();

  // ── ۹) هم‌زمانی ──
  section("۹) دو اجرای هم‌زمان فقط یک آپلود انجام می‌دهند");
  server.tables = {};
  server.resetCounters();
  await armSettings();
  await Promise.all([cloudBackupService.runCloudBackupIfDue(), cloudBackupService.runCloudBackupIfDue()]);
  check((server.upsertCount[HEADS] ?? 0) === 1, "فقط یک بار heads فعال شد");

  // ── ۱۰) تست اتصال ──
  section("۱۰) testConnection");
  server.tables = {};
  server.missing = new Set();
  const okRes = await cloudBackupService.testConnection(url, "k");
  check(okRes.ok && okRes.message.includes("تکه‌ای"), "همهٔ جدول‌ها: ok و پیام بکاپ تکه‌ای");
  server.missing = new Set([HEADS, CHUNKS]);
  const legacyOnly = await cloudBackupService.testConnection(url, "k");
  check(legacyOnly.ok && legacyOnly.message.includes("قدیمی"), "فقط جدول قدیمی: ok با هشدار «قدیمی»");
  server.missing = new Set([HEADS, CHUNKS, LEGACY]);
  const none = await cloudBackupService.testConnection(url, "k");
  check(!none.ok && none.message.includes("SQL"), "هیچ جدولی نیست: ok=false با راهنمای SQL");

  cloudBackupTestHooks.setClientFactory(null);
  cloudBackupTestHooks.setChunkChars(null);

  console.log();
  console.log("=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));
  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
}

main().catch((err) => {
  console.error("خطای اجرای تست:", err);
  process.exit(1);
});
