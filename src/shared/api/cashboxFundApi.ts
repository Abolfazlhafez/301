import { cashboxFundService } from "../../core/services/cashboxFundService";
import { CashboxFund, CreateCashboxFundInput, UpdateCashboxFundInput } from "../../entities/CashboxFund";

export const cashboxFundApi = {
  async list(): Promise<CashboxFund[]> {
    return cashboxFundService.list();
  },

  async getDefault(): Promise<CashboxFund> {
    return cashboxFundService.getDefault();
  },

  async create(input: CreateCashboxFundInput): Promise<CashboxFund> {
    return cashboxFundService.create(input);
  },

  async update(id: string, input: UpdateCashboxFundInput): Promise<CashboxFund> {
    return cashboxFundService.update(id, input);
  },

  async setDefault(id: string): Promise<void> {
    return cashboxFundService.setDefault(id);
  },

  async remove(id: string): Promise<void> {
    return cashboxFundService.remove(id);
  },
};
