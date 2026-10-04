import { dashboardService } from "../../core/services/dashboardService";
import { reportService } from "../../core/services/reportService";
import { getTodayIso } from "../utils/jalaliDate";
import { DailyTrendPoint, DailyWorkerReport, DashboardSummary, MonthlyWorkerReport } from "../../entities/Report";

export const dashboardApi = {
  async getSummary(date?: string): Promise<DashboardSummary> {
    return dashboardService.getSummary(date ?? getTodayIso());
  },
};

export const reportsApi = {
  async dailyForAllWorkers(date: string): Promise<DailyWorkerReport[]> {
    return reportService.getDailyAllWorkersReport(date);
  },

  async dailyForWorker(workerId: string, date: string): Promise<DailyWorkerReport> {
    return reportService.getDailyWorkerReport(workerId, date);
  },

  async monthlyForWorker(
    workerId: string,
    from: string,
    to: string,
    label?: string
  ): Promise<MonthlyWorkerReport> {
    return reportService.getMonthlyWorkerReport(workerId, from, to, label ?? "");
  },

  async monthlyForAllWorkers(from: string, to: string, label?: string): Promise<MonthlyWorkerReport[]> {
    return reportService.getMonthlyAllWorkersReport(from, to, label ?? "");
  },

  async weeklyTrend(days = 7): Promise<DailyTrendPoint[]> {
    return reportService.getWeeklyTrend(days);
  },
};
