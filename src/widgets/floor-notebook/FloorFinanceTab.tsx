import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Box, Card, CardContent, Chip, Divider, IconButton, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import GroupsIcon from "@mui/icons-material/Groups";
import PaymentsIcon from "@mui/icons-material/Payments";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import { useTranslation } from "react-i18next";
import { floorsApi } from "../../shared/api/floorsApi";
import { floorWorkersApi } from "../../shared/api/floorWorkersApi";
import { floorStagesApi } from "../../shared/api/floorStagesApi";
import { floorTasksApi } from "../../shared/api/floorTasksApi";
import { cashbookApi } from "../../shared/api/cashbookApi";
import { extractErrorMessage } from "../../shared/api/client";
import { CreateFloorWorkerInput } from "../../entities/FloorWorker";
import { StatCard } from "../../shared/components/StatCard";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { formatCurrency } from "../../shared/utils/format";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import { FloorWorkerFormDialog } from "./FloorWorkerFormDialog";

interface FloorFinanceTabProps {
  floorId: string;
}

export function FloorFinanceTab({ floorId }: FloorFinanceTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const floorQuery = useQuery({
    queryKey: ["floors", floorId],
    queryFn: () => floorsApi.getById(floorId),
  });

  const workersQuery = useQuery({
    queryKey: ["floorWorkers", floorId],
    queryFn: () => floorWorkersApi.listByFloor(floorId),
  });

  const stagesQuery = useQuery({
    queryKey: ["floorStages", floorId],
    queryFn: () => floorStagesApi.listByFloor(floorId),
  });

  const tasksQuery = useQuery({
    queryKey: ["floorTasks", floorId],
    queryFn: () => floorTasksApi.listByFloor(floorId),
  });

  const cashbookQuery = useQuery({
    queryKey: ["cashbook", "floor", floorId],
    queryFn: () => cashbookApi.list({ floorId }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["floorWorkers", floorId] });
    queryClient.invalidateQueries({ queryKey: ["floorActivity", floorId] });
  }

  const addMutation = useMutation({
    mutationFn: (input: CreateFloorWorkerInput) => floorWorkersApi.create(input),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.workerAdded") as string, "success");
      setFormOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => floorWorkersApi.remove(id),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.workerRemoved") as string, "success");
      setRemovingId(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const tasks = tasksQuery.data ?? [];
  const estimatedTotal = tasks.reduce((acc, tk) => acc + (tk.estimatedCost ?? 0), 0);
  const actualTotal = tasks.reduce((acc, tk) => acc + (tk.actualCost ?? 0), 0);
  const linkedTotal = (cashbookQuery.data ?? []).reduce(
    (acc, e) => acc + (e.type === "deposit" ? 0 : e.amount),
    0
  );
  const workers = workersQuery.data ?? [];
  const today = getTodayIso();
  const linkedEntries = cashbookQuery.data ?? [];
  const floorArea = floorQuery.data?.area ?? null;
  const costPerSquareMeter = floorArea && floorArea > 0 ? linkedTotal / floorArea : null;
  const todayCost = linkedEntries.filter((e) => e.date === today && e.type !== "deposit").reduce((sum, e) => sum + e.amount, 0);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction="row" spacing={1.25}>
        <Box sx={{ flex: 1 }}>
          <StatCard title={t("floor.financeTab.linkedTotal") as string} value={formatCurrency(linkedTotal)} icon={<PaymentsIcon />} color="#16a34a" />
        </Box>
        <Box sx={{ flex: 1 }}>
          <StatCard title={t("floor.financeTab.estimatedTotal") as string} value={formatCurrency(estimatedTotal)} icon={<RequestQuoteIcon />} color="#2563eb" />
        </Box>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {t("floor.financeTab.actualTotal")}: {formatCurrency(actualTotal)}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={`${t("floor.financeTab.todayCost")}: ${formatCurrency(todayCost)}`} />
        {costPerSquareMeter !== null && (
          <Chip size="small" variant="outlined" label={`${t("floor.financeTab.costPerSquareMeter")}: ${formatCurrency(costPerSquareMeter)}`} />
        )}
      </Stack>

      {(stagesQuery.data ?? []).length > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>{t("floor.financeTab.stageCosts")}</Typography>
          <Stack spacing={0.75}>
            {(stagesQuery.data ?? []).map((stage) => {
              const amount = linkedEntries.filter((e) => e.stageId === stage.id && e.type !== "deposit").reduce((sum, e) => sum + e.amount, 0);
              return (
                <Stack key={stage.id} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" noWrap>{stage.isCustom ? stage.title : t(`floor.stageTitle.${stage.key}`)}</Typography>
                  <Chip size="small" variant={amount ? "filled" : "outlined"} label={formatCurrency(amount)} />
                </Stack>
              );
            })}
          </Stack>
        </Box>
      )}

      <Divider />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={700}>
          {t("floor.financeTab.workersTitle")}
        </Typography>
        <IconButton color="primary" onClick={() => setFormOpen(true)} aria-label={t("floor.financeTab.addWorker") as string}>
          <AddIcon />
        </IconButton>
      </Stack>

      {workers.length === 0 ? (
        <EmptyState icon={<GroupsIcon fontSize="inherit" />} title={t("floor.financeTab.workersEmpty") as string} />
      ) : (
        <Stack spacing={1}>
          {workers.map((w) => (
            <Card key={w.id} variant="outlined">
              <CardContent sx={{ py: 1, "&:last-child": { pb: 1 }, display: "flex", alignItems: "center", gap: 1.5 }}>
                <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{w.workerFullName?.[0] ?? "?"}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {w.workerFullName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {w.role || w.workerPosition}
                  </Typography>
                </Box>
                <IconButton size="small" color="error" onClick={() => setRemovingId(w.id)}>
                  <PersonRemoveIcon fontSize="small" />
                </IconButton>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <FloorWorkerFormDialog
        open={formOpen}
        floorId={floorId}
        stages={stagesQuery.data ?? []}
        existingWorkerIds={workers.map((w) => w.workerId)}
        loading={addMutation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={(input) => addMutation.mutate(input)}
      />

      <ConfirmDialog
        open={!!removingId}
        title={t("floor.financeTab.workersTitle") as string}
        description={t("floor.dialogs.removeWorkerMessage") as string}
        confirmLabel={t("floor.dialogs.confirm") as string}
        loading={removeMutation.isPending}
        onConfirm={() => removingId && removeMutation.mutate(removingId)}
        onCancel={() => setRemovingId(null)}
      />
    </Box>
  );
}
