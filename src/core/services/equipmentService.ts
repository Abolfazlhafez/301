import { randomUUID } from "../utils/uuid";
import { db } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import { workerService } from "./workerService";
import { projectService } from "./projectService";
import type {
  CreateEquipmentAssignmentInput,
  CreateEquipmentInput,
  Equipment,
  EquipmentAssignment,
  EquipmentWithAvailability,
  UpdateEquipmentInput,
} from "../../entities/Equipment";

async function sumAssignedQuantity(equipmentId: string): Promise<number> {
  const assignments = await db.equipmentAssignments.where({ equipmentId }).toArray();
  return assignments
    .filter((a) => !a.returnedDate)
    .reduce((sum, a) => sum + a.quantity, 0);
}

/**
 * یک کد خودکار قابل‌خواندن («M-0001»، «M-0002»، ...) برای قلم لوازم جدید تولید
 * می‌کند. برخلاف id (که یک UUID داخلی است)، این کد برای نمایش به کاربر و
 * چسباندن روی خودِ قلم فیزیکی است. برای اجتناب از برخورد در صورت حذف/افزودن
 * دستی کدهای سفارشی، به‌جای اتکا صرف به تعداد رکوردها، از بزرگ‌ترین شمارهٔ
 * موجود در کدهای فعلی (با همین الگو) شروع می‌شود.
 */
async function generateNextEquipmentCode(projectId: string): Promise<string> {
  const items = await db.equipment.where({ projectId }).toArray();
  let maxNumber = 0;
  for (const item of items) {
    const match = /^M-(\d+)$/.exec(item.code ?? "");
    if (match) maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
  }
  return `M-${String(maxNumber + 1).padStart(4, "0")}`;
}

