# پرامپت ادامهٔ Audit فنی «کارگاه‌یار» (نسخه 1.5.0، بسته -22)

تو در حال ادامهٔ یک Full Technical Audit + بهینه‌سازی RAM/WebView روی پروژهٔ «کارگاه‌یار» هستی (React + TypeScript + Vite + Capacitor، ذخیره‌سازی SQLite نیتیو). همین zip حاوی کد با اصلاحات دور قبل است. زبان پاسخ: فارسی.

## قوانین ثابت
- هیچ Feature حذف نشود؛ ظاهر/UX و منطق مالی بدون Bug واقعی تغییر نکند؛ هیچ داده‌ای حذف/خراب نشود.
- Rewrite ممنوع؛ کمترین تغییر ممکن؛ هر تغییر دلیل مشخص Performance/Memory/Security/Bug داشته باشد.
- هیچ مشکلی را فقط «احتمالی» Bug قطعی اعلام نکن؛ بر اساس کد واقعی بررسی کن. بخش درست را صریحاً «مشکلی ندارد» بنویس.
- شدت: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low. برای هر مورد: Severity، File، Function، مشکل، دلیل، اثر، راه‌حل، اصلاح شد یا نه.
- شبکه در sandbox بسته است؛ npm install/build/test اجرا نمی‌شود. هر تغییر را «تأییدنشده» علامت بزن و کاربر را به `npm run build` و تست‌ها ارجاع بده.
- قبل از رسیدن به سقف نشست: درصد پیشرفت + آخرین فایل‌های تغییرکرده + پرامپت ادامه بده.

## اصلاحات انجام‌شده (تأییدنشده، build نشده)
1. `src/core/storage/nativeStore.ts` — `NativeTable.view()` برای جدول‌های دارای Blob (photos, voiceNotes) دیگر `JSON.parse(JSON.stringify())` عمیق نمی‌کند؛ کپی سطحی + ساخت آدرس‌های blob. (فقط برای filter خواندنی است.)
2. `src/shared/utils/imageFormat.ts` — `convertHeicToJpeg` حالا از صف سراسری عبور می‌کند (یک تبدیل در لحظه)، تایمر ۲۵ثانیه‌ای در `finally` پاک می‌شود، reject دیرهنگام `conversionPromise` گرفته می‌شود. محدودیت: heic2any کاهش رزولوشن قبل از decode و لغو واقعی ندارد.
3. `src/widgets/photo-gallery/PhotoGallery.tsx` — رندر تدریجی (PAGE_SIZE=60 با IntersectionObserver + sentinel با disconnect در cleanup)، انتخاب چندتایی با `Set`. این Virtualized Grid واقعی نیست (آیتم‌های خارج از دید از DOM حذف نمی‌شوند)؛ آزادسازی `src` تصویر قبلاً در `useLazyPhotoSrc` هست.
4. `src/App.tsx` — QueryClient: `gcTime: 120_000`.

## یافته‌های باز (اصلاح‌نشده)
- 🟠 **کل دیتابیس در RAM:** `NativeDatabase.open()` ⇒ `loadAllFromBackend()` همهٔ ردیف‌های همهٔ جدول‌ها را در `Map` می‌ریزد؛ کوئری‌ها در JS (`Collection.exec` با filter/sort). جدول‌های SQLite فقط `(id, data JSON)` دارند. API کل پروژه (`where().filter(fn)`) بر predicate JS بنا شده؛ تغییر ریشه‌ای = تغییر لایهٔ داده. راه پله‌ای پیشنهادی بدون Rewrite: (الف) ستون‌های index‌شدهٔ مشتق (projectId, workerId, date) در `sqliteBackend` + `loadWhere` اختیاری؛ (ب) lazy-load جدول‌های سنگین/کم‌استفاده (floorActivityEvents, dailyReportNotes, workLogNotes, wageCalculations) به‌جای load در startup؛ (ج) کش‌کردن نتیجهٔ `allStored()` (فعلاً در هر کوئری دوباره sort می‌شود) با invalidate در writeMany/bulkDelete/clear/rollback — ریسک بالا، حتماً با تست.
- 🟠 **`allowBackup="true"`** در AndroidManifest: کلید `device-key.json` (متن ساده) + دیتابیس با Auto Backup/adb خارج می‌شوند. پیشنهاد: `allowBackup="false"`. **کاربر هنوز تصمیم نگرفته؛ بدون تأیید تغییر نده.**
- 🟡 `file_paths.xml`: `external-path path="."` خیلی گسترده؛ به زیرپوشه‌های واقعی محدود شود.
- 🟡 جداسازی پروژه‌ها ناقص است (طبق کامنت `entities/Project.ts`)؛ attendance با projectId فیلتر می‌شود، ledger بر اساس workerId. نشت واقعی هنوز تأیید نشده. تعویض پروژه `invalidateQueries()` سراسری می‌زند.
- 🟢 `SafePhotoImage.handleRetry` خطا را بی‌صدا می‌بلعد (بدون log/UI).

