import type { Worker } from "../entities/Worker";
import type { Attendance } from "../entities/Attendance";
import type { BreakTime } from "../entities/BreakTime";
import type { TimeLoss } from "../entities/TimeLoss";
import type { Equipment, EquipmentAssignment } from "../entities/Equipment";
import type { WorkerLedgerEntry } from "../entities/Ledger";
import type { CashbookEntry } from "../entities/Cashbook";
import type { CashboxFund } from "../entities/CashboxFund";
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
import { Capacitor } from "@capacitor/core";
import { BUILTIN_WAGE_METHODS } from "./seedWageMethods";
import { SEED_JOB_TYPES } from "./seedJobTypes";
import { randomUUID } from "./utils/uuid";
import { generateDeviceKeyBase64 } from "./services/backupCrypto";
import { NativeDatabase, NativeTable } from "./storage/nativeStore";
import { migrateLegacyIndexedDbIfNeeded } from "./storage/migrateFromIndexedDb";
import { readDeviceKeyFile } from "./storage/deviceKeyFile";
import { SqliteRowBackend } from "./storage/sqliteBackend";
import { FileBlobBackend } from "./storage/fileBlobBackend";
import { IdbRowBackend, IdbBlobBackend } from "./storage/idbFallbackBackend";
import { MemoryRowBackend, MemoryBlobBackend } from "./storage/memoryBackend";
import type { BlobBackend, RowBackend, TableDef } from "./storage/types";
import {
  DEVICE_SECRET_ROW_ID,
  type DeviceSecretRow,
  type PhotoRow,
  type PhotoWithBlob,
  type SettingsRow,
  type VoiceNoteRow,
  type VoiceNoteWithBlob,
} from "./dbTypes";

export { DEVICE_SECRET_ROW_ID };
export type { DeviceSecretRow, PhotoRow, PhotoWithBlob, SettingsRow, VoiceNoteRow, VoiceNoteWithBlob };

/** معادل Dexie.Table برای بقیهٔ برنامه (فقط برای تایپ). */
export type Table<TR, _K = string, TW = TR> = NativeTable<TR & object, TW & object>;

/**
 * دیتابیس محلی برنامه.
 *
 * ⚠️ تغییر معماری: دیگر IndexedDB/Dexie نیست.
 *   • اندروید (Capacitor): رکوردها در SQLite نیتیو، عکس/صوت به‌صورت فایل در حافظهٔ خصوصی اپ.
 *   • مرورگر (dev/PWA): IndexedDB خام فقط به‌عنوان fallback.
 *   • Node (تست‌ها): حافظه.
 * API سرویس‌ها (get/put/where/transaction ...) بدون تغییر ماند.
 * نصب‌های قدیمی در اولین اجرا خودکار از IndexedDB قدیمی منتقل می‌شوند
 * (storage/migrateFromIndexedDb.ts؛ schema قدیمی در legacyDb.ts).
 */

const TABLE_DEFS: TableDef[] = [
  { name: "workers" },
  { name: "attendances" },
  { name: "breakTimes" },
  { name: "timeLosses" },
  { name: "equipment" },
  { name: "equipmentAssignments" },
  { name: "ledgerEntries" },
  { name: "cashbookEntries" },
  {
    name: "photos",
    blobFields: [
      { field: "blob", urlField: "blobUrl" },
      { field: "displayBlob", urlField: "displayBlobUrl" },
      // پیش‌نمایش کم‌حجم (≈۳۲۰px) برای لیست/گرید؛ نسخهٔ مشتق‌شده است و در بکاپ نمی‌رود.
      { field: "thumbBlob", urlField: "thumbBlobUrl" },
    ],
  },
  { name: "settings" },
  { name: "pictureCards" },
  { name: "futureActivities" },
  { name: "guardShifts" },
  { name: "dailyReportNotes" },
  { name: "workLogNotes" },
  { name: "cashboxFunds" },
  { name: "optionalLeaves" },
  { name: "jobTypes" },
  { name: "wageMethods" },
  { name: "wageAssignments" },
  { name: "wageCalculations", lazy: true },
  { name: "deviceSecrets" },
  { name: "floors" },
  { name: "floorStages" },
  { name: "floorTasks" },
  { name: "floorPlans" },
  { name: "floorIssues" },
  { name: "floorWorkers" },
  { name: "floorChecklistItems" },
  { name: "floorActivityEvents", lazy: true },
  { name: "projects" },
  { name: "projectWorkers" },
  { name: "workerGroups" },
  { name: "groupWagePayments" },
  { name: "voiceNotes", blobFields: [{ field: "blob", urlField: "blobUrl" }] },
];

