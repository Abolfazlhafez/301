import Dexie, { type Table } from "dexie";
import type { Worker } from "../entities/Worker";
import type { Attendance } from "../entities/Attendance";
import type { BreakTime } from "../entities/BreakTime";
import type { TimeLoss } from "../entities/TimeLoss";
import type { Equipment, EquipmentAssignment } from "../entities/Equipment";
import type { WorkerLedgerEntry } from "../entities/Ledger";
import type { CashbookEntry } from "../entities/Cashbook";
import type { CashboxFund } from "../entities/CashboxFund";
import type { Photo } from "../entities/Photo";
import type { PictureCard } from "../entities/PictureCard";
import type { FutureActivity } from "../entities/FutureActivity";
import type { GuardShift } from "../entities/GuardShift";
import type { DailyReportNote } from "../entities/DailyReportNote";
import type { WorkLogNote } from "../entities/WorkLogNote";
import type { OptionalLeave } from "../entities/OptionalLeave";
import type { JobType, WageMethod } from "../entities/JobType";
import type { WageAssignment, WageCalculationRecord } from "../entities/WageAssignment";
import type { Floor } from "../entities/Floor";
import type { FloorStage } from "../entities/FloorStage";
import type { FloorTask } from "../entities/FloorTask";
import type { FloorPlan } from "../entities/FloorPlan";
import type { FloorIssue } from "../entities/FloorIssue";
import type { FloorWorker } from "../entities/FloorWorker";
import type { FloorChecklistItem } from "../entities/FloorChecklistItem";
import type { FloorActivityEvent } from "../entities/FloorActivityEvent";
import type { Project } from "../entities/Project";
import type { ProjectWorker } from "../entities/ProjectWorker";
import type { WorkerGroup, GroupWagePayment } from "../entities/WorkerGroup";
import type { VoiceNote } from "../entities/VoiceNote";
import { randomUUID } from "./utils/uuid";
import type { SettingsRow, DeviceSecretRow } from "./dbTypes";

/**
 * ⚠️ فقط برای مهاجرت یک‌باره.
 * این فایل schema قدیمی Dexie/IndexedDB را نگه می‌دارد تا نصب‌های قدیمی (که داده‌شان
 * هنوز داخل IndexedDB مرورگر WebView است) یک‌بار خوانده و به ذخیره‌سازی نیتیو
 * (SQLite + فایل) منتقل شوند. بقیهٔ برنامه هرگز نباید از این فایل import کند؛
 * فقط storage/migrateFromIndexedDb.ts.
 * عمداً Blobها در این‌جا همان نوع قدیمی‌اند (blob داخل رکورد).
 */
const SETTINGS_ROW_ID = "app-settings";
export interface LegacyVoiceNote extends VoiceNote { blob: Blob }
export interface LegacyPhoto extends Photo {
  blob: Blob;
  displayBlob?: Blob;
  detectedKind?: "jpeg" | "png" | "webp" | "gif" | "heic" | "unknown";
  displayConversionFailed?: boolean;
}

class LegacyKaregahYarDatabase extends Dexie {
  workers!: Table<Worker, string>;
  attendances!: Table<Attendance, string>;
  breakTimes!: Table<BreakTime, string>;
  timeLosses!: Table<TimeLoss, string>;
  equipment!: Table<Equipment, string>;
  equipmentAssignments!: Table<EquipmentAssignment, string>;
  ledgerEntries!: Table<WorkerLedgerEntry, string>;
  cashbookEntries!: Table<CashbookEntry, string>;
  photos!: Table<LegacyPhoto, string>;
  settings!: Table<SettingsRow, string>;
  pictureCards!: Table<PictureCard, string>;
  futureActivities!: Table<FutureActivity, string>;
  guardShifts!: Table<GuardShift, string>;
  dailyReportNotes!: Table<DailyReportNote, string>;
  workLogNotes!: Table<WorkLogNote, string>;
  cashboxFunds!: Table<CashboxFund, string>;
  optionalLeaves!: Table<OptionalLeave, string>;
  jobTypes!: Table<JobType, string>;
  wageMethods!: Table<WageMethod, string>;
  wageAssignments!: Table<WageAssignment, string>;
  wageCalculations!: Table<WageCalculationRecord, string>;
  deviceSecrets!: Table<DeviceSecretRow, string>;
  floors!: Table<Floor, string>;
  floorStages!: Table<FloorStage, string>;
  floorTasks!: Table<FloorTask, string>;
  floorPlans!: Table<FloorPlan, string>;
  floorIssues!: Table<FloorIssue, string>;
  floorWorkers!: Table<FloorWorker, string>;
  floorChecklistItems!: Table<FloorChecklistItem, string>;
  floorActivityEvents!: Table<FloorActivityEvent, string>;
  projects!: Table<Project, string>;
  projectWorkers!: Table<ProjectWorker, string>;
  workerGroups!: Table<WorkerGroup, string>;
  groupWagePayments!: Table<GroupWagePayment, string>;
  voiceNotes!: Table<LegacyVoiceNote, string>;

