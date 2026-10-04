import { extractErrorMessage as extractLocalErrorMessage } from "../../core/errors";

/**
 * این برنامه اکنون کاملاً آفلاین است و به هیچ سروری متصل نمی‌شود.
 * این فایل فقط برای سازگاری با importهای قبلی (extractErrorMessage) نگه داشته شده است.
 */
export function extractErrorMessage(error: unknown): string {
  return extractLocalErrorMessage(error);
}