function createBackends(): { rows: RowBackend; blobs: BlobBackend } {
  if (Capacitor.isNativePlatform()) return { rows: new SqliteRowBackend(), blobs: new FileBlobBackend() };
  if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
    return { rows: new IdbRowBackend(), blobs: new IdbBlobBackend() };
  }
  return { rows: new MemoryRowBackend(), blobs: new MemoryBlobBackend() };
}

class KaregahYarDatabase extends NativeDatabase {
  declare workers: NativeTable<Worker>;
  declare attendances: NativeTable<Attendance>;
  declare breakTimes: NativeTable<BreakTime>;
  declare timeLosses: NativeTable<TimeLoss>;
  declare equipment: NativeTable<Equipment>;
  declare equipmentAssignments: NativeTable<EquipmentAssignment>;
  declare ledgerEntries: NativeTable<WorkerLedgerEntry>;
  declare cashbookEntries: NativeTable<CashbookEntry>;
  declare photos: NativeTable<PhotoRow, PhotoWithBlob>;
  declare settings: NativeTable<SettingsRow>;
  declare pictureCards: NativeTable<PictureCard>;
  declare futureActivities: NativeTable<FutureActivity>;
  declare guardShifts: NativeTable<GuardShift>;
  declare dailyReportNotes: NativeTable<DailyReportNote>;
  declare workLogNotes: NativeTable<WorkLogNote>;
  declare cashboxFunds: NativeTable<CashboxFund>;
  declare optionalLeaves: NativeTable<OptionalLeave>;
  declare jobTypes: NativeTable<JobType>;
  declare wageMethods: NativeTable<WageMethod>;
  declare wageAssignments: NativeTable<WageAssignment>;
  declare wageCalculations: NativeTable<WageCalculationRecord>;
  declare deviceSecrets: NativeTable<DeviceSecretRow>;
  declare floors: NativeTable<Floor>;
  declare floorStages: NativeTable<FloorStage>;
  declare floorTasks: NativeTable<FloorTask>;
  declare floorPlans: NativeTable<FloorPlan>;
  declare floorIssues: NativeTable<FloorIssue>;
  declare floorWorkers: NativeTable<FloorWorker>;
  declare floorChecklistItems: NativeTable<FloorChecklistItem>;
  declare floorActivityEvents: NativeTable<FloorActivityEvent>;
  declare projects: NativeTable<Project>;
  declare projectWorkers: NativeTable<ProjectWorker>;
  declare workerGroups: NativeTable<WorkerGroup>;
  declare groupWagePayments: NativeTable<GroupWagePayment>;
  declare voiceNotes: NativeTable<VoiceNoteRow, VoiceNoteWithBlob>;

