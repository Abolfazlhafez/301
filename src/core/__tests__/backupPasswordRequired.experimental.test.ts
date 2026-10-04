/**
 * خطای نوع‌دار BackupPasswordRequiredError (به‌جای تطبیق متن فارسی در SettingsPage):
 *  - فایل رمزدار (نسخهٔ ۲ استریمی و نسخهٔ ۱ قدیمی) بدون رمز → دقیقاً BackupPasswordRequiredError؛
 *  - متن پیام برای کاربر بدون تغییر مانده است (همان جملهٔ قبلی)؛
 *  - رمز اشتباه، فایل خراب/ناقص و JSON نامعتبر → هرگز BackupPasswordRequiredError نیستند
 *    (وگرنه UI به‌جای نمایش خطای رمز اشتباه دوباره «رمز را وارد کنید» می‌گفت)؛
 *  - رد شدن بازیابی، دیتابیس فعلی را دست‌نخورده می‌گذارد؛
 *  - ایستا: SettingsPage از instanceof استفاده می‌کند و دیگر به متن فارسی وابسته نیست.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";

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
import { projectService } from "../services/projectService";
import { backupService } from "../services/backupService";
import { createChunkCipher, encryptWithPassword } from "../services/backupCrypto";
import {
  BACKUP_PASSWORD_REQUIRED_MESSAGE,
  BackupCorruptError,
  BackupKeyError,
  BackupPasswordRequiredError,
  StreamBackupReader,
  StreamBackupWriter,
  textSource,
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

async function caught(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e ?? new Error("thrown-falsy");
  }
}

// متن قدیمیِ سرویس؛ عمداً هاردکد تا هر تغییر ناخواسته در پیام کاربر گرفته شود.
const OLD_MESSAGE = "این فایل پشتیبان با رمز عبور محافظت شده است. لطفاً رمز عبور را وارد کنید.";
const PASSWORD = "رمز-تست-۱۴۰۵";

async function main() {
  console.log("\n— کلاس خطا");
  const e = new BackupPasswordRequiredError();
  check(e instanceof Error && e instanceof BackupPasswordRequiredError, "BackupPasswordRequiredError یک Error واقعی است");
  check(e.name === "BackupPasswordRequiredError", "نام خطا درست است");
  check(e.message === OLD_MESSAGE && BACKUP_PASSWORD_REQUIRED_MESSAGE === OLD_MESSAGE, "پیام پیش‌فرض دقیقاً همان جملهٔ قبلی سرویس است");
  check(!(new BackupKeyError("x") instanceof BackupPasswordRequiredError) && !(new BackupCorruptError("x") instanceof BackupPasswordRequiredError), "خطاهای کلید/خرابی زیرکلاس آن نیستند");

  console.log("\n— سطح سرویس (importAll)");
  await ensureDatabaseSeeded();
  const projectId = await projectService.getOrCreateActiveProjectId();
  await db.workLogNotes.add({ id: "keep-me", projectId, date: "2026-10-03", description: "باید بعد از رد شدن بازیابی بماند", updatedAt: new Date().toISOString() });
  const before = await db.workLogNotes.count();

  const v2 = await backupService.exportAll(PASSWORD);
  const v2File = new File([v2], "v2.json", { type: "application/json" });

  const noPw = await caught(() => backupService.importAll(v2File));
  check(noPw instanceof BackupPasswordRequiredError, "نسخهٔ ۲ رمزدار بدون رمز → BackupPasswordRequiredError", String(noPw));
  check(noPw instanceof Error && noPw.message === OLD_MESSAGE, "پیام کاربر برای نسخهٔ ۲ بدون تغییر است");
  const emptyPw = await caught(() => backupService.importAll(v2File, ""));
  check(emptyPw instanceof BackupPasswordRequiredError, "رمز خالی ('') هم مثل نبود رمز است");

  const wrongPw = await caught(() => backupService.importAll(v2File, "اشتباه"));
  check(wrongPw !== null && !(wrongPw instanceof BackupPasswordRequiredError), "رمز اشتباه → خطا هست ولی BackupPasswordRequiredError نیست", String(wrongPw));

  const v2Lines = (await v2.text()).split("\n").filter(Boolean);
  const truncated = new File([v2Lines.slice(0, 2).join("\n") + "\n"], "t.json");
  const trErr = await caught(() => backupService.importAll(truncated, PASSWORD));
  check(trErr !== null && !(trErr instanceof BackupPasswordRequiredError), "فایل بریده‌شده (با رمز درست) → BackupPasswordRequiredError نیست");

  const notJson = await caught(() => backupService.importAll(new File(["این اصلاً JSON نیست"], "x.json")));
  check(notJson !== null && !(notJson instanceof BackupPasswordRequiredError), "فایل نامعتبر → BackupPasswordRequiredError نیست");

  const legacyPayload = await encryptWithPassword(JSON.stringify({ app: "karegah-yar", version: 1, exportedAt: "2026-01-01T00:00:00.000Z", dataVersion: 1, data: {} }), PASSWORD);
  const legacyFile = new File([JSON.stringify({ encrypted: true, formatVersion: 1, payload: legacyPayload })], "legacy.json");
  const legacyNoPw = await caught(() => backupService.importAll(legacyFile));
  check(legacyNoPw instanceof BackupPasswordRequiredError && (legacyNoPw as Error).message === OLD_MESSAGE, "نسخهٔ ۱ قدیمی رمزدار بدون رمز → BackupPasswordRequiredError با همان پیام");

  check((await db.workLogNotes.count()) === before && !!(await db.workLogNotes.get("keep-me")), "بعد از همهٔ ردشدن‌ها دیتابیس فعلی دست‌نخورده است");

  console.log("\n— سطح فرمت (StreamBackupReader)");
  const lines: string[] = [];
  const cipher = await createChunkCipher({ keySource: "password" }, PASSWORD);
  const w = await StreamBackupWriter.create({ cipher, exportedAt: "2026-10-03T00:00:00.000Z", dataVersion: 1, emit: async (l) => void lines.push(l) });
  await w.writeRows("workers", [JSON.stringify({ id: "r0" })]);
  await w.finish();
  const direct = await caught(() => StreamBackupReader.open(textSource(lines.join("")), { password: null, getDeviceKey: async () => "unused" }));
  check(direct instanceof BackupPasswordRequiredError, "StreamBackupReader.open بدون رمز برای فایل رمزدار → BackupPasswordRequiredError");
  const directWrong = await caught(async () => {
    const r = await StreamBackupReader.open(textSource(lines.join("")), { password: "غلط", getDeviceKey: async () => "unused" });
    for await (const _ of r.chunks()) void _;
  });
  check(directWrong instanceof BackupKeyError && !(directWrong instanceof BackupPasswordRequiredError), "رمز غلط در سطح reader → BackupKeyError (نه PasswordRequired)");

  console.log("\n— پوشش ایستا");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
  const settings = strip(readFileSync(new URL("../../pages/settings/SettingsPage.tsx", import.meta.url), "utf8"));
  check(/err instanceof BackupPasswordRequiredError/.test(settings), "SettingsPage با instanceof خطای نوع‌دار را تشخیص می‌دهد");
  check(!/رمز عبور محافظت شده/.test(settings) && !/message\.includes\(/.test(settings), "SettingsPage دیگر به متن فارسی پیام وابسته نیست");
  const stream = strip(readFileSync(new URL("../services/backupStream.ts", import.meta.url), "utf8"));
  const service = strip(readFileSync(new URL("../services/backupService.ts", import.meta.url), "utf8"));
  check((stream.match(/throw new BackupPasswordRequiredError\(\)/g) ?? []).length === 1 && (service.match(/throw new BackupPasswordRequiredError\(\)/g) ?? []).length === 1, "هر دو محل پرتاب (backupStream و backupService) خطای نوع‌دار می‌اندازند");
  check(!/throw new Error\(\s*"این فایل پشتیبان با رمز عبور/.test(stream + service), "هیچ throw new Error با متن «رمز عبور محافظت شده» باقی نمانده");

  console.log("\n" + "=".repeat(70));
  console.log(`نتیجه نهایی: ${passed} موفق، ${failed} ناموفق از مجموع ${passed + failed} بررسی`);
  console.log("=".repeat(70));
  if (failed > 0) throw new Error(`${failed} بررسی ناموفق بود.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("خطای اجرای تست:", err);
    process.exit(1);
  });
