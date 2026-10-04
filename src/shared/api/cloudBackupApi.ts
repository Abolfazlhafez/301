import { cloudBackupService, type CloudBackupConnectionTestResult } from "../../core/services/cloudBackupService";

export const cloudBackupApi = {
  async testConnection(url: string, anonKey: string): Promise<CloudBackupConnectionTestResult> {
    return cloudBackupService.testConnection(url, anonKey);
  },

  async restoreFromCloud(url: string, anonKey: string, deviceId: string): Promise<void> {
    return cloudBackupService.restoreFromCloud(url, anonKey, deviceId);
  },
};
