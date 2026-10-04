# FINAL AUDIT — کارگاه‌یار 1.5.0 (بسته -26)

> **تأییدشده (دور -29):** `npm ci`، `npx tsc -b` (۰ خطا)، `npx oxlint` (۰ خطا، ۱ هشدار قدیمی `useToast`)، `npm run test:experimental` (خروج ۰، صفر ناموفق)، `npm run build` (موفق) و `test:text-selection-guard` در sandbox اجرا شد. تست دستی روی گوشی (دوربین، Share، گالری) هنوز لازم است.

**نمرهٔ نهایی: C+** (به B می‌رسد اگر بارگذاری بقیهٔ جدول‌ها هم مرحله‌ای سبک شود؛ `allowBackup` به تصمیم کاربر باز مانده)

## ۱. Critical 🔴
مورد قطعی پیدا نشد.

## ۲. High 🟠
| # | File / Function | مشکل | وضعیت |
|---|---|---|---|
| H1 | `core/storage/nativeStore.ts` — `where(criteria)`, `WhereClause.make` | هر کوئری کل جدول را کپی+sort می‌کرد؛ گزارش ماهانه (نیرو×روز×چند کوئری) هزاران sort | **اصلاح شد** (`filterStored`: فیلتر، سپس sort فقط نتیجه؛ ترتیب خروجی یکسان) |
| H2 | `NativeDatabase.open()` ⇒ `loadAllFromBackend()` | همهٔ ردیف‌های همهٔ جدول‌ها در `Map`؛ کوئری‌ها در JS | **مرحلهٔ ۱ انجام شد:** `TableDef.lazy` + `ensureLoaded` (بارگذاری تنبل، همزمانی‌امن) برای `wageCalculations` و `floorActivityEvents`. **ارزیابی دور -29:** lazy کردن `dailyReportNotes`/`workLogNotes` عمداً انجام نشد: هر دو فقط یادداشت متنی‌اند (یک ردیف برای هر پروژه×روز، Blobها روی دیسک‌اند)، سود RAM ناچیز است، ولی ترمیم id در `ensureDatabaseSeeded` (حذف و بازساخت رکورد) باید به hook بارگذاری منتقل شود = ریسک داده بدون سود قابل‌اندازه. **باقی:** بقیهٔ جدول‌ها هنوز eager؛ ایندکس‌های مشتق |
| H3 | `AndroidManifest.xml` — `allowBackup="true"` | `device-key.json` (متن ساده) و دیتابیس با Auto Backup/adb قابل استخراج | **تصمیم کاربر: فعال بماند** (بکاپ خودکار اندروید مطلوب است). تغییر داده نشد؛ ریسک پذیرفته‌شده. |

## ۳. Medium 🟡
- **M1** `reportService.ts` — همزمانی کنترل‌نشدهٔ ≈۱۵۰۰ Promise در گزارش ماهانه ⇒ **اصلاح شد** (`mapInChunks`، سقف ≈۳۲).
- **M2** `backupService.restoreFromPayload` (v1) — همهٔ Blobها قبل از تراکنش ساخته می‌شد؛ فایل بدون کلید `photos` TypeError می‌داد ⇒ **اصلاح شد** (یکی‌یکی داخل تراکنش، `?? []`). محدودیت: JSON کامل هنوز در RAM است.
- **M3** `nativeStore.NativeTable.view()` — `JSON.parse(JSON.stringify())` عمیق برای جدول‌های Blob در هر filter ⇒ **اصلاح شد** (کپی سطحی).
- **M4** `imageFormat.convertHeicToJpeg` — تبدیل همزمان، تایمر پاک‌نشده، reject دیرهنگام ⇒ **اصلاح شد** (صف، `finally`، catch). محدودیت: heic2any لغو واقعی ندارد.
- **M5** `PhotoGallery.tsx` — رندر یک‌جا ⇒ **اصلاح شد** (PAGE_SIZE=60 + IntersectionObserver). Virtualized واقعی نیست.
- **M6** جداسازی ناقص پروژه‌ها (طبق کامنت `entities/Project.ts`) — نشت واقعی تأیید نشد؛ **باز**.
- **M7** بکاپ ابری خودکار هیچ خطایی به کاربر نشان نمی‌داد ⇒ **اصلاح شد:** فیلدهای `lastCloudBackupErrorAt/Message`، `markCloudBackupError`، Alert در `CloudBackupCard`، کلید `cloudBackup.lastFailed` در ۸ زبان؛ با اولین موفقیت بعدی پاک می‌شود.

## ۴. Low 🟢
- `file_paths.xml`: `external-path path="."` گسترده است ولی Share فقط از `Directory.Cache` می‌خواند و Camera (v6) از همین provider استفاده می‌کند؛ provider `exported=false` است ⇒ تغییر نکرد.
- `SafePhotoImage.handleRetry` خطا را بی‌صدا می‌بلعد.
- تایمر long-press در `BulkAttendanceSheet` هنگام unmount پاک نمی‌شود (بی‌اثر در React 18).
- سقف ۸ نتیجهٔ جستجوی سراسری برای مجموع ۵ نوع Floor مشترک است.
- `QueryClient`: `gcTime` = ۱۲۰ ثانیه (**انجام شد**).

