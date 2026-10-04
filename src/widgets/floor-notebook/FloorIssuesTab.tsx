import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Card, CardContent, Chip, Divider, Fab, IconButton, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import EventIcon from "@mui/icons-material/Event";
import { useTranslation } from "react-i18next";
import { floorIssuesApi } from "../../shared/api/floorIssuesApi";
import { floorStagesApi } from "../../shared/api/floorStagesApi";
import { floorTasksApi } from "../../shared/api/floorTasksApi";
import { floorActivityApi } from "../../shared/api/floorActivityApi";
import { extractErrorMessage } from "../../shared/api/client";
import { CreateFloorIssueInput, FloorIssue, UpdateFloorIssueInput } from "../../entities/FloorIssue";
import { getOverdueLabelText, getRelativeDayLabel } from "../../shared/utils/jalaliDate";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { FloorIssueFormDialog } from "./FloorIssueFormDialog";
import { FloorActivityFeed } from "./FloorActivityFeed";
import { PhotoGalleryDialog } from "../photo-gallery/PhotoGalleryDialog";

interface FloorIssuesTabProps {
  floorId: string;
}

const SEVERITY_COLOR: Record<string, "default" | "info" | "warning" | "error"> = {
  low: "default",
  medium: "info",
  high: "warning",
  critical: "error",
};

const STATUS_COLOR: Record<string, "default" | "info" | "success" | "error"> = {
  open: "default",
  in_progress: "info",
  resolved: "success",
  rejected: "error",
};

/**
 * برچسب کوچک موعد برای هر مشکل. مشکل «باز» حساب می‌شود اگر resolved یا
 * rejected نشده باشد — مشابه قاعدهٔ overdue کارها در floorService، اما
 * چون تا امروز هیچ‌جا (نه لیست، نه امتیاز سلامت) موعد مشکلات را حساب
 * نمی‌کرد، اینجا فقط یک نمایش UI است، بدون تغییر در healthScore.
 */
function issueDueInfo(issue: FloorIssue): { label: string; overdue: boolean } | null {
  if (!issue.dueDate) return null;
  const label = getRelativeDayLabel(issue.dueDate);
  const isOpen = issue.status !== "resolved" && issue.status !== "rejected";
  return { label, overdue: isOpen && label === getOverdueLabelText() };
}

