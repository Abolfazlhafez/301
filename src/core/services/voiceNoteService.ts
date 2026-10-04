import { randomUUID } from "../utils/uuid";
import { db, type VoiceNoteRow, type VoiceNoteWithBlob } from "../db";
import { NotFoundError, ValidationError } from "../errors";
import type { VoiceNote, VoiceNoteRelatedType } from "../../entities/VoiceNote";
import { projectService } from "./projectService";

const VALID_RELATED_TYPES: VoiceNoteRelatedType[] = ["floorIssue", "workLog"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // ۱۰ مگابایت — کافی برای چند دقیقه صدا با کیفیت معمول
const MAX_DURATION_SECONDS = 5 * 60; // ۵ دقیقه سقف هر یادداشت صوتی

// کش آدرس فایل صوتی (بر اساس id). فایل روی دیسک است، نه داخل پایگاه‌داده.
const voiceUrlCache = new Map<string, string>();

function cacheObjectUrl(row: VoiceNoteRow): string {
  voiceUrlCache.set(row.id, row.blobUrl);
  return row.blobUrl;
}

/** آدرس قابل‌پخش یک یادداشت صوتی بر اساس شناسه‌اش (از کش object URL). */
export function resolveVoiceNoteUrl(id: string): string {
  return voiceUrlCache.get(id) ?? "";
}

function toPublicVoiceNote(row: VoiceNoteRow): VoiceNote {
  cacheObjectUrl(row);
  const { blobUrl: _blobUrl, ...rest } = row;
  return rest;
}

export const voiceNoteService = {
  async list(filter: { relatedType: VoiceNoteRelatedType; relatedId: string }): Promise<VoiceNote[]> {
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    const items = await db.voiceNotes
      .where({ projectId: activeProjectId, relatedType: filter.relatedType, relatedId: filter.relatedId })
      .toArray();
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(toPublicVoiceNote);
  },

  async getBlobRow(id: string): Promise<VoiceNoteRow | null> {
    const row = await db.voiceNotes.get(id);
    if (!row) return null;
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    return row.projectId === activeProjectId ? row : null;
  },

  async record(input: {
    relatedType: VoiceNoteRelatedType;
    relatedId: string;
    floorId?: string | null;
    date: string;
    blob: Blob;
    durationSeconds: number;
    mimeType: string;
  }): Promise<VoiceNote> {
    if (!VALID_RELATED_TYPES.includes(input.relatedType)) {
      throw new ValidationError("نوع ارتباط یادداشت صوتی نامعتبر است.");
    }
    if (!input.relatedId) throw new ValidationError("شناسه مرتبط برای یادداشت صوتی الزامی است.");
    if (!input.date) throw new ValidationError("تاریخ یادداشت صوتی الزامی است.");
    if (input.blob.size <= 0) throw new ValidationError("فایل صوتی خالی است.");
    if (input.blob.size > MAX_FILE_SIZE) throw new ValidationError("حجم فایل صوتی نباید بیشتر از ۱۰ مگابایت باشد.");
    if (input.durationSeconds <= 0) throw new ValidationError("مدت زمان یادداشت صوتی نامعتبر است.");
    if (input.durationSeconds > MAX_DURATION_SECONDS) {
      throw new ValidationError("مدت زمان یادداشت صوتی نباید بیشتر از ۵ دقیقه باشد.");
    }

    const activeProjectId = await projectService.getOrCreateActiveProjectId();

    if (input.floorId) {
      const floor = await db.floors.get(input.floorId);
      if (!floor) throw new NotFoundError("طبقه انتخاب‌شده پیدا نشد.");
      if (floor.projectId !== activeProjectId) throw new ValidationError("طبقه انتخاب‌شده متعلق به پروژه فعال نیست.");
    }
    if (input.relatedType === "floorIssue") {
      const issue = await db.floorIssues.get(input.relatedId);
      if (!issue) throw new NotFoundError("مشکل انتخاب‌شده پیدا نشد.");
      if (input.floorId && issue.floorId !== input.floorId) {
        throw new ValidationError("مشکل انتخاب‌شده متعلق به این طبقه نیست.");
      }
    }

    const created: VoiceNoteWithBlob = {
      id: randomUUID(),
      projectId: activeProjectId,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      floorId: input.floorId ?? null,
      date: input.date,
      durationSeconds: Math.round(input.durationSeconds),
      mimeType: input.mimeType,
      fileSize: input.blob.size,
      createdAt: new Date().toISOString(),
      blob: input.blob,
    };

    await db.voiceNotes.add(created);
    return toPublicVoiceNote((await db.voiceNotes.get(created.id))!);
  },

  async remove(id: string): Promise<void> {
    const existing = await db.voiceNotes.get(id);
    if (!existing) throw new NotFoundError(`یادداشت صوتی با شناسه ${id} یافت نشد.`);
    const activeProjectId = await projectService.getOrCreateActiveProjectId();
    if (existing.projectId !== activeProjectId) throw new ValidationError("این یادداشت صوتی متعلق به پروژه فعال نیست.");
    voiceUrlCache.delete(id);
    await db.voiceNotes.delete(id);
  },
};