  constructor() {
    super("karegah-yar-db");

    this.version(1).stores({
      workers: "id, isActive, firstName, lastName, phoneNumber, createdAt",
      attendances: "id, workerId, date, [workerId+date], createdAt",
      breakTimes: "id, workerId, attendanceId, createdAt",
      timeLosses: "id, workerId, attendanceId, createdAt",
      equipment: "id, name, createdAt",
      equipmentAssignments: "id, equipmentId, workerId, returnedDate, createdAt",
      ledgerEntries: "id, workerId, type, date, createdAt",
      photos: "id, relatedType, relatedId, date, createdAt",
      settings: "id",
    });

    // نسخه ۲: افزودن دفتر حساب کلی (خرج، حقوق، واریزی) — مستقل از حساب تک‌تک نیروها
    this.version(2).stores({
      cashbookEntries: "id, type, date, workerId, createdAt",
    });

    // نسخه ۳: افزودن پیکچر کارت‌های حرفه‌ای (مجموعه‌های قالب‌بندی‌شدهٔ عکس روزانه)
    this.version(3).stores({
      pictureCards: "id, date, templateId, createdAt",
    });

    // نسخه ۴: افزودن فعالیت‌های آینده ساختمان (یادآوری/برنامه‌ریزی)
    this.version(4).stores({
      futureActivities: "id, date, seriesId, isCompleted, priority, createdAt",
    });

    // نسخه ۵: افزودن نوبت‌های نگهبانی (مستقل از حضور و غیاب عادی)
    this.version(5).stores({
      guardShifts: "id, workerId, date, [workerId+date], createdAt",
    });

    // نسخه ۶: افزودن شیفت پیش‌فرض (ساعت ورود/خروج ثابت) به هر نیرو — برای پرشدن
    // خودکار فرم ثبت حضور روزانه. فیلدهای جدید (defaultCheckIn/defaultCheckOut) داخل
    // آبجکت workers ذخیره می‌شوند و چون ایندکسی به آن‌ها نیاز نیست، schema جدول
    // workers نسبت به نسخه ۱ بدون تغییر می‌ماند؛ رکوردهای قدیمی این فیلدها را
    // نخواهند داشت و workerService با withGuardDefaults مقدار null امن اعمال می‌کند.
    this.version(6).stores({});

    // نسخه ۷: افزودن یادداشت سرپرست برای گزارش روزانه (کلید = تاریخ) و اطلاعات
    // پروژه/سرپرست در تنظیمات (فیلدهای projectName/supervisorName داخل آبجکت
    // settings ذخیره می‌شوند و چون ایندکس نمی‌خواهند، schema جدول settings
    // بدون تغییر می‌ماند؛ withDefaults در settingsService مقدار پیش‌فرض خالی
    // برای رکوردهای قدیمی برمی‌گرداند).
    this.version(7).stores({
      dailyReportNotes: "id, date",
      workLogNotes: "id, date",
    });

    // نسخه ۸: افزودن «صندوق» (چند صندوق مستقل به‌جای یک دفتر حساب واحد).
    // هر تراکنش قدیمی دفتر حساب باید یک fundId داشته باشد؛ برای این‌که هیچ
    // داده‌ای گم نشود، یک صندوق پیش‌فرض («صندوق اصلی») ساخته و همهٔ
    // تراکنش‌های موجود به آن نسبت داده می‌شوند — از دید کاربر، بعد از این
    // ارتقا همه‌چیز دقیقاً مثل قبل زیر یک صندوق باقی می‌ماند، فقط از این به
    // بعد می‌تواند صندوق‌های بیشتری هم اضافه کند.
    this.version(8)
      .stores({
        cashboxFunds: "id, name, isDefault, createdAt",
        cashbookEntries: "id, type, date, workerId, fundId, createdAt",
      })
      .upgrade(async (tx) => {
        const defaultFundId = randomUUID();
        const now = new Date().toISOString();
        await tx.table("cashboxFunds").add({
          id: defaultFundId,
          name: "صندوق اصلی",
          description: null,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        });

        // اعتبارسنجی صحت Migration: طبق الزام صریح «قبل و بعد از Migration
        // صحت داده‌ها را بررسی کن؛ تعداد رکوردها را با قبل مقایسه کن» —
        // تعداد تراکنش‌های دفتر حساب باید دقیقاً قبل و بعد از این ارتقا
        // یکسان بماند (فقط fundId هرکدام پر می‌شود، هیچ رکوردی نه اضافه و
        // نه کم نمی‌شود). اگر این تساوی برقرار نبود، یعنی .modify() به هر
        // دلیلی ناقص اجرا شده — و باید صریحاً fail شود تا Migration نصفه‌کاره
        // به‌عنوان «موفق» ثبت نشود (Dexie نسخهٔ دیتابیس را فقط در صورت
        // throw نکردن upgrade() ارتقا می‌دهد؛ throw کردن یعنی کل تراکنش
        // Migration، شامل ساخت صندوق پیش‌فرض، خودکار rollback می‌شود).
        const countBeforeModify = await tx.table("cashbookEntries").count();

        await tx
          .table("cashbookEntries")
          .toCollection()
          .modify((entry: CashbookEntry) => {
            entry.fundId = defaultFundId;
          });

        const countAfterModify = await tx.table("cashbookEntries").count();
        if (countAfterModify !== countBeforeModify) {
          throw new Error(
            `Migration نسخهٔ ۸ ناقص است: تعداد تراکنش‌های دفتر حساب قبل (${countBeforeModify}) ` +
              `با بعد (${countAfterModify}) برابر نیست. برای جلوگیری از از دست رفتن داده، این ارتقا متوقف شد.`
          );
        }

        const entriesWithoutFundId = await tx
          .table("cashbookEntries")
          .toCollection()
          .filter((entry: CashbookEntry) => !entry.fundId)
          .count();
        if (entriesWithoutFundId > 0) {
          throw new Error(
            `Migration نسخهٔ ۸ ناقص است: ${entriesWithoutFundId} تراکنش هنوز fundId معتبر ندارند.`
          );
        }
      });

    // نسخه ۹: افزودن «غیبت مجاز» (روزهای کامل غیبت با اجازه/توافق، مثل مرخصی
    // استعلاجی یا مأموریت). این جدول کاملاً مستقل از attendances است — چون
    // اصلاً حضوری در کار نبوده که به آن وصل شود؛ برخلاف timeLosses که به یک
    // رکورد Attendance موجود وصل می‌شود.
    this.version(9).stores({
      optionalLeaves: "id, workerId, date, [workerId+date], type, createdAt",
    });

    // نسخه ۱۰: سیستم کامل «تیپ نیرو و محاسبهٔ دستمزد سفارشی».
    // jobTypes: شغل‌ها (بنا، جوشکار، ...) — مستقل از خودِ نیروها.
    // wageMethods: روش‌های محاسبه (فرمول‌ها) — قابل استفادهٔ مشترک بین چند شغل.
    // wageAssignments: پیوند واقعی هر نیرو به یک روش محاسبه + مقادیر آن نیرو.
    // wageCalculations: سابقهٔ محاسبات واقعی انجام‌شده (برای شفافیت/گزارش).
    this.version(10).stores({
      jobTypes: "id, category, isBuiltIn, createdAt",
      wageMethods: "id, isBuiltIn, createdAt",
      wageAssignments: "id, workerId, wageMethodId, isActive, createdAt",
      wageCalculations: "id, workerId, wageAssignmentId, date, createdAt",
    });

    // نسخه ۱۱: رمزنگاری فایل‌های پشتیبان. جدول deviceSecrets کلید دستگاهی
    // AES را نگه می‌دارد — این جدول عمداً در backupService.ts خارج از
    // buildBackupPayload/restoreFromPayload نگه داشته شده (به دلایل امنیتی
    // در کامنت بالای DeviceSecretRow توضیح داده شده است).
    this.version(11).stores({
      deviceSecrets: "id",
    });

    // نسخه ۱۲: افزودن کد شناسایی کوتاه («M-0001») به هر قلم لوازم/مصالح —
    // برای نمایش روی کارت، چسباندن برچسب فیزیکی، و جستجوی سریع (جدا از id
    // که یک UUID داخلی غیرقابل‌خواندن است). رکوردهای قدیمی این فیلد را
    // ندارند؛ این ارتقا به هرکدام، به ترتیب تاریخ ثبت، یک کد یکتای جدید
    // اختصاص می‌دهد تا هیچ قلمی بدون شناسه نماند.
    this.version(12)
      .stores({
        equipment: "id, code, name, createdAt",
      })
      .upgrade(async (tx) => {
        const countBeforeModify = await tx.table("equipment").count();

        const items = await tx.table("equipment").orderBy("createdAt").toArray();
        let seq = 1;
        for (const item of items) {
          if (item.code) continue;
          await tx.table("equipment").update(item.id, { code: `M-${String(seq).padStart(4, "0")}` });
          seq += 1;
        }

        const countAfterModify = await tx.table("equipment").count();
        if (countAfterModify !== countBeforeModify) {
          throw new Error(
            `Migration نسخهٔ ۱۲ ناقص است: تعداد اقلام لوازم قبل (${countBeforeModify}) ` +
              `با بعد (${countAfterModify}) برابر نیست. برای جلوگیری از از دست رفتن داده، این ارتقا متوقف شد.`
          );
        }

        const itemsWithoutCode = await tx.table("equipment").toCollection().filter((e: Equipment) => !e.code).count();
        if (itemsWithoutCode > 0) {
          throw new Error(`Migration نسخهٔ ۱۲ ناقص است: ${itemsWithoutCode} قلم لوازم هنوز کد معتبر ندارند.`);
        }
      });

    // نسخه ۱۳: افزودن فیلد endDate به فعالیت‌های آینده — برای پشتیبانی از
    // فعالیت‌های چندروزه در نمای گانت (مثل MS Project). چون این فیلد نیازی
    // به ایندکس ندارد (فیلتر بازهٔ تاریخ در حافظه/JS انجام می‌شود، نه با
    // کوئری Dexie روی endDate)، schema جدول futureActivities نسبت به نسخهٔ ۴
    // بدون تغییر می‌ماند؛ رکوردهای قدیمی این فیلد را ندارند و
    // futureActivityService با هر خواندن، نبودِ آن را معادل «تک‌روزه» (null) در نظر می‌گیرد.
    this.version(13).stores({});

    // نسخه ۱۴: قابلیت «دفترچه دیجیتال طبقه». هشت جدول کاملاً جدید اضافه
    // می‌شوند (بدون هیچ رابطه‌ای با جدول‌های موجود در سطح schema — فقط از
    // طریق فیلدهای id در سطح داده به Worker/Cashbook/Photo مرتبط می‌شوند)،
    // پس نیازی به .upgrade()/انتقال داده نیست: جدول‌های جدید همیشه خالی
    // شروع می‌شوند و هیچ رکورد موجودی تغییر نمی‌کند.
    //
    // علاوه بر آن، دو جدول موجود (cashbookEntries، photos) ایندکس جدید
    // می‌گیرند: cashbookEntries.floorId (برای واکشی سریع «هزینه‌های این
    // طبقه») و از قبل photos.relatedType/relatedId برای relatedType='floor'
    // کافی است (نیازی به ستون/ایندکس جدید روی photos نیست). رکوردهای قدیمی
    // این دو جدول مقدار floorId را نخواهند داشت که کاملاً بی‌خطر است — چون
    // همیشه با فیلتر صریح floorId خوانده می‌شوند، نه پیش‌فرض.
    this.version(14).stores({
      floors: "id, status, createdAt",
      floorStages: "id, floorId, key, order, status, createdAt",
      floorTasks: "id, floorId, stageId, status, priority, workerId, dueDate, createdAt",
      floorPlans: "id, floorId, stageId, category, status, parentPlanId, createdAt",
      floorIssues: "id, floorId, stageId, taskId, status, severity, dueDate, createdAt",
      floorWorkers: "id, floorId, workerId, stageId, createdAt",
      floorChecklistItems: "id, floorId, status, createdAt",
      floorActivityEvents: "id, floorId, stageId, createdAt",
      cashbookEntries: "id, type, date, workerId, fundId, floorId, createdAt",
    });

    // نسخه ۱۵: قدم اول «چند-پروژه‌ای» (مورد ۱ گزارش بررسی پروژه) — فقط
    // زیرساخت، صرفاً افزودنی (additive) و بدون تغییر در جدول‌های موجود:
    //  ۱) جدول جدید «projects» اضافه می‌شود (خالی شروع می‌شود، هیچ رابطه‌ای
    //     در سطح schema با جدول‌های قبلی ندارد).
    //  ۲) از اطلاعات پروژهٔ موجود در تنظیمات (که از قبل هم فقط برای یک
    //     پروژه بود: projectName/supervisorName/projectLocation) یک
    //     «پروژهٔ پیش‌فرض» ساخته می‌شود تا کاربرانی که از قبل برنامه را
    //     نصب کرده‌اند بدون هیچ داده‌ای از دست‌رفته وارد دنیای چند-پروژه‌ای
    //     شوند، و activeProjectId تنظیمات به همین پروژه اشاره می‌کند.
    //  ۳) داده‌های خودِ طبقات/نیروها/دفتر حساب و غیره در این نسخه هنوز
    //     projectId ندارند — عمداً، چون افزودن آن به همهٔ ~۱۵ جدول و
    //     بازنویسی هر سرویس/صفحه‌ای که از آن‌ها می‌خواند، بدون امکان تست
    //     تعاملی واقعی روی دستگاه، ریسک قاطی‌شدن/از‌دست‌رفتن دادهٔ واقعی
    //     کاربر دارد. این کار در نسخه‌های بعدی، پس از تست کامل، انجام می‌شود.
    this.version(15)
      .stores({
        projects: "id, createdAt",
      })
      .upgrade(async (tx) => {
        const projectsCountBefore = await tx.table("projects").count();
        if (projectsCountBefore > 0) return; // ارتقای تکراری؛ کاری لازم نیست.

        const existingSettings = await tx.table("settings").get(SETTINGS_ROW_ID);
        const now = new Date().toISOString();
        const defaultProjectId = randomUUID();

        await tx.table("projects").add({
          id: defaultProjectId,
          name: existingSettings?.projectName?.trim() || "پروژهٔ من",
          location: existingSettings?.projectLocation ?? "",
          supervisorName: existingSettings?.supervisorName ?? "",
          createdAt: existingSettings?.updatedAt ?? now,
          updatedAt: now,
        });

        if (existingSettings) {
          await tx.table("settings").update(SETTINGS_ROW_ID, { activeProjectId: defaultProjectId });
        }

        const projectsCountAfter = await tx.table("projects").count();
        if (projectsCountAfter !== 1) {
          throw new Error(
            `Migration نسخهٔ ۱۵ ناقص است: انتظار می‌رفت دقیقاً ۱ پروژهٔ پیش‌فرض ساخته شود، ولی ${projectsCountAfter} پروژه موجود است.`
          );
        }
      });

    // نسخه ۱۶: قدم دوم چند-پروژه‌ای — اولین جدول واقعی (floors) پروژه‌محور
    // می‌شود. چون این تغییر روی دادهٔ واقعی طبقات موجود اثر می‌گذارد، طبق
    // همان انضباطی که در نسخهٔ ۱۲ (کد قطعات) رعایت شده: تعداد رکوردها قبل و
    // بعد باید دقیقاً برابر بماند، و هیچ طبقه‌ای نباید بدون projectId معتبر
    // باقی بماند؛ در غیر این صورت ارتقا متوقف می‌شود تا داده‌ای بی‌صدا ناقص نماند.
    this.version(16)
      .stores({
        floors: "id, projectId, status, createdAt",
      })
      .upgrade(async (tx) => {
        const countBeforeModify = await tx.table("floors").count();
        if (countBeforeModify === 0) return; // هیچ طبقه‌ای وجود ندارد؛ کاری لازم نیست.

        const projects = await tx.table("projects").toArray();
        const settings = await tx.table("settings").get(SETTINGS_ROW_ID);
        const targetProjectId =
          (settings?.activeProjectId && projects.some((p) => p.id === settings.activeProjectId)
            ? settings.activeProjectId
            : projects[0]?.id) ?? null;

        if (!targetProjectId) {
          throw new Error(
            "Migration نسخهٔ ۱۶ ناقص است: طبقه موجود است ولی هیچ پروژه‌ای برای اختصاص آن پیدا نشد."
          );
        }

        const floors = await tx.table("floors").toArray();
        for (const floor of floors) {
          if (!floor.projectId) {
            await tx.table("floors").update(floor.id, { projectId: targetProjectId });
          }
        }

        const countAfterModify = await tx.table("floors").count();
        if (countAfterModify !== countBeforeModify) {
          throw new Error(
            `Migration نسخهٔ ۱۶ ناقص است: تعداد طبقات قبل (${countBeforeModify}) با بعد (${countAfterModify}) برابر نیست.`
          );
        }
        const floorsWithoutProject = await tx
          .table("floors")
          .toCollection()
          .filter((f: Floor) => !f.projectId)
          .count();
        if (floorsWithoutProject > 0) {
          throw new Error(`Migration نسخهٔ ۱۶ ناقص است: ${floorsWithoutProject} طبقه هنوز projectId معتبر ندارند.`);
        }
      });

    // نسخه ۱۷: قدم سوم چند-پروژه‌ای — نیروها (Workers)، طبق تصمیم صریح
    // کاربر: «ترکیبی از دو حالت». یعنی برخلاف floors (که مستقیماً projectId
    // می‌گیرند)، خودِ جدول workers دست‌نخورده و سراسری می‌ماند (چون هر
    // Worker یک شخص واقعی است و نباید به‌ازای هر پروژه تکرار شود)؛ فقط یک
    // جدول رابط جدید (projectWorkers) اضافه می‌شود که «کدام نیرو در کدام
    // پروژه(ها) فعال است» را نگه می‌دارد — یک نیرو می‌تواند هم‌زمان در چند
    // پروژه باشد. برای نصب‌های قدیمی، همهٔ نیروهای موجود به پروژهٔ پیش‌فرض
    // متصل می‌شوند (چون تا امروز همه در همان یک پروژه فرضی بودند).
    this.version(17)
      .stores({
        projectWorkers: "id, projectId, workerId, [projectId+workerId]",
      })
      .upgrade(async (tx) => {
        const workers = await tx.table("workers").toArray();
        if (workers.length === 0) return;

        const projects = await tx.table("projects").toArray();
        const settings = await tx.table("settings").get(SETTINGS_ROW_ID);
        const targetProjectId =
          (settings?.activeProjectId && projects.some((p) => p.id === settings.activeProjectId)
            ? settings.activeProjectId
            : projects[0]?.id) ?? null;

        if (!targetProjectId) {
          throw new Error(
            "Migration نسخهٔ ۱۷ ناقص است: نیرو موجود است ولی هیچ پروژه‌ای برای اختصاص آن پیدا نشد."
          );
        }

        const now = new Date().toISOString();
        for (const worker of workers) {
          await tx.table("projectWorkers").add({
            id: randomUUID(),
            projectId: targetProjectId,
            workerId: worker.id,
            createdAt: now,
          });
        }

        const linkCount = await tx.table("projectWorkers").count();
        if (linkCount !== workers.length) {
          throw new Error(
            `Migration نسخهٔ ۱۷ ناقص است: انتظار می‌رفت ${workers.length} ارتباط نیرو↔پروژه ساخته شود، ولی ${linkCount} ساخته شد.`
          );
        }
      });

    // نسخه ۱۸: قدم چهارم چند-پروژه‌ای — صندوق‌ها (cashboxFunds) مستقیماً
    // projectId می‌گیرند (مثل floors، چون یک صندوق مالی منطقاً متعلق به
    // یک پروژهٔ مشخص است، نه چیزی که بین چند پروژه مشترک باشد). تراکنش‌های
    // دفتر حساب (cashbookEntries) نیازی به projectId مستقیم ندارند — چون
    // هر تراکنش همیشه از طریق fundId به یک صندوق و از آنجا به یک پروژه
    // می‌رسد؛ افزودن projectId تکراری به آن‌ها فقط ریسک ناسازگاری
    // (دو منبع حقیقت برای یک چیز) اضافه می‌کرد بدون فایدهٔ واقعی.
    this.version(18)
      .stores({
        cashboxFunds: "id, projectId, isDefault, createdAt",
      })
      .upgrade(async (tx) => {
        const countBeforeModify = await tx.table("cashboxFunds").count();
        if (countBeforeModify === 0) return;

        const projects = await tx.table("projects").toArray();
        const settings = await tx.table("settings").get(SETTINGS_ROW_ID);
        const targetProjectId =
          (settings?.activeProjectId && projects.some((p) => p.id === settings.activeProjectId)
            ? settings.activeProjectId
            : projects[0]?.id) ?? null;

        if (!targetProjectId) {
          throw new Error(
            "Migration نسخهٔ ۱۸ ناقص است: صندوق موجود است ولی هیچ پروژه‌ای برای اختصاص آن پیدا نشد."
          );
        }

        const funds = await tx.table("cashboxFunds").toArray();
        for (const fund of funds) {
          if (!fund.projectId) {
            await tx.table("cashboxFunds").update(fund.id, { projectId: targetProjectId });
          }
        }

        const countAfterModify = await tx.table("cashboxFunds").count();
        if (countAfterModify !== countBeforeModify) {
          throw new Error(
            `Migration نسخهٔ ۱۸ ناقص است: تعداد صندوق‌ها قبل (${countBeforeModify}) با بعد (${countAfterModify}) برابر نیست.`
          );
        }
        const fundsWithoutProject = await tx
          .table("cashboxFunds")
          .toCollection()
          .filter((f: CashboxFund) => !f.projectId)
          .count();
        if (fundsWithoutProject > 0) {
          throw new Error(`Migration نسخهٔ ۱۸ ناقص است: ${fundsWithoutProject} صندوق هنوز projectId معتبر ندارند.`);
        }
      });

    // نسخه ۱۹: قدم پنجم چند-پروژه‌ای — رکوردهای حضور و غیاب (attendances)
    // مستقیماً projectId می‌گیرند. برخلاف Worker (که سراسری/مشترک ماند)،
    // اینجا هر رکورد حضور دقیقاً برای «حضور یک نیرو در یک روز مشخص، در
    // یک پروژهٔ مشخص» است — چون طبق تصمیم کاربر یک نیرو می‌تواند هم‌زمان
    // در چند پروژه فعال باشد، فقط از روی workerId نمی‌شود فهمید آن روز در
    // کدام پروژه حاضر بوده؛ پس این Entity، مثل Floor، باید projectId
    // مستقیم داشته باشد، نه استنتاج‌شده از رابطه‌ای دیگر.
    this.version(19)
      .stores({
        attendances: "id, projectId, workerId, date, [workerId+date], [projectId+workerId+date]",
      })
      .upgrade(async (tx) => {
        const countBeforeModify = await tx.table("attendances").count();
        if (countBeforeModify === 0) return;

        const projects = await tx.table("projects").toArray();
        const settings = await tx.table("settings").get(SETTINGS_ROW_ID);
        const targetProjectId =
          (settings?.activeProjectId && projects.some((p) => p.id === settings.activeProjectId)
            ? settings.activeProjectId
            : projects[0]?.id) ?? null;

        if (!targetProjectId) {
          throw new Error(
            "Migration نسخهٔ ۱۹ ناقص است: رکورد حضور موجود است ولی هیچ پروژه‌ای برای اختصاص آن پیدا نشد."
          );
        }

        const records = await tx.table("attendances").toArray();
        for (const record of records) {
          if (!record.projectId) {
            await tx.table("attendances").update(record.id, { projectId: targetProjectId });
          }
        }

        const countAfterModify = await tx.table("attendances").count();
        if (countAfterModify !== countBeforeModify) {
          throw new Error(
            `Migration نسخهٔ ۱۹ ناقص است: تعداد رکوردهای حضور قبل (${countBeforeModify}) با بعد (${countAfterModify}) برابر نیست.`
          );
        }
        const withoutProject = await tx
          .table("attendances")
          .toCollection()
          .filter((a: Attendance) => !a.projectId)
          .count();
        if (withoutProject > 0) {
          throw new Error(`Migration نسخهٔ ۱۹ ناقص است: ${withoutProject} رکورد حضور هنوز projectId معتبر ندارند.`);
        }
      });

    // نسخه ۲۰: قدم ششم چند-پروژه‌ای — پنج جدول باقیمانده که هرکدام مثل
    // Floor/CashboxFund مستقیماً به یک پروژه تعلق دارند (equipment،
    // futureActivities) یا مثل Attendance به‌خاطر امکان فعالیت هم‌زمان یک
    // نیرو در چند پروژه باید projectId مستقل داشته باشند (guardShifts،
    // optionalLeaves، ledgerEntries). هر پنج جدول در یک نسخه، با همان
    // انضباط شمارش قبل/بعد و throw-on-mismatch، تا از تکثیر بی‌پایان
    // نسخه‌های تک‌جدولی مشابه پرهیز شود.
    const V20_TABLES = ["equipment", "futureActivities", "guardShifts", "optionalLeaves", "ledgerEntries"] as const;
    this.version(20)
      .stores({
        equipment: "id, projectId, code, createdAt",
        futureActivities: "id, projectId, seriesId, date, workerId",
        guardShifts: "id, projectId, workerId, date",
        optionalLeaves: "id, projectId, workerId, date",
        ledgerEntries: "id, projectId, workerId, date, type",
      })
      .upgrade(async (tx) => {
        const projects = await tx.table("projects").toArray();
        const settings = await tx.table("settings").get(SETTINGS_ROW_ID);
        const targetProjectId =
          (settings?.activeProjectId && projects.some((p) => p.id === settings.activeProjectId)
            ? settings.activeProjectId
            : projects[0]?.id) ?? null;

        for (const tableName of V20_TABLES) {
          const countBefore = await tx.table(tableName).count();
          if (countBefore === 0) continue;

          if (!targetProjectId) {
            throw new Error(
              `Migration نسخهٔ ۲۰ ناقص است: رکورد در جدول «${tableName}» موجود است ولی هیچ پروژه‌ای برای اختصاص آن پیدا نشد.`
            );
          }

          const rows = await tx.table(tableName).toArray();
          for (const row of rows) {
            if (!row.projectId) {
              await tx.table(tableName).update(row.id, { projectId: targetProjectId });
            }
          }

          const countAfter = await tx.table(tableName).count();
          if (countAfter !== countBefore) {
            throw new Error(
              `Migration نسخهٔ ۲۰ ناقص است: تعداد رکوردهای «${tableName}» قبل (${countBefore}) با بعد (${countAfter}) برابر نیست.`
            );
          }
          const withoutProjectCount = await tx
            .table(tableName)
            .toCollection()
            .filter((r: { projectId?: string }) => !r.projectId)
            .count();
          if (withoutProjectCount > 0) {
            throw new Error(
              `Migration نسخهٔ ۲۰ ناقص است: ${withoutProjectCount} رکورد در «${tableName}» هنوز projectId معتبر ندارند.`
            );
          }
        }
      });

    // نسخه ۲۱: قدم هفتم (و فعلاً آخرین قدمِ خودکار) چند-پروژه‌ای —
    // عکس‌ها (photos) مثل بقیهٔ جدول‌های این نسخه فقط projectId می‌گیرند؛
    // اما dailyReportNotes و workLogNotes فرق دارند: id این دو جدول تا امروز
    // مستقیماً همان تاریخ (YYYY-MM-DD) بود (یعنی «هر تاریخ فقط یک یادداشت»).
    // در دنیای چند-پروژه‌ای این فرض غلط می‌شود (هر پروژه باید یادداشت
    // مستقل خودش را برای همان تاریخ داشته باشد)، پس id این دو جدول به
    // «projectId:date» تغییر می‌کند — یعنی رکوردهای موجود باید حذف و با id
    // جدید دوباره اضافه شوند (نه فقط update، چون کلید اصلی عوض می‌شود).
    this.version(21)
      .stores({
        photos: "id, projectId, relatedType, relatedId, date, createdAt",
        dailyReportNotes: "id, projectId, date",
        workLogNotes: "id, projectId, date",
      })
      .upgrade(async (tx) => {
        const projects = await tx.table("projects").toArray();
        const settings = await tx.table("settings").get(SETTINGS_ROW_ID);
        const targetProjectId =
          (settings?.activeProjectId && projects.some((p) => p.id === settings.activeProjectId)
            ? settings.activeProjectId
            : projects[0]?.id) ?? null;

        // --- عکس‌ها: فقط افزودن projectId، id دست‌نخورده می‌ماند ---
        const photosCountBefore = await tx.table("photos").count();
        if (photosCountBefore > 0) {
          if (!targetProjectId) {
            throw new Error("Migration نسخهٔ ۲۱ ناقص است: عکس موجود است ولی هیچ پروژه‌ای پیدا نشد.");
          }
          const photos = await tx.table("photos").toArray();
          for (const photo of photos) {
            if (!photo.projectId) {
              await tx.table("photos").update(photo.id, { projectId: targetProjectId });
            }
          }
          const photosCountAfter = await tx.table("photos").count();
          if (photosCountAfter !== photosCountBefore) {
            throw new Error(
              `Migration نسخهٔ ۲۱ ناقص است: تعداد عکس‌ها قبل (${photosCountBefore}) با بعد (${photosCountAfter}) برابر نیست.`
            );
          }
        }

        // --- یادداشت‌های تاریخ‌محور: بازسازی کامل با id جدید ---
        for (const tableName of ["dailyReportNotes", "workLogNotes"] as const) {
          const rows = await tx.table(tableName).toArray();
          if (rows.length === 0) continue;
          if (!targetProjectId) {
            throw new Error(`Migration نسخهٔ ۲۱ ناقص است: رکورد در «${tableName}» موجود است ولی هیچ پروژه‌ای پیدا نشد.`);
          }
          const countBefore = rows.length;
          await tx.table(tableName).clear();
          await tx.table(tableName).bulkAdd(
            rows.map((row: { date: string; [key: string]: unknown }) => ({
              ...row,
              id: `${targetProjectId}:${row.date}`,
              projectId: targetProjectId,
            }))
          );
          const countAfter = await tx.table(tableName).count();
          if (countAfter !== countBefore) {
            throw new Error(
              `Migration نسخهٔ ۲۱ ناقص است: تعداد رکوردهای «${tableName}» قبل (${countBefore}) با بعد (${countAfter}) برابر نیست.`
            );
          }
        }
      });
    // نسخه ۲۲: اتصال گزارش‌ها/فعالیت‌ها/عکس‌ها به دفترچه طبقه بدون ایجاد Feature موازی.
    // فیلدهای floorId/stageId/taskId/phase به داده‌های موجود افزوده می‌شوند و
    // ایندکس‌های لازم فقط برای واکشی مستقیم دفترچه اضافه می‌شوند. رکوردهای قدیمی
    // بدون این فیلدها کاملاً معتبر و قابل استفاده باقی می‌مانند.
    this.version(22).stores({
      photos: "id, projectId, relatedType, relatedId, floorId, stageId, taskId, date, createdAt",
      futureActivities: "id, projectId, seriesId, date, workerId, floorId, stageId, taskId",
      workLogNotes: "id, projectId, floorId, stageId, date",
    });

    // نسخه ۲۳: رفع باگ واقعی — ایندکس ترکیبی [workerId+date] جدول guardShifts
    // که از نسخهٔ ۵ وجود داشت، در نسخهٔ ۲۰ (هنگام افزودن projectId به همین
    // جدول) به‌اشتباه از stores() جا افتاد. در Dexie هر versionٔ که یک جدول
    // را دوباره تعریف می‌کند باید کل فهرست ایندکس‌های آن را کامل بنویسد، وگرنه
    // ایندکس‌های نیامده حذف می‌شوند — دقیقاً همان اتفاقی که افتاد. نتیجه: در
    // هر دیتابیسی که از نسخهٔ ۲۰ به بعد ارتقا گرفته، guardShiftService.findByWorkerAndDate
    // (که db.guardShifts.where("[workerId+date]") را صدا می‌زند و در گزارش
    // روزانه/dashboard استفاده می‌شود) با خطای زمان اجرای
    // «KeyPath [workerId+date] on object store guardShifts is not indexed»
    // شکست می‌خورد. چون فقط یک ایندکس اضافه می‌شود (نه تغییر ساختار داده)،
    // نیازی به تابع upgrade نیست — Dexie خودش ایندکس ترکیبی را از روی
    // فیلدهای workerId/date موجود در رکوردهای فعلی می‌سازد.
    this.version(23).stores({
      guardShifts: "id, projectId, workerId, date, [workerId+date]",
    });

    // نسخه ۲۴: افزودن «اکیپ» و «پرداخت جمعی» — قابلیت پرداخت دستمزد به‌صورت
    // یک مبلغ کلی به یک گروه از نیروها (مثلاً اکیپ گچ‌کار) به‌جای محاسبهٔ
    // جداگانه برای هر عضو. تقسیم آن مبلغ بین اعضا به عهدهٔ خودشان است و در
    // این جدول‌ها ثبت نمی‌شود؛ فقط «کل مبلغ، برای کدام اکیپ، بابت کدام کار»
    // نگه داشته می‌شود. هر دو جدول کاملاً جدید هستند، پس نیازی به upgrade
    // برای داده‌های موجود نیست.
    this.version(24).stores({
      workerGroups: "id, projectId, name, isActive, createdAt",
      groupWagePayments: "id, projectId, groupId, date, createdAt",
    });

    // نسخه ۲۵: یادداشت صوتی — امکان ضبط صدا به‌جای تایپ برای ثبت مشکل طبقه یا
    // گزارش کار روزانه. جدول کاملاً جدید است، پس نیازی به upgrade نیست.
    this.version(25).stores({
      voiceNotes: "id, projectId, relatedType, relatedId, floorId, date, createdAt",
    });

    // نسخه ۲۶: افزودن نوع واحد طبقه (تک‌واحدی/چندواحدی) — فیلد جدید ایندکس
    // نمی‌شود، پس نیازی به تغییر schema نیست؛ فقط رکوردهای قدیمی باید مقدار
    // پیش‌فرض «تک‌واحدی» بگیرند تا نوع Floor (که unitType را الزامی تعریف
    // کرده) با داده‌های واقعی داخل IndexedDB همیشه هم‌خوان بماند.
    this.version(26)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("floors")
          .toCollection()
          .modify((floor) => {
            if (floor.unitType === undefined) floor.unitType = "single";
            if (floor.unitCount === undefined) floor.unitCount = null;
          });
      });
  }
}


export const LEGACY_DB_NAME = "karegah-yar-db";
export const legacyDb = new LegacyKaregahYarDatabase();
