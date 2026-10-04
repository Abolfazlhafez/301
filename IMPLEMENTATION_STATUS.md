# وضعیت پیاده‌سازی دفترچه دیجیتال طبقه

## تکمیل‌شده در این مرحله
- Project/Floor Workspace و مسیرهای Project → Floor Notebook
- مدل‌های Floor / FloorStage / FloorTask / FloorPlan / FloorIssue / FloorWorker / Checklist / Activity Event
- Seed هشت Stage استاندارد و چک‌لیست پیش‌فرض
- Progress محاسبه‌شده/دستی و Health Score
- CRUD و اعتبارسنجی روابط Stage/Task/Issue/Worker/Plan
- مدیریت ترتیب Stage و ویرایش Weight
- Activity Feed مبتنی بر رویدادهای واقعی
- Photos با ارتباط Floor/Stage/Task و مراحل Before/During/After
- Plans و Revision chain
- Finance/Work Log/Activities به‌صورت Relation بدون ایجاد دادهٔ موازی
- Dashboard entry و Global Search برای Floor/Task/Plan/Issue/Report
- Backup/Restore table registration و Migrationهای Dexie
- Localization و RTL/LTR با سیستم فعلی پروژه
- تست‌های تجربی مرتبط با Floor Notebook و یکپارچگی داده

## اصلاح تکمیلی جدید
هنگام حذف Floor، هر رکورد Photo که `floorId` آن Floor است اکنون فقط Unlink می‌شود:
- `floorId = null`
- `stageId = null`
- `taskId = null`

خود Photo، Blob و سابقهٔ آن حذف نمی‌شود. این رفتار با اصل حفظ داده و الزامات Backup سازگار است.

همچنین تست تجربی جدید:
`src/core/__tests__/floorNotebookDeleteRelations.experimental.test.ts`
اضافه شده و در `package.json` با نام `test:floor-notebook-delete-relations` ثبت شده است.

## وضعیت اجرای تست در این محیط
اجرای تست/Build کامل در این محیط انجام نشد، چون وابستگی‌های `node_modules` در ZIP موجود نیستند و تلاش برای نصب npm در محیط اجرا با timeout متوقف شد. بنابراین موفقیت Build نهایی را ادعا نمی‌کنیم.


## اصلاح تکمیلی بعدی
- `photoService.upload` اکنون `relatedType: "floor"` را نیز با `effectiveFloorId` اعتبارسنجی می‌کند؛ عکس طبقه بدون شناسه طبقه رد می‌شود و `floorId`/`relatedId` ناسازگار نیز رد می‌شود.
- هنگام حذف Floor، ارتباط‌های `issueId` و `checklistItemId` عکس‌های آن Floor نیز Unlink می‌شوند تا Relation معلق باقی نماند؛ خود Photo و Blob حذف نمی‌شوند.
- تست ایزولیشن Photo برای جلوگیری از اتصال عکس Floor به پروژه دیگر توسعه یافت.


## اصلاح تکمیلی سوم
- برای جلوگیری از Cross-Project Photo Relation، تست مستقل مالکیت عکس Floor اضافه شد و سناریوهای `relatedId` متعلق به پروژهٔ دیگر و `floorId`/`relatedId` ناسازگار را پوشش می‌دهد.
- این تست در `test:floor-notebook-all` نیز وارد شد.
