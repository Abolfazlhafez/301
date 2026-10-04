/**
 * بررسی پیش‌نیازهای محیط اجرا، قبل از اجرای مجموعهٔ تست‌های تجربی.
 *
 * چرا این اسکریپت لازم است: تست‌های تجربی به چهار API استاندارد وب که
 * Node.js آن‌ها را به‌صورت global پیاده‌سازی کرده متکی‌اند — اما این چهار
 * API در نسخه‌های مختلف Node.js با شرایط متفاوتی در دسترس شده‌اند:
 *
 *   - Blob و URL.createObjectURL(blob): از Node.js 16 به بعد
 *   - globalThis.crypto.subtle (Web Crypto API): به‌صورت پایدار و
 *     پیش‌فرض‌فعال از Node.js 20 به بعد (در برخی نسخه‌های ۱۸ نیازمند
 *     فلگ --experimental-global-webcrypto بود)
 *   - سازندهٔ File: دقیقاً از Node.js 20.0.0 به‌عنوان global رسمی
 *     (قبل‌تر در Node.js 18/19 هنوز experimental و پشت فلگ بود)
 *
 * محیط CI این پروژه (.github/workflows/build-apk.yml) روی Node.js 20
 * تنظیم شده که طبق مستندات رسمی باید همهٔ این چهار مورد را پوشش دهد؛
 * این اسکریپت آن فرض را در همان محیط واقعی که تست‌ها اجرا می‌شوند به‌صورت
 * صریح تأیید می‌کند — اگر این فرض به هر دلیلی (مثلاً یک نسخهٔ Node قدیمی‌تر
 * که به‌اشتباه resolve شده) درست نباشد، خطای این اسکریپت بلافاصله و با
 * پیام دقیق مشخص می‌کند کدام API و چرا در دسترس نیست، به‌جای این‌که
 * تست‌های بعدی با خطاهای مبهم و گیج‌کننده (مثل "File is not defined" در
 * وسط یک تست بی‌ربط) شکست بخورند.
 */

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

function checkBlob(): CheckResult {
  try {
    const blob = new Blob(["test"], { type: "text/plain" });
    return { name: "Blob", ok: blob.size === 4, detail: `size=${blob.size}` };
  } catch (err) {
    return { name: "Blob", ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

function checkCreateObjectURL(): CheckResult {
  try {
    const blob = new Blob(["test"]);
    const url = URL.createObjectURL(blob);
    const ok = typeof url === "string" && url.length > 0;
    URL.revokeObjectURL(url);
    return { name: "URL.createObjectURL", ok, detail: ok ? "یک آدرس معتبر تولید شد" : `مقدار غیرمنتظره: ${url}` };
  } catch (err) {
    return { name: "URL.createObjectURL", ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkCryptoSubtle(): Promise<CheckResult> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) {
      return { name: "crypto.subtle", ok: false, detail: "globalThis.crypto.subtle تعریف نشده است" };
    }
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    return { name: "crypto.subtle", ok: !!key, detail: "generateKey با موفقیت اجرا شد" };
  } catch (err) {
    return { name: "crypto.subtle", ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

function checkFile(): CheckResult {
  try {
    if (typeof File === "undefined") {
      return { name: "File", ok: false, detail: "سازندهٔ global به نام File تعریف نشده است" };
    }
    const file = new File([new ArrayBuffer(4)], "test.bin", { type: "application/octet-stream" });
    return { name: "File", ok: file.name === "test.bin" && file.size === 4, detail: `name=${file.name}, size=${file.size}` };
  } catch (err) {
    return { name: "File", ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  // به‌جای process.version مستقیم (که به @types/node در tsconfig.app.json
  // نیاز دارد و آن‌جا فقط types: ["vite/client"] تعریف شده)، از
  // globalThis با cast صریح استفاده می‌شود — این فایل داخل src/ پروژه است
  // و باید بدون تغییر tsconfig اصلی هم typecheck شود.
  const nodeVersion = (globalThis as { process?: { version?: string } }).process?.version ?? "نامشخص";
  console.log("=".repeat(70));
  console.log(`بررسی پیش‌نیازهای محیط اجرا — Node.js ${nodeVersion}`);
  console.log("=".repeat(70));

  const results: CheckResult[] = [checkBlob(), checkCreateObjectURL(), await checkCryptoSubtle(), checkFile()];

  let allOk = true;
  for (const r of results) {
    if (r.ok) {
      console.log(`  ✅ ${r.name}: ${r.detail}`);
    } else {
      allOk = false;
      console.log(`  ❌ ${r.name}: ${r.detail}`);
    }
  }

  console.log("=".repeat(70));

  if (!allOk) {
    console.error(
      "\nمحیط اجرای فعلی فاقد یک یا چند API استاندارد لازم برای تست‌های تجربی است.\n" +
        "این معمولاً یعنی نسخهٔ Node.js در دسترس (چه در CI، چه محلی) قدیمی‌تر از " +
        "نسخهٔ ۲۰ است. برای رفع: مطمئن شوید actions/setup-node در build-apk.yml " +
        "دقیقاً node-version: \"20\" (یا بالاتر) دارد، یا محلی node -v را بررسی کنید."
    );
    throw new Error("بررسی پیش‌نیازهای محیط اجرا ناموفق بود.");
  }

  console.log("همهٔ پیش‌نیازهای محیط اجرا با موفقیت تأیید شدند.\n");
}

main().catch((err) => {
  console.error(err);
  throw err;
});
