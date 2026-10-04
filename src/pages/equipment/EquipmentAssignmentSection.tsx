import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Box, Button, Card, CardContent, Chip, Fab, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AssignmentReturnIcon from "@mui/icons-material/AssignmentReturn";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import { equipmentApi } from "../../shared/api/equipmentApi";
import { equipmentAssignmentApi } from "../../shared/api/equipmentAssignmentApi";
import { workersApi } from "../../shared/api/workersApi";
import { extractErrorMessage } from "../../shared/api/client";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { useToast } from "../../shared/components/ToastProvider";
import { EquipmentAssignFormDialog } from "../../widgets/equipment-form/EquipmentAssignFormDialog";
import { toJalaliShort, getTodayIso, daysBetweenIso } from "../../shared/utils/jalaliDate";
import { formatNumber } from "../../shared/utils/format";

export function EquipmentAssignmentSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);

  const { data: equipmentList, isLoading: equipLoading } = useQuery({
    queryKey: ["equipment", "with-availability"],
    queryFn: () => equipmentApi.listWithAvailability(),
  });

  const { data: workers } = useQuery({
    queryKey: ["workers"],
    queryFn: () => workersApi.list({ isActive: true }),
  });

  const {
    data: assignments,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["equipment-assignments"],
    queryFn: () => equipmentAssignmentApi.list(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["equipment-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["equipment"] });
  }

  const createMutation = useMutation({
    mutationFn: (input: {
      equipmentId: string;
      workerId: string;
      quantity: number;
      assignedDate: string;
      note: string | null;
    }) => equipmentAssignmentApi.create(input),
    onSuccess: () => {
      invalidate();
      showToast(t("equipment.assignmentSection.toastAssigned") as string, "success");
      setFormOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const returnMutation = useMutation({
    mutationFn: (id: string) => equipmentAssignmentApi.returnItem(id, getTodayIso()),
    onSuccess: () => {
      invalidate();
      showToast(t("equipment.assignmentSection.toastReturned") as string, "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const workerName = (workerId: string) => {
    const w = workers?.find((x) => x.id === workerId);
    return w ? `${w.firstName} ${w.lastName}` : "—";
  };
  const equipmentName = (equipmentId: string) => {
    const eq = equipmentList?.find((x) => x.id === equipmentId);
    return eq ? `${eq.name} (${eq.unit})` : "—";
  };

  return (
    <Box display="flex" flexDirection="column" gap={2} sx={{ position: "relative", minHeight: 200 }}>
      {isLoading && <LoadingState message={t("common.loading") as string} />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {assignments && assignments.length === 0 && (
        <EmptyState
          icon={<Inventory2Icon fontSize="inherit" />}
          title={t("equipment.assignmentSection.emptyTitle") as string}
          description={t("equipment.assignmentSection.emptyDescription") as string}
        />
      )}

      {assignments && assignments.length > 0 && (
        <Stack spacing={1.25}>
          {assignments.map((a) => (
            <Card key={a.id} variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {equipmentName(a.equipmentId)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("equipment.assignmentSection.workerLabel")}: {workerName(a.workerId)}
                    </Typography>
                    <Stack direction="row" spacing={1} mt={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="caption" color="text.secondary">
                        {t("equipment.assignmentSection.quantityLabel")}: {formatNumber(a.quantity)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("equipment.assignmentSection.assignedDateLabel")}: {toJalaliShort(a.assignedDate)}
                      </Typography>
                      {a.returnedDate ? (
                        <Chip
                          label={t("equipment.assignmentSection.returnedOn", { date: toJalaliShort(a.returnedDate) }) as string}
                          size="small"
                          color="success"
                        />
                      ) : (
                        <>
                          <Chip label={t("equipment.assignmentSection.withWorker") as string} size="small" color="warning" />
                          {/* تعداد روزهای «هنوز برنگشته» — کمک می‌کند بدون
                              محاسبهٔ ذهنی از روی تاریخ تخصیص، تجهیزاتی که
                              مدت زیادی نزد نیرو مانده‌اند در نگاه اول دیده
                              شوند. فقط وقتی بیش از صفر روز گذشته نمایش داده
                              می‌شود (تخصیص همین امروز چیزی اضافه نمی‌گوید). */}
                          {daysBetweenIso(a.assignedDate, getTodayIso()) > 0 && (
                            <Chip
                              label={t("equipment.assignmentSection.daysInUse", {
                                count: daysBetweenIso(a.assignedDate, getTodayIso()),
                              }) as string}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </>
                      )}
                    </Stack>
                    {a.note && (
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        {a.note}
                      </Typography>
                    )}
                  </Box>
                  {!a.returnedDate && (
                    <Button
                      size="small"
                      startIcon={<AssignmentReturnIcon />}
                      onClick={() => returnMutation.mutate(a.id)}
                      disabled={returnMutation.isPending}
                    >
                      {t("equipment.assignmentSection.returnAction")}
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Fab
        color="primary"
        size="medium"
        onClick={() => setFormOpen(true)}
        disabled={equipLoading}
        sx={{ position: "fixed", bottom: 84, left: 20, zIndex: 5 }}
        aria-label={t("equipment.assignmentSection.fabAriaLabel") as string}
      >
        <AddIcon />
      </Fab>

      <EquipmentAssignFormDialog
        open={formOpen}
        equipmentList={equipmentList || []}
        workers={workers || []}
        loading={createMutation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={(input) => createMutation.mutate(input)}
      />
    </Box>
  );
}
