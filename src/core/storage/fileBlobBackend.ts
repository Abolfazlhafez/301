import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type { BlobBackend, BlobListEntry } from "./types";

const ROOT = "blobs";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("خواندن Blob ناموفق بود."));
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * عکس/صوت به‌صورت فایل واقعی در Directory.Data (حافظهٔ داخلی خصوصی اپ).
 * نمایش با convertFileSrc انجام می‌شود تا بایت‌ها هرگز وارد heap جاوااسکریپت نشوند.
 */
export class FileBlobBackend implements BlobBackend {
  private baseUri = "";

  async open(): Promise<void> {
    if (this.baseUri) return;
    await Filesystem.mkdir({ path: ROOT, directory: Directory.Data, recursive: true }).catch(() => {});
    const { uri } = await Filesystem.getUri({ path: ROOT, directory: Directory.Data });
    this.baseUri = uri.replace(/\/+$/, "");
  }

  async write(path: string, blob: Blob): Promise<void> {
    await Filesystem.writeFile({
      path: `${ROOT}/${path}`,
      directory: Directory.Data,
      data: await blobToBase64(blob),
      recursive: true,
    });
  }

  url(path: string): string {
    return Capacitor.convertFileSrc(`${this.baseUri}/${path}`);
  }

  async read(path: string): Promise<Blob> {
    const res = await fetch(this.url(path));
    if (!res.ok) throw new Error(`خواندن فایل ناموفق بود: ${path}`);
    return res.blob();
  }

  async remove(path: string): Promise<void> {
    await Filesystem.deleteFile({ path: `${ROOT}/${path}`, directory: Directory.Data });
  }

  async stat(path: string): Promise<{ size: number } | null> {
    try {
      const s = await Filesystem.stat({ path: `${ROOT}/${path}`, directory: Directory.Data });
      return { size: s.size };
    } catch {
      return null;
    }
  }

  /**
   * فهرست بازگشتی همهٔ فایل‌های زیر blobs/ (برای پاک‌سازی فایل‌های یتیم).
   * هر پوشه جداگانه خوانده می‌شود تا حافظهٔ زیادی هم‌زمان مصرف نشود.
   */
  async list(): Promise<BlobListEntry[]> {
    const out: BlobListEntry[] = [];
    const walk = async (rel: string): Promise<void> => {
      let entries;
      try {
        entries = (await Filesystem.readdir({ path: `${ROOT}/${rel}`.replace(/\/+$/, ""), directory: Directory.Data })).files;
      } catch {
        return;
      }
      for (const f of entries) {
        const childRel = rel ? `${rel}/${f.name}` : f.name;
        if (f.type === "directory") await walk(childRel);
        else out.push({ path: childRel, size: f.size ?? 0, mtime: typeof f.mtime === "number" ? f.mtime : 0 });
      }
    };
    await walk("");
    return out;
  }

  async removeAll(): Promise<void> {
    await Filesystem.rmdir({ path: ROOT, directory: Directory.Data, recursive: true }).catch(() => {});
    await Filesystem.mkdir({ path: ROOT, directory: Directory.Data, recursive: true }).catch(() => {});
  }
}
