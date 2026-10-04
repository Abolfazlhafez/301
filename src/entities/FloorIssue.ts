export type FloorIssueSeverity = "low" | "medium" | "high" | "critical";

export const FLOOR_ISSUE_SEVERITIES: FloorIssueSeverity[] = ["low", "medium", "high", "critical"];

export type FloorIssueStatus = "open" | "in_progress" | "resolved" | "rejected";

export const FLOOR_ISSUE_STATUSES: FloorIssueStatus[] = ["open", "in_progress", "resolved", "rejected"];

export interface FloorIssue {
  id: string;
  floorId: string;
  stageId: string | null;
  taskId: string | null;
  title: string;
  description: string | null;
  severity: FloorIssueSeverity;
  status: FloorIssueStatus;
  assignedWorkerId: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFloorIssueInput {
  floorId: string;
  stageId?: string | null;
  taskId?: string | null;
  title: string;
  description?: string | null;
  severity?: FloorIssueSeverity;
  assignedWorkerId?: string | null;
  dueDate?: string | null;
}

export interface UpdateFloorIssueInput {
  stageId?: string | null;
  taskId?: string | null;
  title?: string;
  description?: string | null;
  severity?: FloorIssueSeverity;
  status?: FloorIssueStatus;
  assignedWorkerId?: string | null;
  dueDate?: string | null;
  resolutionNote?: string | null;
}
