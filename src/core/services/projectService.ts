import { randomUUID } from "../utils/uuid";
import { db, SETTINGS_ROW_ID } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type { CreateProjectInput, Project, UpdateProjectInput } from "../../entities/Project";

/**
 * سرویس مدیریت پروژه‌ها — قدم اول «چند-پروژه‌ای» (مورد ۱ گزارش بررسی
 * پروژه). طبق توضیح entities/Project.ts، این نسخه فقط خودِ مفهوم پروژه و
 * سوییچ بین آن‌ها را می‌سازد؛ داده‌های طبقات/نیروها/دفتر حساب و غیره هنوز
 * به‌صورت سراسری (مشترک بین همهٔ پروژه‌ها) باقی می‌مانند.
 */
export const projectService = {
  async list(): Promise<Project[]> {
    const projects = await db.projects.toArray();
    return projects.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async getById(id: string): Promise<Project> {
    const project = await db.projects.get(id);
    if (!project) throw new NotFoundError("پروژه پیدا نشد.");
    return project;
  },

  async create(input: CreateProjectInput): Promise<Project> {
    const name = input.name.trim();
    if (!name) throw new ValidationError("نام پروژه نمی‌تواند خالی باشد.");

    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      name,
      location: input.location?.trim() ?? "",
      supervisorName: input.supervisorName?.trim() ?? "",
      createdAt: now,
      updatedAt: now,
    };

    // هر پروژه از همان لحظهٔ ساخت باید دقیقاً یک صندوق پیش‌فرض داشته باشد.
    // بدون این، صفحهٔ دفتر حساب (که نمایش را منوط به انتخاب خودکار یک
    // صندوق می‌داند) برای این پروژهٔ تازه هیچ صندوقی برای انتخاب پیدا
    // نمی‌کند و برای همیشه در حالت «در حال بارگذاری» باقی می‌ماند — دقیقاً
    // همان باگی که کاربر گزارش داد. هر دو نوشته در یک تراکنش انجام می‌شوند
    // تا هرگز پروژه‌ای بدون صندوق در دیتابیس باقی نماند.
    await db.transaction("rw", db.projects, db.cashboxFunds, async () => {
      await db.projects.add(project);
      await db.cashboxFunds.add({
        id: randomUUID(),
        projectId: project.id,
        name: "صندوق اصلی",
        description: null,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    return project;
  },

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const existing = await this.getById(id);
    if (input.name !== undefined && !input.name.trim()) {
      throw new ValidationError("نام پروژه نمی‌تواند خالی باشد.");
    }
    const updated: Project = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.location !== undefined ? { location: input.location.trim() } : {}),
      ...(input.supervisorName !== undefined ? { supervisorName: input.supervisorName.trim() } : {}),
      updatedAt: new Date().toISOString(),
    };
    await db.projects.put(updated);
    return updated;
  },

  /**
   * حذف یک پروژه. عمداً اجازهٔ حذف آخرین پروژهٔ باقی‌مانده داده نمی‌شود —
   * چون هنوز activeProjectId همیشه باید به یک پروژهٔ معتبر اشاره کند
   * (بخش‌های زیادی از UI امروز فرض می‌کنند دست‌کم یک پروژه وجود دارد).
   */
  async remove(id: string): Promise<void> {
    const all = await db.projects.toArray();
    if (all.length <= 1) {
      throw new ValidationError("نمی‌توان آخرین پروژهٔ باقی‌مانده را حذف کرد.");
    }
    const settings = await db.settings.get(SETTINGS_ROW_ID);
    await db.projects.delete(id);
    if (settings?.activeProjectId === id) {
      const fallback = all.find((p) => p.id !== id);
      if (fallback) {
        await db.settings.update(SETTINGS_ROW_ID, { activeProjectId: fallback.id });
      }
    }
  },

  async getActiveProjectId(): Promise<string | null> {
    const settings = await db.settings.get(SETTINGS_ROW_ID);
    return settings?.activeProjectId || null;
  },

  /**
   * مثل getActiveProjectId، اما هرگز null برنمی‌گرداند: اگر پروژهٔ فعال
   * معتبر نبود (تنظیمات هنوز seed نشده، یا activeProjectId به پروژهٔ
   * حذف‌شده‌ای اشاره می‌کند)، یک پروژهٔ پیش‌فرض پیدا/ساخته و به‌عنوان فعال
   * تنظیم می‌کند. این دقیقاً همان اصل «ترمیم یتیم» است که در جاهای دیگر
   * کد (مثلاً تراکنش‌های دفتر حساب بدون صندوق معتبر) هم رعایت شده —
   * سرویس‌هایی مثل floorService نباید فقط به‌خاطر این‌که ensureDatabaseSeeded
   * فراخوانی نشده (مثلاً در یک تست) با خطا متوقف شوند.
   */
  async getOrCreateActiveProjectId(): Promise<string> {
    const settings = await db.settings.get(SETTINGS_ROW_ID);
    if (settings?.activeProjectId) {
      const project = await db.projects.get(settings.activeProjectId);
      if (project) return project.id;
    }
    const anyProject = (await db.projects.toArray())[0];
    if (anyProject) {
      if (settings) await db.settings.update(SETTINGS_ROW_ID, { activeProjectId: anyProject.id });
      return anyProject.id;
    }
    const created = await this.create({ name: "پروژهٔ من" });
    if (settings) await db.settings.update(SETTINGS_ROW_ID, { activeProjectId: created.id });
    return created.id;
  },

  async setActiveProjectId(id: string): Promise<void> {
    await this.getById(id); // مطمئن شو پروژه واقعاً وجود دارد.
    await db.settings.update(SETTINGS_ROW_ID, { activeProjectId: id });
  },
};