## ۵. Performance / RAM / WebView
انجام‌شده: H1, M1, M3, M4, M5، `useDeferredValue` در جستجوی سراسری، `gcTime`.
بدون مشکل: `useLazyPhotoSrc` و thumbnail (آزادسازی src)، `MainActivity.onRenderProcessGone` (سقف ۳ بازسازی در ۱۵ ثانیه — حفظ شود)، `AttendancePage` و `BulkAttendanceSheet` (کوئری‌های `enabled`، `useMemo`)، `dashboardService`.
باقی: H2.

## ۶. Security
- بدون مشکل: XSS sink (`dangerouslySetInnerHTML/eval/new Function/innerHTML`) وجود ندارد؛ بکاپ v2 با AES-GCM + AAD برای هر رکورد، تکهٔ `end` اجباری.
- باز (ریسک پذیرفته‌شده): H3 — کلید دستگاه و دیتابیس از مسیر Auto Backup/adb قابل استخراج‌اند.
- موضوعیت ندارد: Auth/PIN/AutoLock/Supabase-RLS (فقط بکاپ ابری).

## ۷. Data Integrity
- Restore v2: دو پیمایش (اعتبارسنجی کامل ⇒ سپس نوشتن در یک تراکنش)، شناسهٔ تکراری رد می‌شود، شکست = بازگشت کامل ⇒ **سالم**.
- پول: مبالغ integer، `Math.round` در مرز محاسبه؛ خطای floating-point مالی پیدا نشد. هیچ محاسبهٔ مالی تغییر نکرد.
- رکورد JSON خراب در `loadAllFromBackend` رد می‌شود (در SQLite دست‌نخورده)؛ حالا لاگ می‌شود.

## ۸. Sync
همگام‌سازی دوطرفه وجود ندارد؛ فقط بکاپ ابری (Supabase، تکه‌تکه). Restore ابری از همان مسیر `restoreFromSource` می‌گذرد.

## ۹. فایل‌های تغییرکرده
`nativeStore.ts`، `storage/types.ts`، `db.ts`، `imageFormat.ts`، `PhotoGallery.tsx`، `App.tsx`، `GlobalSearchDialog.tsx`، `backupService.ts`، `cloudBackupService.ts`، `settingsService.ts`، `entities/AppSettings.ts`، `CloudBackupCard.tsx`، `reportService.ts`، ۸ فایل `i18n/locales/*/common.json`، `package.json`.
تست‌های جدید: `test:search-digit-match`، `test:native-query-order`، `test:native-lazy`، `test:heic-queue`، `test:gallery-paging` (+ یک assertion در `cloudBackupChunked`). همه داخل `test:experimental`.

## ۱۰. باقی‌مانده
1. ~~تست رندر تدریجی گالری~~ ⇒ **انجام شد (دور -29)** در سطح SSR (`test:gallery-paging`: ۱۳۰ عکس ⇒ ۶۰ کارت؛ با شکستن عمدی کد، تست قرمز شد). باقی: افزودن دستهٔ بعد با اسکرول (IntersectionObserver) نیاز به DOM واقعی/تست دستی روی گوشی دارد.
2. تست تایم‌اوت ۲۵ثانیه‌ای HEIC (ثابت داخلی است؛ تست آن ۲۵ ثانیه طول می‌کشد).
3. **کش `allStored()` عمداً انجام نشد (بنچمارک دور -29، ۲۰هزار ردیف، حافظه):** ۱۵۰۰ بار `where()` ≈ ۸۸۰ms (≈۰٫۶ms هر کوئری)، و `toArray()` کامل ≈ ۳۰ms. مسیرهای گزارش از `where()` می‌گذرند (اصلاح H1)، و `toArray()` فقط در فهرست‌های تک‌باره (ledger/cashbook/timeLoss/breakTime list) صدا زده می‌شود، نه داخل حلقهٔ گزارش. کش یعنی ریسک invalidate روی writeMany/bulkDelete/clear/rollback بدون سود قابل‌اندازه ⇒ بسته. ادامهٔ سبک‌کردن RAM: `dailyReportNotes`/`workLogNotes` (backfill هر استارت)، ایندکس‌های مشتق، کش `allStored()`.
4. `external-path path="."` در `file_paths.xml` (نیاز به تست دستی دوربین/Share).


## ۱۱. قابلیت کوچک افزوده‌شده (دور -29، خارج از Audit)
جستجوی فهرست «نیروها» و «انبار» حالا به نوع رقم (فارسی/عربی/انگلیسی) حساس نیست (قبلاً فقط جستجوی سراسری این‌طور بود): تابع `matchesSearchTerm` در `shared/utils/format.ts`، استفاده در `WorkersPage.tsx` و `EquipmentInventorySection.tsx`. فقط فیلتر نمایشی است؛ داده و منطق مالی تغییر نکرد. تست: `test:search-digit-match`. تأییدشده: tsc، oxlint، `test:experimental`، build.