export function FloorIssuesTab({ floorId }: FloorIssuesTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<FloorIssue | null>(null);
  const [deletingIssue, setDeletingIssue] = useState<FloorIssue | null>(null);
  const [photosIssue, setPhotosIssue] = useState<FloorIssue | null>(null);

  const issuesQuery = useQuery({
    queryKey: ["floorIssues", floorId],
    queryFn: () => floorIssuesApi.listByFloor(floorId),
  });

  const stagesQuery = useQuery({
    queryKey: ["floorStages", floorId],
    queryFn: () => floorStagesApi.listByFloor(floorId),
  });

  const tasksQuery = useQuery({
    queryKey: ["floorTasks", floorId],
    queryFn: () => floorTasksApi.listByFloor(floorId),
  });

  const activityQuery = useQuery({
    queryKey: ["floorActivity", floorId],
    queryFn: () => floorActivityApi.listByFloor(floorId, 20),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["floorIssues", floorId] });
    queryClient.invalidateQueries({ queryKey: ["floorStages", floorId] });
    queryClient.invalidateQueries({ queryKey: ["floors", floorId] });
    queryClient.invalidateQueries({ queryKey: ["floorActivity", floorId] });
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateFloorIssueInput) => floorIssuesApi.create(input),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.issueCreated") as string, "success");
      setFormOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFloorIssueInput }) => floorIssuesApi.update(id, input),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.issueUpdated") as string, "success");
      setFormOpen(false);
      setEditingIssue(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => floorIssuesApi.remove(id),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.issueDeleted") as string, "success");
      setDeletingIssue(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  function handleSubmit(input: CreateFloorIssueInput | UpdateFloorIssueInput) {
    if (editingIssue) {
      updateMutation.mutate({ id: editingIssue.id, input });
    } else {
      createMutation.mutate(input as CreateFloorIssueInput);
    }
  }

  function toggleResolved(issue: FloorIssue) {
    updateMutation.mutate({ id: issue.id, input: { status: issue.status === "resolved" ? "open" : "resolved" } });
  }

  const issues = issuesQuery.data ?? [];

  return (
    <Box display="flex" flexDirection="column" gap={2} sx={{ position: "relative", minHeight: 200, pb: 8 }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {t("floor.issuesTab.title")}
      </Typography>

      {issues.length === 0 ? (
        <EmptyState icon={<ReportProblemIcon fontSize="inherit" />} title={t("floor.issuesTab.empty") as string} />
      ) : (
        <Stack spacing={1}>
          {issues.map((issue) => {
            const due = issueDueInfo(issue);
            return (
            <Card key={issue.id} variant="outlined">
              <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{ textDecoration: issue.status === "resolved" ? "line-through" : "none" }}
                      >
                        {issue.title}
                      </Typography>
                      <Chip size="small" label={t(`floor.issueSeverity.${issue.severity}`)} color={SEVERITY_COLOR[issue.severity]} sx={{ height: 18, fontSize: 10 }} />
                      <Chip size="small" label={t(`floor.issueStatus.${issue.status}`)} color={STATUS_COLOR[issue.status]} variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                      {due && (
                        <Chip
                          size="small"
                          icon={<EventIcon fontSize="small" />}
                          label={due.label}
                          color={due.overdue ? "error" : "default"}
                          variant={due.overdue ? "filled" : "outlined"}
                          sx={{ height: 18, fontSize: 10, "& .MuiChip-icon": { fontSize: 12 } }}
                        />
                      )}
                    </Stack>
                    {issue.description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {issue.description}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row">
                    <IconButton size="small" color={issue.status === "resolved" ? "success" : "default"} onClick={() => toggleResolved(issue)}>
                      <CheckCircleIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setPhotosIssue(issue)}
                      aria-label={t("floor.issuesTab.issuePhotos") as string}
                    >
                      <PhotoCameraIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingIssue(issue);
                        setFormOpen(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeletingIssue(issue)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
            );
          })}
        </Stack>
      )}

      <Divider />
      <Typography variant="subtitle1" fontWeight={700}>
        {t("floor.issuesTab.activityTitle")}
      </Typography>
      <FloorActivityFeed events={activityQuery.data ?? []} />

      <Fab
        color="primary"
        size="medium"
        onClick={() => {
          setEditingIssue(null);
          setFormOpen(true);
        }}
        sx={{ position: "fixed", bottom: 84, insetInlineStart: 20, zIndex: 5 }}
        aria-label={t("floor.issuesTab.addIssue") as string}
      >
        <AddIcon />
      </Fab>

      <FloorIssueFormDialog
        open={formOpen}
        floorId={floorId}
        stages={stagesQuery.data ?? []}
        tasks={tasksQuery.data ?? []}
        issue={editingIssue}
        loading={createMutation.isPending || updateMutation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />


      <PhotoGalleryDialog
        open={!!photosIssue}
        title={photosIssue ? `${t("floor.issuesTab.issuePhotos")} · ${photosIssue.title}` : t("floor.issuesTab.issuePhotos") as string}
        relatedType="floor"
        relatedId={photosIssue ? floorId : null}
        floorId={floorId}
        issueId={photosIssue?.id}
        onClose={() => setPhotosIssue(null)}
      />

      <ConfirmDialog
        open={!!deletingIssue}
        title={t("floor.issuesTab.title") as string}
        description={t("floor.dialogs.deleteIssueMessage") as string}
        confirmLabel={t("floor.dialogs.confirm") as string}
        loading={deleteMutation.isPending}
        onConfirm={() => deletingIssue && deleteMutation.mutate(deletingIssue.id)}
        onCancel={() => setDeletingIssue(null)}
      />
    </Box>
  );
}
