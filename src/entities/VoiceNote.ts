// یادداشت صوتی — امکان ضبط صدا به‌جای/علاوه‌بر تایپ، برای جاهایی که تایپ کردن
// برای سرپرست کارگاه در محل کار عملی نیست (مثل ثبت مشکل طبقه یا گزارش روزانه).
// دقیقاً هم‌الگو با Photo: فایل واقعی (Blob) در جدول Dexie نگه داشته می‌شود،
// این اینترفیس فقط متادیتاست (بدون blob) که به بیرون از دیتابیس برمی‌گردد.

export type VoiceNoteRelatedType = "floorIssue" | "workLog";

export interface VoiceNote {
  id: string;
  projectId: string;
  relatedType: VoiceNoteRelatedType;
  relatedId: string;
  floorId: string | null;
  date: string;
  durationSeconds: number;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface CreateVoiceNoteInput {
  relatedType: VoiceNoteRelatedType;
  relatedId: string;
  floorId?: string | null;
  date: string;
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
}
