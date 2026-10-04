import { groupWagePaymentService } from "../../core/services/groupWagePaymentService";
import type { CreateGroupWagePaymentInput, GroupWagePayment } from "../../entities/WorkerGroup";

export const groupWagePaymentApi = {
  async listByGroup(groupId: string): Promise<GroupWagePayment[]> {
    return groupWagePaymentService.listByGroup(groupId);
  },
  async totalForGroup(groupId: string): Promise<number> {
    return groupWagePaymentService.totalForGroup(groupId);
  },
  async create(input: CreateGroupWagePaymentInput): Promise<GroupWagePayment> {
    return groupWagePaymentService.create(input);
  },
  async remove(id: string): Promise<void> {
    return groupWagePaymentService.remove(id);
  },
};
