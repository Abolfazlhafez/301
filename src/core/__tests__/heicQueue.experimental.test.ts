/**
 * تست صف تبدیل HEIC: تبدیل‌ها باید یکی‌یکی و به‌ترتیب اجرا شوند، شکست یک تبدیل صف را نبندد،
 * و تایمر ۲۵ثانیه‌ای بعد از هر تبدیل پاک شود. (heic2any با loader تستی جایگزین می‌شود.)
 */
import { __setHeicLoaderForTests, convertHeicToJpeg } from "../../shared/utils/imageFormat";

let failed = 0;
function check(cond: boolean, name: string, extra?: unknown) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failed++;
    console.log(`  ❌ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let running = 0;
  let maxRunning = 0;
  const order: string[] = [];
  const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });

  __setHeicLoaderForTests(async () => async ({ blob }) => {
    const tag = (blob as Blob & { tag?: string }).tag ?? "?";
    running++;
    maxRunning = Math.max(maxRunning, running);
    order.push(`start:${tag}`);
    await sleep(15);
    order.push(`end:${tag}`);
    running--;
    if (tag === "bad") throw new Error("decode failed");
    if (tag === "empty") return new Blob([]);
    if (tag === "burst") return [jpeg(), jpeg()];
    return jpeg();
  });

  const mk = (tag: string) => Object.assign(new Blob(["x"]), { tag });

  // clearTimeout شمارش می‌شود تا پاک‌شدن تایمر تأیید شود
  const origSet = globalThis.setTimeout;
  const origClear = globalThis.clearTimeout;
  const live = new Set<unknown>();
  globalThis.setTimeout = ((fn: (...a: unknown[]) => void, ms?: number, ...rest: unknown[]) => {
    const h = origSet(fn, ms, ...rest);
    if (ms === 25_000) live.add(h);
    return h;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((h: unknown) => {
    live.delete(h);
    return origClear(h as never);
  }) as typeof clearTimeout;

  const results = await Promise.all([
    convertHeicToJpeg(mk("a")),
    convertHeicToJpeg(mk("bad")),
    convertHeicToJpeg(mk("b")),
    convertHeicToJpeg(mk("empty")),
    convertHeicToJpeg(mk("burst")),
  ]);

  globalThis.setTimeout = origSet;
  globalThis.clearTimeout = origClear;

  check(maxRunning === 1, "هیچ‌گاه بیش از یک تبدیل همزمان اجرا نشد", maxRunning);
  check(
    order.join(",") === "start:a,end:a,start:bad,end:bad,start:b,end:b,start:empty,end:empty,start:burst,end:burst",
    "ترتیب اجرا همان ترتیب فراخوانی است",
    order
  );
  check(results[0].ok === true, "تبدیل عادی موفق");
  check(results[1].ok === false, "تبدیل خراب ok:false برمی‌گرداند (استثنا بیرون نمی‌زند)");
  check(results[2].ok === true, "بعد از شکست، صف ادامه می‌دهد");
  check(results[3].ok === false, "خروجی خالی ok:false");
  check(results[4].ok === true && (results[4] as { blob: Blob }).blob.size === 3, "خروجی آرایه‌ای: اولین تصویر");
  check(live.size === 0, "هیچ تایمر ۲۵ثانیه‌ای زنده نمانده است", live.size);

  __setHeicLoaderForTests();
  if (failed) {
    console.log(`\n${failed} تست ناموفق`);
    process.exit(1);
  }
  console.log("\nهمهٔ تست‌ها موفق");
}
main();
