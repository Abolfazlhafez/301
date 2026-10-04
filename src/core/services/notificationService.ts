import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { FutureActivity } from "../../entities/FutureActivity";

/**
 * لایه‌ی نوتیفیکیشن محلی (بدون سرور، کاملاً آفلاین) برای یادآوری فعالیت‌های
 * آینده. فقط روی پلتفرم بومی (اندروید) فعال است؛ در مرورگر توسعه بی‌صدا
 * کاری انجام نمی‌دهد. هیچ خطایی از این سرویس بیرون درز نمی‌کند تا مشکلات
 * مجوز/پلتفرم هرگز باعث شکست ذخیره‌سازی فعالیت نشوند.
 */

let permissionChecked = false;
let permissionGranted = false;

function activityIdToNotificationId(activityId: string): number {
  let hash = 0;
  for (let i = 0; i < activityId.length; i++) {
    hash = (hash << 5) - hash + activityId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}

// خارج از بازهٔ خروجی activityIdToNotificationId (که همیشه در [0, 2147483647)
// است) نیست، اما یک عدد خیلی خاص و بعیدالوقوع برای هش یک UUID واقعی است؛
// چون فقط یک نوتیفیکیشن آزمایشی هم‌زمان لازم است (نه پایدار)، برخورد
// تصادفی حتی اگر رخ دهد بی‌ضرر است (فقط یعنی نوتیف تست جای یک نوتیف واقعی
// را برای یک لحظه می‌گیرد، که با cancel+schedule دوبارهٔ همان فعالیت فوراً درست می‌شود).
const TEST_NOTIFICATION_ID = 999999999;

function isSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export const notificationService = {
  async ensurePermission(): Promise<boolean> {
    if (!isSupported()) return false;
    if (permissionChecked) return permissionGranted;

    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === "granted") {
        permissionGranted = true;
      } else {
        const requested = await LocalNotifications.requestPermissions();
        permissionGranted = requested.display === "granted";
      }
    } catch {
      permissionGranted = false;
    }

    permissionChecked = true;
    return permissionGranted;
  },

  async scheduleForActivity(activity: FutureActivity): Promise<void> {
    if (!isSupported() || activity.isCompleted) return;
    const granted = await this.ensurePermission();
    if (!granted) return;

    const [hour, minute] = (activity.time ?? "08:00").split(":").map(Number);
    const fireDate = new Date(`${activity.date}T00:00:00`);
    fireDate.setHours(hour, minute, 0, 0);

    if (fireDate.getTime() <= Date.now()) return;

    const id = activityIdToNotificationId(activity.id);
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title: "یادآوری فعالیت کارگاه",
            body: activity.title,
            schedule: { at: fireDate, allowWhileIdle: true },
            smallIcon: "ic_stat_notify",
          },
        ],
      });
    } catch {
      // خطای زمان‌بندی نوتیفیکیشن هرگز نباید مسیر ذخیره‌سازی فعالیت را بشکند.
    }
  },

  /**
   * ارسال یک نوتیفیکیشن آزمایشی فوری — برای این‌که کاربر مطمئن شود مجوز و
   * تنظیمات سیستم واقعاً درست کار می‌کنند، بدون نیاز به منتظر ماندن برای
   * فرارسیدن زمان یک فعالیت واقعی. از یک id ثابت و مجزا (خارج از بازهٔ
   * activityIdToNotificationId) استفاده می‌شود تا هرگز با نوتیفیکیشن یک
   * فعالیت واقعی تداخل نکند.
   */
  async sendTest(): Promise<boolean> {
    if (!isSupported()) return false;
    const granted = await this.ensurePermission();
    if (!granted) return false;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: TEST_NOTIFICATION_ID,
            title: "آزمایش نوتیفیکیشن کارگاه‌یار",
            body: "اگر این پیام را می‌بینید، نوتیفیکیشن‌ها درست کار می‌کنند.",
            schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true },
            smallIcon: "ic_stat_notify",
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  },

  async cancelForActivity(activityId: string): Promise<void> {
    if (!isSupported()) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: activityIdToNotificationId(activityId) }] });
    } catch {
      // بی‌صدا نادیده گرفته می‌شود.
    }
  },

  async resyncAll(openActivities: FutureActivity[]): Promise<void> {
    if (!isSupported()) return;
    const granted = await this.ensurePermission();
    if (!granted) return;

    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
    } catch {
      // ادامه می‌دهیم؛ حتی اگر پاک‌سازی اولیه ناموفق بود، زمان‌بندی مجدد را امتحان می‌کنیم.
    }

    for (const activity of openActivities) {
      await this.scheduleForActivity(activity);
    }
  },
};
