import { randomUUID, monotonicIsoTimestamp } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { evaluateWageFormula, formatWageFormula, WageFormulaEvaluationResult } from "../wageFormula";
import type { CreateWageCalculationInput, WageCalculationRecord } from "../../entities/WageAssignment";

export interface WagePreviewResult extends WageFormulaEvaluationResult {
  /** رشتهٔ فرمول به‌صورت خوانا (مثلاً «(طول − پرت) × نرخ»)، برای نمایش کنار توضیح گام‌به‌گام. */
  formulaText: string;
}

export const wageCalculationService = {
  async listByWorker(workerId: string): Promise<WageCalculationRecord[]> {
    const items = await db.wageCalculations.where("workerId").equals(workerId).toArray();
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async listByAssignment(wageAssignmentId: string): Promise<WageCalculationRecord[]> {
    const items = await db.wageCalculations.where("wageAssignmentId").equals(wageAssignmentId).toArray();
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  /**
   * محاسبهٔ پیش‌نمایش — فرمول را با مقادیر داده‌شده اجرا می‌کند اما هیچ چیز
   * را در دیتابیس ذخیره نمی‌کند. برای دکمهٔ «مشاهده نحوه محاسبه» و پیش‌نمایش
   * زندهٔ فرم محاسبه استفاده می‌شود.
   */
  async preview(wageAssignmentId: string, variableValues: Record<string, number>): Promise<WagePreviewResult> {
    const assignment = await db.wageAssignments.get(wageAssignmentId);
    if (!assignment) throw new NotFoundError("آیتم دستمزد یافت نشد.");
    const method = await db.wageMethods.get(assignment.wageMethodId);
    if (!method) throw new NotFoundError("روش محاسبهٔ این آیتم دستمزد یافت نشد.");

    const result = evaluateWageFormula(method.formula, variableValues);
    const variableLabels = Object.fromEntries(method.formula.variables.map((v) => [v.key, v.label]));
    const formulaText = formatWageFormula(method.formula.root, variableLabels);

    return { ...result, formulaText };
  },

  /**
   * محاسبهٔ واقعی و ثبت‌شده — همان منطق preview را اجرا می‌کند و در صورت
   * موفقیت (بدون خطا)، یک رکورد WageCalculationRecord کامل با تمام جزئیات
   * (مقادیر، فرمول متنی، مبلغ نهایی) ذخیره می‌کند تا سابقهٔ محاسبات هر
   * نیرو قابل مرور و شفاف بماند.
   */
  async calculateAndSave(input: CreateWageCalculationInput): Promise<WageCalculationRecord> {
    const assignment = await db.wageAssignments.get(input.wageAssignmentId);
    if (!assignment) throw new NotFoundError("آیتم دستمزد یافت نشد.");
    if (assignment.workerId !== input.workerId) {
      throw new ValidationError("این آیتم دستمزد متعلق به این نیرو نیست.");
    }
    const method = await db.wageMethods.get(assignment.wageMethodId);
    if (!method) throw new NotFoundError("روش محاسبهٔ این آیتم دستمزد یافت نشد.");

    const result = evaluateWageFormula(method.formula, input.variableValues);
    if (result.error) {
      throw new ValidationError(`خطا در محاسبهٔ فرمول: ${result.error}`);
    }

    const variableLabels = Object.fromEntries(method.formula.variables.map((v) => [v.key, v.label]));
    const formulaText = formatWageFormula(method.formula.root, variableLabels);

    const record: WageCalculationRecord = {
      id: randomUUID(),
      workerId: input.workerId,
      wageAssignmentId: input.wageAssignmentId,
      date: input.date,
      variableValues: input.variableValues,
      payableAmount: result.value,
      formulaSnapshot: formulaText,
      note: input.note?.trim() || null,
      // از monotonicIsoTimestamp به‌جای now استفاده می‌شود تا اگر چند
      // محاسبه خیلی سریع پشت‌سرهم (در همان میلی‌ثانیه) ثبت شوند، ترتیب
      // «جدیدترین اول» در تاریخچهٔ محاسبات (listByAssignment) همیشه
      // قطعی و صحیح بماند.
      createdAt: monotonicIsoTimestamp(),
    };
    await db.wageCalculations.add(record);
    return record;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.wageCalculations.get(id);
    if (!existing) throw new NotFoundError(`رکورد محاسبه‌ای با شناسه ${id} یافت نشد.`);
    await db.wageCalculations.delete(id);
  },
};
