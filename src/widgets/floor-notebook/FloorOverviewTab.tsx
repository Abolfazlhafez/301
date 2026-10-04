import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import { floorStagesApi } from "../../shared/api/floorStagesApi";
import { floorActivityApi } from "../../shared/api/floorActivityApi";
import { extractErrorMessage } from "../../shared/api/client";
import { UpdateFloorStageInput, type FloorStageWithStats } from "../../entities/FloorStage";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { useToast } from "../../shared/components/ToastProvider";
import { FloorStageTimeline } from "./FloorStageTimeline";
import { FloorStageDetailDialog } from "./FloorStageDetailDialog";
import { FloorActivityFeed } from "./FloorActivityFeed";

interface FloorOverviewTabProps {
  floorId: string;
}

export function FloorOverviewTab({ floorId }: FloorOverviewTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedStage, setSelectedStage] = useState<FloorStageWithStats | null>(null);
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [newStageWeight, setNewStageWeight] = useState("10");

  const stagesQuery = useQuery({
    queryKey: ["floorStages", floorId],
    queryFn: () => floorStagesApi.listByFloor(floorId),
  });

  const activityQuery = useQuery({
    queryKey: ["floorActivity", floorId],
    queryFn: () => floorActivityApi.listByFloor(floorId, 20),
  });

  const createStageMutation = useMutation({
    mutationFn: () => floorStagesApi.create({ floorId, title: newStageTitle.trim(), weight: Number(newStageWeight) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["floorStages", floorId] }); queryClient.invalidateQueries({ queryKey: ["floors", floorId] }); setAddStageOpen(false); setNewStageTitle(""); setNewStageWeight("10"); showToast(t("floor.toasts.stageUpdated") as string, "success"); },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: string) => floorStagesApi.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["floorStages", floorId] }); queryClient.invalidateQueries({ queryKey: ["floors", floorId] }); queryClient.invalidateQueries({ queryKey: ["floorActivity", floorId] }); setSelectedStage(null); showToast(t("floor.toasts.stageUpdated") as string, "success"); },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const moveStageMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: "up" | "down" }) => floorStagesApi.swapOrder(id, direction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floorStages", floorId] });
      queryClient.invalidateQueries({ queryKey: ["floors", floorId] });
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFloorStageInput }) => floorStagesApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floorStages", floorId] });
      queryClient.invalidateQueries({ queryKey: ["floors", floorId] });
      queryClient.invalidateQueries({ queryKey: ["floorActivity", floorId] });
      showToast(t("floor.toasts.stageUpdated") as string, "success");
      setSelectedStage(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  if (stagesQuery.isLoading) return <LoadingState />;
  if (stagesQuery.isError) {
    return <ErrorState message={extractErrorMessage(stagesQuery.error)} onRetry={() => stagesQuery.refetch()} />;
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={700}>{t("floor.overview.timelineTitle")}</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAddStageOpen(true)}>{t("floor.actions.addStage")}</Button>
        </Stack>
        <FloorStageTimeline stages={stagesQuery.data ?? []} onSelect={setSelectedStage} onMove={(stage, direction) => moveStageMutation.mutate({ id: stage.id, direction })} movingStageId={moveStageMutation.isPending ? moveStageMutation.variables?.id ?? null : null} />
      </Box>

      <Box>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>
          {t("floor.overview.activityTitle")}
        </Typography>
        <FloorActivityFeed events={activityQuery.data ?? []} />
      </Box>

      <FloorStageDetailDialog
        open={!!selectedStage}
        floorId={floorId}
        stage={selectedStage}
        loading={updateStageMutation.isPending}
        onClose={() => setSelectedStage(null)}
        onSubmit={(input) => selectedStage && updateStageMutation.mutate({ id: selectedStage.id, input })}
        onDelete={() => selectedStage && deleteStageMutation.mutate(selectedStage.id)}
      />

      <Dialog open={addStageOpen} onClose={() => setAddStageOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("floor.form.stage.addTitle")}</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}>
          <TextField label={t("floor.form.stage.title")} value={newStageTitle} onChange={(e) => setNewStageTitle(e.target.value)} autoFocus />
          <TextField label={t("floor.form.stage.weight")} value={newStageWeight} onChange={(e) => setNewStageWeight(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setAddStageOpen(false)} color="inherit">{t("floor.form.stage.cancel")}</Button><Button variant="contained" onClick={() => createStageMutation.mutate()} disabled={!newStageTitle.trim() || createStageMutation.isPending}>{t("floor.form.stage.save")}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