## بررسی‌شده و بدون مشکل
- بکاپ stream نسخهٔ ۲ (`backupStream.ts`): رمز هر رکورد جدا (AES-GCM + AAD)، تکهٔ `end` اجباری، تست دارد.
- `useLazyPhotoSrc` / thumbnail / آزادسازی src.
- `MainActivity.onRenderProcessGone` (سقف ۳ بازسازی در ۱۵ ثانیه) — حفظ شود.
- پول: مبالغ integer، `Math.round` در مرز محاسبه؛ خطای floating-point مالی پیدا نشد.
- listener/interval/observer در ۱۲ فایل بررسی شد؛ cleanup دارند. XSS sink (`dangerouslySetInnerHTML/eval/new Function/innerHTML`) نیست.
- Auth/PIN/AutoLock/Supabase-RLS/Sync دوطرفه در این پروژه وجود ندارد (فقط بکاپ ابری) — موضوعیت ندارد.

## کارهای باقی‌مانده (به ترتیب پیشنهادی)
1. سؤال از کاربر: `allowBackup` ⇒ false؟ سپس اعمال.
2. `reportService.ts`, `dashboardService.ts`, `CashbookSection.tsx`, `WorkerAccountSection.tsx`: aggregationهای JS روی هزاران رکورد؛ فقط اگر بدون تغییر خروجی ممکن است سبک شوند (cache/یک بار خواندن). محاسبات مالی را عوض نکن.
3. جستجوی سراسری (`GlobalSearchDialog.tsx` + سرویس مربوط): محدودکردن نتیجه + debounce؛ بررسی نکردن کل DB.
4. Restore: `backupService.ts` — نسخهٔ قدیمی (v1 JSON / رمزنگاری‌نشده) در برابر v2؛ restore ناقص؛ اتمیک بودن؛ بررسی اینکه restore کل عکس‌ها را همزمان در RAM نگه نمی‌دارد.
5. swallow شدن خطاها (`catch {}` بی‌صدا) در مسیرهای مهم: backup/restore/عکس؛ بدون log دادهٔ حساس.
6. سایر WebView: stateهای بزرگ/Context حجیم، memo برای لیست‌های سنگین (AttendancePage 1184 خط، BulkAttendanceSheet، WorkersPage).
7. تست‌ها: فهرست `package.json` (scripts `test:*`)؛ برای تغییرات این دور تست بنویس: view() سطحی در nativeStore (جدول blob، بدون mutation رکورد ذخیره‌شده)، صف HEIC (ترتیب و پاک شدن تایمر)، رندر تدریجی گالری.
8. گزارش نهایی با ساختار FINAL AUDIT (Critical/High/Medium/Low، Performance، Security، Data Integrity، Sync، اصلاحات، باقی‌مانده، نتیجه A/B/C/D).

## وضعیت موقت
نتیجه: **C** (کل DB در RAM، allowBackup باز، جداسازی ناقص پروژه‌ها). پیشرفت Audit ≈ ۵۵٪.

