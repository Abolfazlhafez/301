import { randomUUID } from "../utils/uuid";
import { db } from "../db";

/**
 * مدیریت ارتباط چندبه‌چند پروژه↔نیرو. طبق تصمیم کاربر («ترکیبی از دو
 * حالت»): خودِ Worker سراسری/مشترک است، ولی این‌که هر نیرو در کدام
 * پروژه(ها) «فعال» است از این جدول رابطه خوانده می‌شود.
 */
export const projectWorkerService = {
  async listWorkerIdsForProject(projectId: string): Promise<string[]> {
    const links = await db.projectWorkers.where({ projectId }).toArray();
    return links.map((l) => l.workerId);
  },

  async listProjectIdsForWorker(workerId: string): Promise<string[]> {
    const links = await db.projectWorkers.where({ workerId }).toArray();
    return links.map((l) => l.projectId);
  },

  async isWorkerInProject(projectId: string, workerId: string): Promise<boolean> {
    const link = await db.projectWorkers.where({ projectId, workerId }).first();
    return !!link;
  },

  /** نیرو را به پروژه وصل می‌کند؛ اگر از قبل وصل بود، کاری نمی‌کند (idempotent). */
  async assign(projectId: string, workerId: string): Promise<void> {
    const existing = await db.projectWorkers.where({ projectId, workerId }).first();
    if (existing) return;
    await db.projectWorkers.add({
      id: randomUUID(),
      projectId,
      workerId,
      createdAt: new Date().toISOString(),
    });
  },

  /** فقط ارتباط را قطع می‌کند؛ خودِ نیرو (و سابقهٔ حضور/دستمزد او) هرگز حذف نمی‌شود. */
  async unassign(projectId: string, workerId: string): Promise<void> {
    await db.projectWorkers.where({ projectId, workerId }).delete();
  },
};
