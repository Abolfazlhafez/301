import { notificationService } from "../../core/services/notificationService";
import type { FutureActivity } from "../../entities/FutureActivity";

export const notificationsApi = {
  async ensurePermission(): Promise<boolean> {
    return notificationService.ensurePermission();
  },
  async scheduleForActivity(activity: FutureActivity): Promise<void> {
    return notificationService.scheduleForActivity(activity);
  },
  async cancelForActivity(activityId: string): Promise<void> {
    return notificationService.cancelForActivity(activityId);
  },
  async resyncAll(openActivities: FutureActivity[]): Promise<void> {
    return notificationService.resyncAll(openActivities);
  },
  async sendTest(): Promise<boolean> {
    return notificationService.sendTest();
  },
};