  constructor() {
    const { rows, blobs } = createBackends();
    super("karegah-yar-native", TABLE_DEFS, rows, blobs);
    this.workers = this.createTable("workers");
    this.attendances = this.createTable("attendances");
    this.breakTimes = this.createTable("breakTimes");
    this.timeLosses = this.createTable("timeLosses");
    this.equipment = this.createTable("equipment");
    this.equipmentAssignments = this.createTable("equipmentAssignments");
    this.ledgerEntries = this.createTable("ledgerEntries");
    this.cashbookEntries = this.createTable("cashbookEntries");
    this.photos = this.createTable("photos");
    this.settings = this.createTable("settings");
    this.pictureCards = this.createTable("pictureCards");
    this.futureActivities = this.createTable("futureActivities");
    this.guardShifts = this.createTable("guardShifts");
    this.dailyReportNotes = this.createTable("dailyReportNotes");
    this.workLogNotes = this.createTable("workLogNotes");
    this.cashboxFunds = this.createTable("cashboxFunds");
    this.optionalLeaves = this.createTable("optionalLeaves");
    this.jobTypes = this.createTable("jobTypes");
    this.wageMethods = this.createTable("wageMethods");
    this.wageAssignments = this.createTable("wageAssignments");
    this.wageCalculations = this.createTable("wageCalculations");
    this.deviceSecrets = this.createTable("deviceSecrets");
    this.floors = this.createTable("floors");
    this.floorStages = this.createTable("floorStages");
    this.floorTasks = this.createTable("floorTasks");
    this.floorPlans = this.createTable("floorPlans");
    this.floorIssues = this.createTable("floorIssues");
    this.floorWorkers = this.createTable("floorWorkers");
    this.floorChecklistItems = this.createTable("floorChecklistItems");
    this.floorActivityEvents = this.createTable("floorActivityEvents");
    this.projects = this.createTable("projects");
    this.projectWorkers = this.createTable("projectWorkers");
    this.workerGroups = this.createTable("workerGroups");
    this.groupWagePayments = this.createTable("groupWagePayments");
    this.voiceNotes = this.createTable("voiceNotes");

    // مهاجرت یک‌باره از IndexedDB قدیمی (هر جا IndexedDB وجود دارد: اپ، مرورگر، و تست‌ها
    // با fake-indexeddb). اگر دیتابیس قدیمی نباشد، همان لحظه بی‌هزینه رد می‌شود.
    if (typeof indexedDB !== "undefined") {
      this.beforeFirstUse = async (self) => {
        await migrateLegacyIndexedDbIfNeeded(self, TABLE_DEFS.map((d) => d.name));
      };
    }
  }
}

export const db = new KaregahYarDatabase();


export const SETTINGS_ROW_ID = "app-settings";

/**
 * اطمینان از وجود رکورد تنظیمات پیش‌فرض در اولین اجرای برنامه.
 */