## اصلاحات دور بعد (-23، تأییدنشده، build نشده)
5. `src/widgets/search/GlobalSearchDialog.tsx` — فیلتر جستجوی سراسری روی `useDeferredValue(query)` (کلیدزدن سریع فیلتر را بلاک نمی‌کند). سقف ۸ نتیجه در هر دسته و حداقل ۲ حرف از قبل بود. 🟢
6. `src/core/services/backupService.ts` — `restoreFromPayload` (فایل‌های v1/JSON ساده): تبدیل base64→Blob دیگر برای همهٔ عکس/صوت قبل از تراکنش انجام نمی‌شود، یکی‌یکی داخل تراکنش؛ `photos ?? []` هم اضافه شد (قبلاً فایل بدون کلید photos با TypeError خراب می‌شد، قبل از دست‌زدن به DB). محدودیت: متن کامل JSON و آبجکت parse‌شده هنوز در RAM است. 🟡
7. `cloudBackupService.ts` و `nativeStore.ts` — `catch` بی‌صدا حالا فقط `console.warn` دارد (نام خطا / نام جدول+کلید، بدون محتوا). رفتار تغییر نکرده.

## بررسی‌شده و بدون مشکل (دور -23)
- Restore نسخهٔ v2: دو پیمایش (اعتبارسنجی کامل سپس نوشتن)، تراکنش، هر عکس یک‌به‌یک، تکهٔ end اجباری، شناسهٔ تکراری رد می‌شود → اتمیک و RAM-safe.
- `dashboardService.getSummary` فقط حضور امروز را می‌خواند؛ نیازی به تغییر نیست.
- بقیهٔ `catch` های بی‌صدا (mkdir، پاک‌سازی بکاپ خارجی، haptics، نوتیفیکیشن، ترجیحات UI) best-effort و بی‌خطرند.

## یافتهٔ جدید (اصلاح‌نشده)
- 🟡 بکاپ ابری خودکار هیچ خطایی به کاربر نشان نمی‌دهد (فیلد خطا در تنظیمات نیست؛ افزودنش تغییر UI/مدل است → بدون تأیید انجام نشد).
- 🟢 در `floorSearchResults` سقف ۸ برای مجموع ۵ نوع Floor است؛ طبقه‌ها نتیجهٔ تسک/مشکل را جابه‌جا می‌کنند (رفتار، نه Bug قطعی).

## اصلاحات دور -24 (تأییدنشده، build/تست اجرا نشده)
8. 🟠 **یافتهٔ واقعی و اصلاح‌شده:** `nativeStore.ts` — `NativeTable.where(criteria)` و `WhereClause.make` هر بار `allStored()` (کپی + sort کل جدول) و سپس فیلتر می‌کردند. `getMonthlyAllWorkersReport` برای هر (نیرو × روز) چند where صدا می‌زند (مثلاً ۵۰ نیرو × ۳۰ روز ≈ ۱۵۰۰ گزارش روزانه × چند کوئری) ⇒ هزاران sort روی کل جدول‌های attendances/timeLosses/breakTimes/guardShifts. راه‌حل: متد `filterStored(pred)` = فیلتر سپس sort فقط نتیجه. ترتیب خروجی دقیقاً همان (id)، بدون cache و بدون ریسک invalidate. `allStored()` برای toArray/orderBy/toCollection دست‌نخورده.
9. تست جدید `nativeStoreQueryOrder.experimental.test.ts` (اسکریپت `test:native-query-order`، داخل `test:experimental`): ترتیب id در where/equals، tie-break، و اینکه filter روی جدول Blob رکورد ذخیره‌شده را تغییر نمی‌دهد (پوشش تغییر ۱).

## یافته‌های باز تازه
- 🟡 `reportService.getMonthlyWorkerReport` همهٔ روزها را با `Promise.all` و هر روز `getDailyWorkerReport` (که دوباره worker/settings/projectId را می‌خواند) اجرا می‌کند. بعد از اصلاح ۸ هزینهٔ هر کوئری O(n) است، ولی هنوز N×D×۶ کوئری ست. بهبود بعدی: chunk کردن همزمانی (مثلاً ۸ تایی) یا پاس‌دادن worker/settings از بالا. خروجی مالی را تغییر نده.
- 🟢 `where(criteria)` هنوز O(n) اسکن است (ایندکس واقعی نیست) — با `loadWhere`/ستون‌های ایندکس (یافتهٔ باز اول) حل می‌شود.

