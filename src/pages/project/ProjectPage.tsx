import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Fab, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LayersIcon from "@mui/icons-material/Layers";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { floorsApi } from "../../shared/api/floorsApi";
import { projectsApi } from "../../shared/api/projectsApi";
import { extractErrorMessage } from "../../shared/api/client";
import { CreateFloorInput, UpdateFloorInput } from "../../entities/Floor";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { useToast } from "../../shared/components/ToastProvider";
import { FloorFormDialog } from "../../widgets/floor-notebook/FloorFormDialog";
import { FloorCard } from "../../widgets/floor-notebook/FloorCard";
import { formatPercent } from "../../shared/utils/format";

export function ProjectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["activeProject"],
    queryFn: async () => {
      const id = await projectsApi.getActiveProjectId();
      const projects = await projectsApi.list();
      return projects.find((p) => p.id === id) ?? null;
    },
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["floors"],
    queryFn: () => floorsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateFloorInput) => floorsApi.create(input),
    onSuccess: (floor) => {
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      showToast(t("floor.toasts.floorCreated") as string, "success");
      setFormOpen(false);
      navigate(`/project/floors/${floor.id}`);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  function handleSubmit(input: CreateFloorInput | UpdateFloorInput) {
    createMutation.mutate(input as CreateFloorInput);
  }

  const avgProgress =
    data && data.length > 0 ? Math.round(data.reduce((acc, f) => acc + f.progress, 0) / data.length) : 0;

  return (
    <Box display="flex" flexDirection="column" gap={2} sx={{ position: "relative", minHeight: 200 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>{project?.name || t("floor.project.title")}</Typography>
        {project?.location ? (
          <Typography variant="body2" color="text.secondary">{project.location}</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">{t("floor.project.subtitle")}</Typography>
        )}
      </Box>

      {isLoading && <LoadingState message={t("common.loading", { defaultValue: "در حال بارگذاری..." }) as string} />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={<LayersIcon fontSize="inherit" />}
          title={t("floor.project.emptyTitle") as string}
          description={t("floor.project.emptyDescription") as string}
        />
      )}

      {data && data.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary">
            {t("floor.project.floorsCount", { count: data.length })} · {t("floor.project.avgProgress")}: {formatPercent(avgProgress)}
          </Typography>
          <Stack spacing={1.25}>
            {data.map((floor) => (
              <FloorCard key={floor.id} floor={floor} onClick={() => navigate(`/project/floors/${floor.id}`)} />
            ))}
          </Stack>
        </>
      )}

      <Fab
        color="primary"
        size="medium"
        onClick={() => setFormOpen(true)}
        sx={{ position: "fixed", bottom: 84, insetInlineStart: 20, zIndex: 5 }}
        aria-label={t("floor.project.addFloor") as string}
      >
        <AddIcon />
      </Fab>

      <FloorFormDialog
        open={formOpen}
        loading={createMutation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
