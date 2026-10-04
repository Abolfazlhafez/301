import { ledgerService, RemoveLedgerEntryResult } from "../../core/services/ledgerService";
import { getTodayIso } from "../utils/jalaliDate";
import { CreateLedgerEntryInput, WorkerBalanceSummary, WorkerLedgerEntry } from "../../entities/Ledger";

export const ledgerApi = {
  async list(params?: { workerId?: string; from?: string; to?: string }): Promise<WorkerLedgerEntry[]> {
    return ledgerService.list(params);
  },

  async create(input: CreateLedgerEntryInput): Promise<WorkerLedgerEntry> {
    return ledgerService.create(input);
  },

  async remove(id: string): Promise<RemoveLedgerEntryResult> {
    return ledgerService.remove(id);
  },

  async getBalance(workerId: string, date?: string): Promise<WorkerBalanceSummary> {
    return ledgerService.getBalance(workerId, date ?? getTodayIso());
  },

  async settle(workerId: string, date: string, description?: string | null): Promise<WorkerLedgerEntry> {
    return ledgerService.settle(workerId, date, description);
  },
};