## اصلاحات و بررسی‌های دور -25 (تأییدنشده)
10. 🟡 `reportService.ts` — `mapInChunks`: روزهای هر نیرو حداکثر ۸تایی و نیروها حداکثر ۴تایی همزمان (سقف ≈ ۳۲ به‌جای ≈ ۱۵۰۰). ترتیب خروجی و محاسبات مالی بدون تغییر. فقط اوج حافظهٔ Promiseهای معلق کم می‌شود؛ CPU کل را اصلاح ۸ کم کرده بود.
- `file_paths.xml`: تنها منابع Share از `Directory.Cache` هستند، پس `external-path path="."` برای Share لازم نیست. اما Camera پلاگین (v6) هم از همین FileProvider استفاده می‌کند و مسیر دقیق فایلش بدون دستگاه تأیید نشد. FileProvider خودش `exported=false` است و فقط URIهای ساخته‌شدهٔ خود اپ را می‌دهد ⇒ شدت را به 🟢 پایین آوردم و **تغییر ندادم**. اگر خواستید: `external-files-path` به‌جای `external-path` و حتماً تست دستی دوربین + Share روی گوشی.
- `WorkersPage` / `WorkerCard`: کارت memo نیست و lambda درون‌خطی دارد، ولی تعداد نیرو در یک کارگاه چند ده است ⇒ هزینهٔ رندر ناچیز؛ 🟢، تغییر لازم نیست. `AttendancePage` و `BulkAttendanceSheet` هنوز بررسی نشده‌اند.

## بررسی دور -26 (بدون تغییر کد)
- `AttendancePage.tsx` (1184 خط): ۱۰ کوئری React Query همه با `enabled` و کلید شامل worker/date؛ فیلتر/sort روی آرایه‌های کوچک (نوبت‌های یک نیرو)؛ `invalidateQueries` با prefix فقط کوئری‌های فعال را دوباره می‌خواند. مشکلی ندارد.
- `BulkAttendanceSheet.tsx` (1016 خط): `activeWorkers`/`rows`/`attByWorker` با `useMemo`؛ `useEffect`ها وابسته به state محلی و بدون listener/interval. تنها نکته 🟢: تایمر long-press (`press.current.timer`) هنگام unmount پاک نمی‌شود؛ در React 18 فقط یک setState بی‌اثر است، نه نشت واقعی. نیازی به تغییر نیست.
- تست صف HEIC: `heic2any` با dynamic import لود می‌شود و در `tsx` بدون mock قابل اجرا نیست؛ هنوز نوشته نشده (نیاز به stub ماژول یا تزریق وابستگی ⇒ تغییر کد تولیدی؛ بدون تأیید انجام نشد). تست رندر تدریجی گالری هم به DOM/IntersectionObserver نیاز دارد و هنوز نوشته نشده.

## دور -28 (تأییدنشده؛ build/تست اجرا نشده)
تصمیم‌های کاربر: `allowBackup` فعال بماند (تغییر نده)؛ تست‌ها «هرچه بهتر است»؛ خطای بکاپ ابری در UI بله؛ سبک‌کردن RAM مرحله‌ای بله.
انجام شد:
- بکاپ ابری: `lastCloudBackupErrorAt/Message` + `markCloudBackupError` + Alert در `CloudBackupCard` + کلید `cloudBackup.lastFailed` در ۸ زبان.
- `imageFormat.ts`: `__setHeicLoaderForTests` (تزریق وابستگی کوچک) + تست `heicQueue.experimental.test.ts`.
- RAM مرحلهٔ ۱: `TableDef.lazy` + `NativeDatabase.ensureLoaded` (Promise مشترک)، فقط `wageCalculations` و `floorActivityEvents` lazy شدند؛ lazy+Blob ممنوع؛ تست `nativeLazyTables.experimental.test.ts`. `loadAllFromBackend()` (مهاجرت) همچنان همه را می‌خواند.
باقی: تست گالری (DOM)، تست تایم‌اوت HEIC، lazy کردن `dailyReportNotes`/`workLogNotes` (نیاز به تغییر backfill استارتاپ در `db.ts: ensureDatabaseSeeded`)، ایندکس مشتق، `file_paths.xml`. پیشرفت ≈ ۹۷٪. نمره: C+.
