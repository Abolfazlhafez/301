import { settingsService } from "../../core/services/settingsService";
import {
  AppSettings,
  AttendanceTimeTemplate,
  UpdateAppSettingsInput,
  UpdateAutoBackupSettingsInput,
  UpdateCloudBackupSettingsInput,
  UpdateNotificationSettingsInput,
  UpdateProjectInfoInput,
  UpdateQuickCheckInSettingsInput,
  UpdateQuickBreakSettingsInput,
} from "../../entities/AppSettings";

export const settingsApi = {
  async get(): Promise<AppSettings> {
    return settingsService.get();
  },

  async update(input: UpdateAppSettingsInput): Promise<AppSettings> {
    return settingsService.update(input);
  },

  async updateAutoBackupSettings(input: UpdateAutoBackupSettingsInput): Promise<AppSettings> {
    return settingsService.updateAutoBackupSettings(input);
  },

  async updateCloudBackupSettings(input: UpdateCloudBackupSettingsInput): Promise<AppSettings> {
    return settingsService.updateCloudBackupSettings(input);
  },

  async updateNotificationSettings(input: UpdateNotificationSettingsInput): Promise<AppSettings> {
    return settingsService.updateNotificationSettings(input);
  },

  async updateProjectInfo(input: UpdateProjectInfoInput): Promise<AppSettings> {
    return settingsService.updateProjectInfo(input);
  },

  async updateQuickCheckInSettings(input: UpdateQuickCheckInSettingsInput): Promise<AppSettings> {
    return settingsService.updateQuickCheckInSettings(input);
  },

  async updateQuickBreakSettings(input: UpdateQuickBreakSettingsInput): Promise<AppSettings> {
    return settingsService.updateQuickBreakSettings(input);
  },

  async listAttendanceTemplates(): Promise<AttendanceTimeTemplate[]> {
    return settingsService.listAttendanceTemplates();
  },

  async createAttendanceTemplate(input: { name: string; checkIn: string; checkOut: string }): Promise<AttendanceTimeTemplate> {
    return settingsService.createAttendanceTemplate(input);
  },

  async updateAttendanceTemplate(
    id: string,
    input: { name: string; checkIn: string; checkOut: string }
  ): Promise<AttendanceTimeTemplate> {
    return settingsService.updateAttendanceTemplate(id, input);
  },

  async deleteAttendanceTemplate(id: string): Promise<void> {
    return settingsService.deleteAttendanceTemplate(id);
  },

  async setLastAttendanceTemplateId(id: string | null): Promise<void> {
    return settingsService.setLastAttendanceTemplateId(id);
  },
};
