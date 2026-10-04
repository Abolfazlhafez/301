import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { projectService } from "./projectService";
import { projectWorkerService } from "./projectWorkerService";
import { NotFoundError, ValidationError, HasDependenciesError } from "../errors";
import { normalizeDigits } from "../../shared/utils/format";
import { isValidTimeFormat } from "../payroll";
import type { CreateWorkerInput, UpdateWorkerInput, Worker } from "../../entities/Worker";

const MAX_CARD_NUMBERS = 3;
const MAX_SHEBA_NUMBERS = 2;

/**
 * بررسی می‌کند آیا این نیرو در هر یک از جدول‌های وابسته (حضور، دفتر حساب
 * فردی، تخصیص لوازم، نوبت نگهبانی، دفتر حساب کلی) سابقه‌ای دارد یا نه.
 * هدف: جلوگیری از حذف کامل نیروهایی که تاریخچه مالی/عملیاتی دارند — چون
 * حذف کامل یعنی از دست رفتن گزارش‌های گذشته. برای این نیروها فقط
 * غیرفعال‌سازی (toggleActive) مجاز است، نه حذف.
 */
export async function workerHasDependencies(workerId: string): Promise<boolean> {
  const [attendanceCount, ledgerCount, assignmentCount, guardShiftCount, cashbookCount] = await Promise.all([
    db.attendances.where({ workerId }).count(),
    db.ledgerEntries.where({ workerId }).count(),
    db.equipmentAssignments.where({ workerId }).count(),
    db.guardShifts.where({ workerId }).count(),
    db.cashbookEntries.where({ workerId }).count(),
  ]);
  return attendanceCount + ledgerCount + assignmentCount + guardShiftCount + cashbookCount > 0;
}

/** پاک‌سازی و محدودسازی فهرست شماره کارت‌ها: فقط رقم، خالی‌ها حذف، حداکثر ۳ عدد. */
function sanitizeCardNumbers(list: string[] | undefined): string[] {
  if (!list) return [];
  return list
    .map((c) => normalizeDigits(c).replace(/[^\d]/g, ""))
    .filter(Boolean)
    .slice(0, MAX_CARD_NUMBERS);
}

/** پاک‌سازی و محدودسازی فهرست شماره‌های شبا: فقط رقم (بدون IR)، حداکثر ۲ عدد، طول معتبر (۲۴ رقم). */
function sanitizeShebaNumbers(list: string[] | undefined): string[] {
  if (!list) return [];
  return list
    .map((s) => normalizeDigits(s).replace(/[^\d]/gi, "").replace(/^IR/i, ""))
    .filter(Boolean)
    .slice(0, MAX_SHEBA_NUMBERS);
}

/**
 * نیروهای ثبت‌شده پیش از افزودن قابلیت نگهبانی، فاقد این فیلدها در پایگاه‌داده
 * هستند. برای جلوگیری از undefined غیرمنتظره در محاسبات، مقادیر پیش‌فرض امن
 * (غیرفعال) روی خروجی اعمال می‌شود؛ خود رکورد در دیتابیس دست‌نخورده می‌ماند.
 */
function withGuardDefaults(worker: Worker): Worker {
  // سازگاری با رکوردهای قدیمی: اگر cardNumbers ذخیره نشده ولی cardNumber قدیمی
  // وجود دارد، همان را به‌عنوان اولین شماره در نظر می‌گیریم.
  const cardNumbers =
    worker.cardNumbers && worker.cardNumbers.length > 0
      ? worker.cardNumbers
      : worker.cardNumber
        ? [worker.cardNumber]
        : [];
  return {
    ...worker,
    cardNumber: cardNumbers[0] ?? null,
    cardNumbers,
    shebaNumbers: worker.shebaNumbers ?? [],
    defaultCheckIn: worker.defaultCheckIn ?? null,
    defaultCheckOut: worker.defaultCheckOut ?? null,
    guardDutyEnabled: worker.guardDutyEnabled ?? false,
    guardDutyRateType: worker.guardDutyRateType ?? "hourly",
    guardDutyRate: worker.guardDutyRate ?? 0,
    guardDutyMergeWithRegularPay: worker.guardDutyMergeWithRegularPay ?? false,
    jobTypeId: worker.jobTypeId ?? null,
  };
}

