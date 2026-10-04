import { cashbookService, ListCashbookFilter } from "../../core/services/cashbookService";
import {
  CashbookEntry,
  CashbookSummary,
  CreateCashbookEntryInput,
  UpdateCashbookEntryInput,
} from "../../entities/Cashbook";

export const cashbookApi = {
  async list(filter?: ListCashbookFilter): Promise<CashbookEntry[]> {
    return cashbookService.list(filter);
  },

  async getSummary(filter?: ListCashbookFilter): Promise<CashbookSummary> {
    return cashbookService.getSummary(filter);
  },

  async create(input: CreateCashbookEntryInput): Promise<CashbookEntry> {
    return cashbookService.create(input);
  },

  async update(id: string, input: UpdateCashbookEntryInput): Promise<CashbookEntry> {
    return cashbookService.update(id, input);
  },

  async remove(id: string): Promise<void> {
    return cashbookService.remove(id);
  },
};