export async function ensureDatabaseSeeded(): Promise<void> {
  const existingSettings = await db.settings.get(SETTINGS_ROW_ID);
  if (!existingSettings) {
    await db.settings.put({
      id: SETTINGS_ROW_ID,
      standardWorkHoursPerDay: 8,
      updatedAt: new Date().toISOString(),
      autoBackupEnabled: true,
      autoBackupIntervalHours: 24,
      autoBackupMaxVersions: 5,
      activityNotificationsEnabled: true,
      projectName: "",
      supervisorName: "",
      projectLocation: "",
      quickCheckInDefaultTime: "08:00",
      quickCheckOutDefaultTime: "17:00",
      quickBreakfastDefaultStartTime: null,
      quickBreakfastDefaultEndTime: null,
      quickLunchDefaultStartTime: null,
      quickLunchDefaultEndTime: null,
      cloudBackupEnabled: false,
      cloudBackupSupabaseUrl: "",
      cloudBackupSupabaseAnonKey: "",
      cloudBackupDeviceId: randomUUID(),
      cloudBackupIntervalHours: 24,
      activeProjectId: "",
      attendanceTimeTemplates: [],
      lastAttendanceTemplateId: null,
    });
  }

  // برای نصب کاملاً تازه (نه ارتقا از نسخهٔ قدیمی)، callback بالا در
  // version(15).upgrade هرگز اجرا نمی‌شود چون از ابتدا همان schema نهایی
  // ساخته می‌شود؛ پس این‌جا هم باید مطمئن شویم حداقل یک پروژهٔ پیش‌فرض
  // وجود دارد و activeProjectId تنظیمات به آن اشاره می‌کند. این باید *قبل*
  // از seed صندوق پیش‌فرض اجرا شود، چون صندوق از نسخهٔ ۱۸ به بعد به یک
  // projectId معتبر نیاز دارد.
  let defaultProjectId: string;
  const existingProjects = await db.projects.toArray();
  if (existingProjects.length === 0) {
    const now = new Date().toISOString();
    defaultProjectId = randomUUID();
    await db.projects.add({
      id: defaultProjectId,
      name: "پروژهٔ من",
      location: "",
      supervisorName: "",
      createdAt: now,
      updatedAt: now,
    });
    await db.settings.update(SETTINGS_ROW_ID, { activeProjectId: defaultProjectId });
  } else {
    defaultProjectId =
      (await db.settings.get(SETTINGS_ROW_ID))?.activeProjectId || existingProjects[0].id;
  }

  // برای نصب کاملاً تازه (نه ارتقا از نسخهٔ قدیمی)، callback بالا در
  // version(8).upgrade هرگز اجرا نمی‌شود چون از ابتدا همان schema نهایی
  // ساخته می‌شود؛ پس این‌جا هم باید مطمئن شویم حداقل یک صندوق پیش‌فرض
  // وجود دارد.
  const fundsCount = await db.cashboxFunds.count();
  if (fundsCount === 0) {
    const now = new Date().toISOString();
    await db.cashboxFunds.add({
      id: randomUUID(),
      projectId: defaultProjectId,
      name: "صندوق اصلی",
      description: null,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ترمیم تراکنش‌های «یتیم» دفتر حساب — تراکنش‌هایی که fundId آن‌ها به هیچ
  // صندوق موجودی اشاره نمی‌کند (مثلاً به‌خاطر یک ناسازگاری در Migration
  // بین نسخه‌ها). صفحهٔ دفتر حساب همیشه بر اساس fundId فیلتر می‌کند، پس
  // چنین تراکنش‌هایی بدون این ترمیم برای همیشه از دید کاربر پنهان
  // می‌مانند — بدون هیچ خطا یا هشداری، دقیقاً به شکل «انگار داده حذف شده»
  // با این‌که در دیتابیس واقعی همچنان کامل موجود است. این دقیقاً همان
  // اصل «هیچ داده‌ای نباید بی‌صدا جا بیفتد» است که برای Backup هم رعایت
  // شده، این‌جا هم برای نمایش در UI اعمال می‌شود.
  const allFundIds = new Set((await db.cashboxFunds.toArray()).map((f) => f.id));
  const allEntries = await db.cashbookEntries.toArray();
  const orphanedEntries = allEntries.filter((e) => !e.fundId || !allFundIds.has(e.fundId));
  if (orphanedEntries.length > 0) {
    const defaultFund =
      (await db.cashboxFunds.toArray()).find((f) => f.isDefault) ?? (await db.cashboxFunds.toArray())[0];
    if (defaultFund) {
      const now = new Date().toISOString();
      await db.cashbookEntries.bulkPut(
        orphanedEntries.map((e) => ({ ...e, fundId: defaultFund.id, updatedAt: now }))
      );
    }
  }

  // Seed اولیهٔ روش‌های محاسبهٔ دستمزد پیش‌فرض — فقط اگر جدول کاملاً خالی
  // باشد (یعنی اولین اجرا پس از این نسخه). اگر کاربر قبلاً برخی از این
  // روش‌ها را حذف/ویرایش کرده، دوباره اضافه نمی‌شوند تا تغییرات او دست‌نخورده بماند.
  const wageMethodsCount = await db.wageMethods.count();
  if (wageMethodsCount === 0) {
    const now = new Date().toISOString();
    await db.wageMethods.bulkAdd(
      BUILTIN_WAGE_METHODS.map((m) => ({
        id: m.id,
        formula: m.formula,
        isBuiltIn: true,
        originalSnapshot: m.formula,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  // Seed اولیهٔ ۵۰ شغل ساختمانی پیش‌فرض — همان منطق: فقط یک‌بار، فقط اگر
  // جدول خالی باشد.
  const jobTypesCount = await db.jobTypes.count();
  if (jobTypesCount === 0) {
    const now = new Date().toISOString();
    await db.jobTypes.bulkAdd(
      SEED_JOB_TYPES.map((j) => ({
        id: randomUUID(),
        name: j.name,
        description: j.description,
        category: j.category,
        iconKey: j.iconKey,
        suggestedWageMethodIds: j.suggestedWageMethodIds ?? [],
        wageNote: j.wageNote ?? "",
        isBuiltIn: true,
        originalSnapshot: {
          name: j.name,
          description: j.description,
          category: j.category,
          iconKey: j.iconKey,
          suggestedWageMethodIds: j.suggestedWageMethodIds ?? [],
          wageNote: j.wageNote ?? "",
          createdAt: now,
          updatedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  // --- ترمیم رکوردهای بدون projectId (پس از بازیابی یک فایل پشتیبانِ
  // قدیمی‌تر از معماری چند-پروژه‌ای) ---
  //
  // چرا این ترمیم لازم است، با اینکه db.ts از قبل Migrationهای نسخهٔ
  // ۱۶ تا ۲۱ را برای همین‌کار (افزودن projectId به رکوردهای موجود) دارد؟
  // چون آن Migrationها فقط زمانی اجرا می‌شوند که خودِ IndexedDB از یک
  // نسخهٔ schema قدیمی‌تر به نسخهٔ جدیدتر «ارتقا» پیدا کند — این فقط
  // یک‌بار در طول عمر یک نصب اتفاق می‌افتد. اما restoreFromPayload یک
  // فایل پشتیبان را مستقیماً با bulkAdd در جدول‌های *همین نسخهٔ فعلی*
  // schema می‌نویسد؛ این مسیر هرگز از upgrade hooks عبور نمی‌کند. پس اگر
  // کاربر یک بک‌آپ قدیمی (از قبل از افزوده‌شدن projectId، یعنی رکوردهایش
  // اصلاً این فیلد را ندارند) را روی یک نصب جدید Restore کند، رکوردهای
  // طبقات/حضور/صندوق/... بدون projectId معتبر وارد می‌شوند — و چون همهٔ
  // فیلترهای برنامه بر اساس پروژهٔ فعال کار می‌کنند، این داده‌ها عملاً
  // «ناپدید»/خراب به‌نظر می‌رسند. این دقیقاً همان چیزی است که در فهرست
  // کارها به‌عنوان «خرابی بکاپ‌های نسخه‌های قبلی پس از هر آپدیت» گزارش
  // شده. راه‌حل: همان منطق backfill Migrationها را این‌جا هم (idempotent،
  // یعنی چیزی که از قبل projectId دارد دست‌نخورده می‌ماند) روی دیتابیس
  // فعلی تکرار می‌کنیم؛ این تابع هم بعد از هر Restore و هم در هر بار
  // راه‌اندازی عادی برنامه صدا زده می‌شود، پس چنین رکوردهایی — از هر مسیری
  // که وارد شده باشند — بی‌صدا برای همیشه گم نمی‌مانند.
  const backfillTargetProjectId = defaultProjectId;

  const SIMPLE_PROJECT_ID_TABLES = [
    "floors",
    "cashboxFunds",
    "attendances",
    "equipment",
    "futureActivities",
    "guardShifts",
    "optionalLeaves",
    "ledgerEntries",
    "photos",
  ] as const;
  for (const tableName of SIMPLE_PROJECT_ID_TABLES) {
    const table = db[tableName] as unknown as Table<{ id: string; projectId?: string | null }, string>;
    const rowsWithoutProject = await table.toCollection().filter((r) => !r.projectId).toArray();
    if (rowsWithoutProject.length > 0) {
      await table.bulkPut(rowsWithoutProject.map((r) => ({ ...r, projectId: backfillTargetProjectId })));
    }
  }

  // projectWorkers یک جدول رابطه است، نه یک فیلد روی رکورد موجود؛ برای هر
  // Worker که هیچ ارتباط projectWorker ندارد (چون بک‌آپ قدیمی اصلاً این
  // جدول را نداشت)، یک ارتباط جدید به پروژهٔ پیش‌فرض ساخته می‌شود.
  const allWorkers = await db.workers.toArray();
  const linkedWorkerIds = new Set((await db.projectWorkers.toArray()).map((pw) => pw.workerId));
  const unlinkedWorkers = allWorkers.filter((w) => !linkedWorkerIds.has(w.id));
  if (unlinkedWorkers.length > 0) {
    const now = new Date().toISOString();
    await db.projectWorkers.bulkAdd(
      unlinkedWorkers.map((w) => ({
        id: randomUUID(),
        projectId: backfillTargetProjectId,
        workerId: w.id,
        createdAt: now,
      }))
    );
  }

  // dailyReportNotes/workLogNotes: کلید اصلی این دو جدول از نسخهٔ ۲۱ به
  // بعد «projectId:date» است (نه فقط «date»)؛ رکوردهای آمده از یک بک‌آپ
  // قدیمی هنوز id قدیمی (فقط تاریخ، بدون projectId) دارند، پس صرفِ افزودن
  // فیلد projectId کافی نیست — باید با id جدید بازسازی شوند.
  for (const tableName of ["dailyReportNotes", "workLogNotes"] as const) {
    const table = db[tableName] as unknown as Table<{ id: string; projectId?: string | null; date: string }, string>;
    const rowsWithoutProject = await table.toCollection().filter((r) => !r.projectId).toArray();
    if (rowsWithoutProject.length > 0) {
      await table.bulkDelete(rowsWithoutProject.map((r) => r.id));
      await table.bulkAdd(
        rowsWithoutProject.map((r) => ({
          ...r,
          id: `${backfillTargetProjectId}:${r.date}`,
          projectId: backfillTargetProjectId,
        }))
      );
    }
  }

  // Seed کلید رمزنگاری دستگاهی — فقط یک‌بار در اولین اجرای برنامه تولید
  // می‌شود و دیگر هرگز تغییر نمی‌کند (وگرنه بکاپ‌های قبلی رمزنگاری‌شده با
  // کلید قدیمی دیگر قابل رمزگشایی نبودند).
  //
  // نکتهٔ مهم دربارهٔ ترتیب: این seed عمداً بعد از ترمیم رکوردهای بدون
  // projectId قرار دارد، نه قبلش — چون این بخش صرفاً یک کلید تولید می‌کند
  // و به هیچ‌کدام از جدول‌های بالا وابسته نیست، پس ترتیبش بی‌اثر است؛ اما
  // در اصلاح قبلی به‌اشتباه هنگام افزودن بخش ترمیم projectId حذف شده بود —
  // این خودش نمونه‌ای است از همان کلاس خطا (تغییر ناخواسته در حین ویرایش)
  // که باید با اجرای تست بعد از هر تغییر گرفته شود.
  const deviceSecretExists = await db.deviceSecrets.get(DEVICE_SECRET_ROW_ID);
  if (!deviceSecretExists) {
    // ⚠️ قبل از ساختن کلید تازه، نسخهٔ فایلی را بررسی کن. اگر دیتابیس خالی شده
    // ولی فایل کلید مانده (خطای مهاجرت، پاک شدن دادهٔ WebView)، کلید تازه همهٔ
    // بکاپ‌های خودکار موجود را برای همیشه غیرقابل‌رمزگشایی می‌کرد.
    const fileKey = await readDeviceKeyFile();
    if (fileKey) {
      await db.deviceSecrets.put({ id: DEVICE_SECRET_ROW_ID, ...fileKey });
    } else {
      await db.deviceSecrets.put({
        id: DEVICE_SECRET_ROW_ID,
        deviceKeyBase64: generateDeviceKeyBase64(),
        createdAt: new Date().toISOString(),
      });
    }
  }
}