export const workerService = {
  /**
   * فیلتر `projectId` (اختیاری، پیش‌فرض: بدون فیلتر) اولین گام واقعیِ
   * ایزوله‌سازی چندپروژه‌ای برای نیروهاست — که در نسخه‌های قبلی این
   * تابع اصلاً وجود نداشت (فقط جدول رابطهٔ ProjectWorker ساخته و پر
   * می‌شد، ولی خواندن هیچ‌وقت ازش استفاده نمی‌کرد؛ یعنی سوییچ پروژه هیچ
   * اثری روی فهرست نیروها نداشت).
   *
   * وقتی `projectId` داده شود، نتیجه شامل:
   *   ۱. نیروهایی که صریحاً به این پروژه لینک شده‌اند (جدول ProjectWorker)، و
   *   ۲. نیروهایی که اصلاً به *هیچ* پروژه‌ای لینک نیستند —
   * چون این دومی‌ها یا داده‌های قدیمی (از قبل از وجود این فیچر) هستند یا
   * نیروهایی که مسیر ایجادشان از این سرویس عبور نکرده (مثلاً import شده)؛
   * پنهان‌کردن ناگهانی‌شان یعنی «گم شدن» نیرو بدون هیچ اقدام آگاهانه‌ای از
   * طرف کاربر — نمی‌خواهیم رگرسیون data-loss بسازیم فقط برای filtering.
   * وقتی کاربر صریحاً نیرویی را (از طریق `create` یا تخصیص دستی) به یک
   * پروژه وصل کند، از آن پس دیگر «بدون لینک» نیست، پس فقط در همان
   * پروژه(ها) دیده می‌شود.
   */
  async list(filter?: { search?: string; isActive?: boolean; projectId?: string }): Promise<Worker[]> {
    let items = await db.workers.toArray();

    if (filter?.projectId) {
      const [linkedIds, allLinks] = await Promise.all([
        projectWorkerService.listWorkerIdsForProject(filter.projectId),
        db.projectWorkers.toArray(),
      ]);
      const linkedSet = new Set(linkedIds);
      const anyLinkWorkerIds = new Set(allLinks.map((l) => l.workerId));
      items = items.filter((w) => linkedSet.has(w.id) || !anyLinkWorkerIds.has(w.id));
    }

    if (filter?.isActive !== undefined) {
      items = items.filter((w) => w.isActive === filter.isActive);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      items = items.filter(
        (w) =>
          w.firstName.toLowerCase().includes(q) ||
          w.lastName.toLowerCase().includes(q) ||
          (w.phoneNumber ?? "").toLowerCase().includes(q) ||
          w.position.toLowerCase().includes(q)
      );
    }

    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(withGuardDefaults);
  },

  async getById(id: string): Promise<Worker> {
    const worker = await db.workers.get(id);
    if (!worker) throw new NotFoundError(`نیرویی با شناسه ${id} یافت نشد.`);
    return withGuardDefaults(worker);
  },

  async findByIdOrNull(id: string): Promise<Worker | null> {
    const worker = await db.workers.get(id);
    return worker ? withGuardDefaults(worker) : null;
  },

  async create(input: CreateWorkerInput): Promise<Worker> {
    if (!input.firstName?.trim()) throw new ValidationError("نام نیرو الزامی است.");
    if (!input.lastName?.trim()) throw new ValidationError("نام خانوادگی نیرو الزامی است.");
    if (!input.position?.trim()) throw new ValidationError("سمت نیرو الزامی است.");
    if (input.dailyBaseSalary === undefined || input.dailyBaseSalary < 0) {
      throw new ValidationError("حقوق پایه روزانه باید عددی مثبت باشد.");
    }
    if (input.guardDutyRate !== undefined && input.guardDutyRate < 0) {
      throw new ValidationError("نرخ نگهبانی نمی‌تواند منفی باشد.");
    }
    if (input.defaultCheckIn && !isValidTimeFormat(input.defaultCheckIn)) {
      throw new ValidationError("فرمت ساعت ورود پیش‌فرض باید HH:mm باشد.");
    }
    if (input.defaultCheckOut && !isValidTimeFormat(input.defaultCheckOut)) {
      throw new ValidationError("فرمت ساعت خروج پیش‌فرض باید HH:mm باشد.");
    }

    const now = new Date().toISOString();
    const cardNumbers = input.cardNumbers
      ? sanitizeCardNumbers(input.cardNumbers)
      : sanitizeCardNumbers(input.cardNumber ? [input.cardNumber] : []);
    const worker: Worker = {
      id: randomUUID(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phoneNumber: input.phoneNumber?.trim() || null,
      cardNumber: cardNumbers[0] ?? null,
      cardNumbers,
      shebaNumbers: sanitizeShebaNumbers(input.shebaNumbers),
      position: input.position.trim(),
      jobTypeId: input.jobTypeId ?? null,
      dailyBaseSalary: input.dailyBaseSalary,
      description: input.description?.trim() || null,
      avatarPhotoId: null,
      defaultCheckIn: input.defaultCheckIn || null,
      defaultCheckOut: input.defaultCheckOut || null,
      guardDutyEnabled: input.guardDutyEnabled ?? false,
      guardDutyRateType: input.guardDutyRateType ?? "hourly",
      guardDutyRate: input.guardDutyRate ?? 0,
      guardDutyMergeWithRegularPay: input.guardDutyMergeWithRegularPay ?? false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.workers.add(worker);
    await projectWorkerService.assign(await projectService.getOrCreateActiveProjectId(), worker.id);
    return worker;
  },

  async update(id: string, input: UpdateWorkerInput): Promise<Worker> {
    const existing = await this.getById(id);

    if (input.guardDutyRate !== undefined && input.guardDutyRate < 0) {
      throw new ValidationError("نرخ نگهبانی نمی‌تواند منفی باشد.");
    }
    if (input.defaultCheckIn && !isValidTimeFormat(input.defaultCheckIn)) {
      throw new ValidationError("فرمت ساعت ورود پیش‌فرض باید HH:mm باشد.");
    }
    if (input.defaultCheckOut && !isValidTimeFormat(input.defaultCheckOut)) {
      throw new ValidationError("فرمت ساعت خروج پیش‌فرض باید HH:mm باشد.");
    }

    const updated: Worker = {
      ...existing,
      firstName: input.firstName ?? existing.firstName,
      lastName: input.lastName ?? existing.lastName,
      phoneNumber: input.phoneNumber !== undefined ? (input.phoneNumber?.trim() || null) : existing.phoneNumber,
      ...(function resolveCardAndSheba() {
        const cardNumbers =
          input.cardNumbers !== undefined
            ? sanitizeCardNumbers(input.cardNumbers)
            : input.cardNumber !== undefined
              ? sanitizeCardNumbers(input.cardNumber ? [input.cardNumber] : [])
              : existing.cardNumbers;
        return {
          cardNumbers,
          cardNumber: cardNumbers[0] ?? null,
          shebaNumbers: input.shebaNumbers !== undefined ? sanitizeShebaNumbers(input.shebaNumbers) : existing.shebaNumbers,
        };
      })(),
      position: input.position ?? existing.position,
      jobTypeId: input.jobTypeId !== undefined ? input.jobTypeId : existing.jobTypeId,
      dailyBaseSalary: input.dailyBaseSalary ?? existing.dailyBaseSalary,
      description: input.description !== undefined ? input.description : existing.description,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      avatarPhotoId: input.avatarPhotoId !== undefined ? input.avatarPhotoId : existing.avatarPhotoId,
      defaultCheckIn: input.defaultCheckIn !== undefined ? input.defaultCheckIn : existing.defaultCheckIn,
      defaultCheckOut: input.defaultCheckOut !== undefined ? input.defaultCheckOut : existing.defaultCheckOut,
      guardDutyEnabled: input.guardDutyEnabled !== undefined ? input.guardDutyEnabled : existing.guardDutyEnabled,
      guardDutyRateType: input.guardDutyRateType ?? existing.guardDutyRateType,
      guardDutyRate: input.guardDutyRate ?? existing.guardDutyRate,
      guardDutyMergeWithRegularPay:
        input.guardDutyMergeWithRegularPay !== undefined
          ? input.guardDutyMergeWithRegularPay
          : existing.guardDutyMergeWithRegularPay,
      updatedAt: new Date().toISOString(),
    };
    await db.workers.put(updated);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.workers.get(id);
    if (!existing) throw new NotFoundError(`نیرویی با شناسه ${id} یافت نشد.`);

    if (await workerHasDependencies(id)) {
      throw new HasDependenciesError(
        "این نیرو دارای سابقه (حضور، دفتر حساب، تخصیص لوازم یا نگهبانی) است و برای حفظ گزارش‌ها حذف کامل آن ممکن نیست. به‌جای حذف، می‌توانید آن را غیرفعال کنید."
      );
    }

    // این نیرو هیچ سابقه‌ای ندارد (مثلاً به‌اشتباه ثبت شده)، پس حذف کامل و
    // امن است. عکس‌های مرتبط (آواتار + گالری عکس) و فعالیت‌های آیندهٔ
    // مرتبط (که صرفاً یادآوری برنامه‌ریزی‌شده‌اند، نه سابقهٔ گذشته) هم
    // پاک‌سازی می‌شوند تا رکورد یتیم در پایگاه‌داده باقی نماند.
    const relatedPhotos = (await db.photos.where({ relatedId: id }).toArray()).filter(
      (p) => p.relatedType === "worker" || p.relatedType === "worker-avatar"
    );
    const relatedFutureActivityIds = await db.futureActivities
      .where({ workerId: id })
      .primaryKeys();

    await db.transaction("rw", [db.workers, db.photos, db.futureActivities], async () => {
      await db.workers.delete(id);
      if (relatedPhotos.length > 0) {
        await db.photos.bulkDelete(relatedPhotos.map((p) => p.id));
      }
      if (relatedFutureActivityIds.length > 0) {
        await db.futureActivities.bulkDelete(relatedFutureActivityIds);
      }
    });
  },

  async toggleActive(id: string): Promise<Worker> {
    const existing = await this.getById(id);
    return this.update(id, { isActive: !existing.isActive });
  },
};