export const equipmentService = {
  async list(filter?: { search?: string }): Promise<Equipment[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    let items = await db.equipment.where({ projectId: activeProjectId }).toArray();
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      items = items.filter((e) => e.name.toLowerCase().includes(q));
    }
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async listWithAvailability(filter?: { search?: string }): Promise<EquipmentWithAvailability[]> {
    const items = await this.list(filter);
    const result: EquipmentWithAvailability[] = [];
    for (const item of items) {
      const assignedQuantity = await sumAssignedQuantity(item.id);
      result.push({
        ...item,
        assignedQuantity,
        availableQuantity: Math.max(0, item.totalQuantity - assignedQuantity),
      });
    }
    return result;
  },

  async create(input: CreateEquipmentInput): Promise<Equipment> {
    if (!input.name?.trim()) throw new ValidationError("نام لوازم الزامی است.");
    if (!input.unit?.trim()) throw new ValidationError("واحد شمارش الزامی است.");
    if (input.totalQuantity === undefined || input.totalQuantity < 0) {
      throw new ValidationError("تعداد کل باید عددی مثبت باشد.");
    }

    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const trimmedCode = input.code?.trim();
    if (trimmedCode) {
      const codeTaken = (await db.equipment.where({ projectId: activeProjectId }).toArray()).some(
        (e) => e.code === trimmedCode
      );
      if (codeTaken) throw new ValidationError(`کد «${trimmedCode}» قبلاً برای یک قلم دیگر استفاده شده است.`);
    }

    const now = new Date().toISOString();
    const created: Equipment = {
      id: randomUUID(),
      projectId: activeProjectId,
      code: trimmedCode || (await generateNextEquipmentCode(activeProjectId)),
      name: input.name.trim(),
      unit: input.unit.trim(),
      totalQuantity: input.totalQuantity,
      description: input.description?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    await db.equipment.add(created);
    return created;
  },

  async update(id: string, input: UpdateEquipmentInput): Promise<Equipment> {
    const existing = await db.equipment.get(id);
    if (!existing) throw new NotFoundError(`لوازمی با شناسه ${id} یافت نشد.`);
    if (input.totalQuantity !== undefined && input.totalQuantity < 0) {
      throw new ValidationError("تعداد کل باید عددی مثبت باشد.");
    }

    let nextCode = existing.code;
    if (input.code !== undefined) {
      const trimmedCode = input.code?.trim();
      if (!trimmedCode) throw new ValidationError("کد شناسایی نمی‌تواند خالی باشد.");
      if (trimmedCode !== existing.code) {
        const codeTaken = (await db.equipment.where({ projectId: existing.projectId }).toArray()).some(
          (e) => e.id !== id && e.code === trimmedCode
        );
        if (codeTaken) throw new ValidationError(`کد «${trimmedCode}» قبلاً برای یک قلم دیگر استفاده شده است.`);
      }
      nextCode = trimmedCode;
    }

    const updated: Equipment = {
      ...existing,
      code: nextCode,
      name: input.name?.trim() ?? existing.name,
      unit: input.unit?.trim() ?? existing.unit,
      totalQuantity: input.totalQuantity ?? existing.totalQuantity,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      updatedAt: new Date().toISOString(),
    };
    await db.equipment.put(updated);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.equipment.get(id);
    if (!existing) throw new NotFoundError(`لوازمی با شناسه ${id} یافت نشد.`);
    await db.equipment.delete(id);
    await db.equipmentAssignments.where({ equipmentId: id }).delete();
  },
};

export const equipmentAssignmentService = {
  async list(filter?: {
    workerId?: string;
    equipmentId?: string;
    onlyActive?: boolean;
  }): Promise<EquipmentAssignment[]> {
    let items = await db.equipmentAssignments.toArray();
    if (filter?.workerId) items = items.filter((a) => a.workerId === filter.workerId);
    if (filter?.equipmentId) items = items.filter((a) => a.equipmentId === filter.equipmentId);
    if (filter?.onlyActive) items = items.filter((a) => !a.returnedDate);
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async create(input: CreateEquipmentAssignmentInput): Promise<EquipmentAssignment> {
    if (!input.quantity || input.quantity <= 0) throw new ValidationError("تعداد باید بزرگتر از صفر باشد.");
    if (!input.assignedDate) throw new ValidationError("تاریخ تحویل الزامی است.");

    const equipment = await db.equipment.get(input.equipmentId);
    if (!equipment) throw new NotFoundError(`لوازمی با شناسه ${input.equipmentId} یافت نشد.`);

    const worker = await workerService.findByIdOrNull(input.workerId);
    if (!worker) throw new NotFoundError(`نیرویی با شناسه ${input.workerId} یافت نشد.`);

    const alreadyAssigned = await sumAssignedQuantity(input.equipmentId);
    const available = equipment.totalQuantity - alreadyAssigned;

    if (input.quantity > available) {
      throw new ValidationError(`موجودی کافی نیست. موجودی در دسترس: ${available} ${equipment.unit}`);
    }

    const now = new Date().toISOString();
    const created: EquipmentAssignment = {
      id: randomUUID(),
      equipmentId: input.equipmentId,
      workerId: input.workerId,
      quantity: input.quantity,
      assignedDate: input.assignedDate,
      returnedDate: null,
      note: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    await db.equipmentAssignments.add(created);
    return created;
  },

  async returnItem(id: string, returnedDate: string): Promise<EquipmentAssignment> {
    const existing = await db.equipmentAssignments.get(id);
    if (!existing) throw new NotFoundError(`رکورد تخصیص لوازم با شناسه ${id} یافت نشد.`);
    const updated: EquipmentAssignment = { ...existing, returnedDate, updatedAt: new Date().toISOString() };
    await db.equipmentAssignments.put(updated);
    return updated;
  },

  async remove(id: string): Promise<void> {
    const existing = await db.equipmentAssignments.get(id);
    if (!existing) throw new NotFoundError(`رکورد تخصیص لوازم با شناسه ${id} یافت نشد.`);
    await db.equipmentAssignments.delete(id);
  },
};
