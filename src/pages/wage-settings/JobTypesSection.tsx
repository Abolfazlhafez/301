import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Box, Button, Chip, IconButton, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import { jobTypeApi } from "../../shared/api/jobTypeApi";
import type { JobType } from "../../entities/JobType";
import { JobTypeIcon } from "../../shared/components/JobTypeIcon";
import { EmptyState } from "../../shared/components/EmptyState";
import { AnimatedList } from "../../shared/components/AnimatedList";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { extractErrorMessage } from "../../shared/api/client";
import { JobTypeFormDialog } from "../../widgets/wage-system/JobTypeFormDialog";

export function JobTypesSection() {
  const { t } = useTranslation();
  const categoryLabels: Record<string, string> = {
    structure: t("jobType.category.structure"),
    masonry: t("jobType.category.masonry"),
    finishing: t("jobType.category.finishing"),
    flooring: t("jobType.category.flooring"),
    mep: t("jobType.category.mep"),
    installation: t("jobType.category.installation"),
    sitework: t("jobType.category.sitework"),
    other: t("jobType.category.other"),
  };
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data: jobTypes = [], isLoading } = useQuery({
    queryKey: ["job-types"],
    queryFn: () => jobTypeApi.list(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["job-types"] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => jobTypeApi.remove(id),
    onSuccess: () => {
      invalidate();
      showToast(t("jobType.toastDeleted") as string, "success");
      setDeletingId(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => jobTypeApi.restoreToDefault(id),
    onSuccess: () => {
      invalidate();
      showToast(t("jobType.toastRestored") as string, "success");
      setRestoringId(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => jobTypeApi.duplicate(id),
    onSuccess: () => {
      invalidate();
      showToast(t("jobType.toastDuplicated") as string, "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const editingJobType = jobTypes.find((j) => j.id === editingId) ?? null;
  const deletingJobType = jobTypes.find((j) => j.id === deletingId) ?? null;
  const restoringJobType = jobTypes.find((j) => j.id === restoringId) ?? null;

  const grouped = jobTypes.reduce<Record<string, JobType[]>>((acc, jt) => {
    (acc[jt.category] ??= []).push(jt);
    return acc;
  }, {});

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => {
          setEditingId(null);
          setFormOpen(true);
        }}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("jobType.createTitle")}
      </Button>

      {!isLoading && jobTypes.length === 0 && (
        <EmptyState icon={<WorkOutlineIcon fontSize="inherit" />} title={t("jobType.emptyTitle") as string} />
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <Box key={category}>
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1}>
            {categoryLabels[category] ?? category}
          </Typography>
          <AnimatedList spacing={1}>
            {items.map((jt) => (
              <Stack
                key={jt.id}
                direction="row"
                alignItems="center"
                spacing={1.25}
                sx={{ p: 1.25, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
              >
                <JobTypeIcon iconKey={jt.iconKey} sx={{ color: "primary.main" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {jt.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {jt.wageNote}
                  </Typography>
                </Box>
                {jt.isBuiltIn && <Chip label={t("jobType.builtInChip") as string} size="small" sx={{ height: 20 }} />}
                <Stack direction="row">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditingId(jt.id);
                      setFormOpen(true);
                    }}
                    aria-label={t("jobType.editAction") as string}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => duplicateMutation.mutate(jt.id)} aria-label={t("jobType.duplicateAction") as string}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                  {jt.isBuiltIn && jt.originalSnapshot && (
                    <IconButton size="small" onClick={() => setRestoringId(jt.id)} aria-label={t("jobType.restoreAction") as string}>
                      <RestartAltIcon fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton size="small" color="error" onClick={() => setDeletingId(jt.id)} aria-label={t("jobType.deleteAction") as string}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            ))}
          </AnimatedList>
        </Box>
      ))}

      <JobTypeFormDialog open={formOpen} existing={editingJobType} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={!!deletingId}
        title={t("jobType.deleteConfirmTitle") as string}
        description={
          deletingJobType ? (t("jobType.deleteConfirmDescription", { name: deletingJobType.name }) as string) : ""
        }
        confirmLabel={t("jobType.deleteAction") as string}
        loading={deleteMutation.isPending}
        onCancel={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
      />

      <ConfirmDialog
        open={!!restoringId}
        title={t("jobType.restoreConfirmTitle") as string}
        description={restoringJobType ? (t("jobType.restoreConfirmDescription", { name: restoringJobType.name }) as string) : ""}
        confirmLabel={t("jobType.restoreAction") as string}
        confirmColor="primary"
        loading={restoreMutation.isPending}
        onCancel={() => setRestoringId(null)}
        onConfirm={() => restoringId && restoreMutation.mutate(restoringId)}
      />
    </Box>
  );
}
