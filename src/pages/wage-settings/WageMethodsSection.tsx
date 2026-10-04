import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Chip, IconButton, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import FunctionsIcon from "@mui/icons-material/Functions";
import { wageMethodApi } from "../../shared/api/wageMethodApi";
import { formatWageFormula } from "../../core/wageFormula";
import { EmptyState } from "../../shared/components/EmptyState";
import { AnimatedList } from "../../shared/components/AnimatedList";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { extractErrorMessage } from "../../shared/api/client";
import { WageMethodFormDialog } from "../../widgets/wage-system/WageMethodFormDialog";

export function WageMethodsSection() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingUsageCount, setDeletingUsageCount] = useState(0);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["wage-methods"],
    queryFn: () => wageMethodApi.list(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["wage-methods"] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wageMethodApi.remove(id),
    onSuccess: () => {
      invalidate();
      showToast("روش محاسبه حذف شد.", "success");
      setDeletingId(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => wageMethodApi.restoreToDefault(id),
    onSuccess: () => {
      invalidate();
      showToast("روش محاسبه به حالت پیش‌فرض بازگردانده شد.", "success");
      setRestoringId(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => wageMethodApi.duplicate(id),
    onSuccess: () => {
      invalidate();
      showToast("یک کپی از روش محاسبه ساخته شد.", "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  async function handleDeleteRequest(id: string) {
    const usageCount = await wageMethodApi.countUsages(id);
    setDeletingUsageCount(usageCount);
    setDeletingId(id);
  }

  const editingMethod = methods.find((m) => m.id === editingId) ?? null;
  const deletingMethod = methods.find((m) => m.id === deletingId) ?? null;
  const restoringMethod = methods.find((m) => m.id === restoringId) ?? null;

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
        افزودن روش محاسبهٔ جدید
      </Button>

      {!isLoading && methods.length === 0 && (
        <EmptyState icon={<FunctionsIcon fontSize="inherit" />} title="هنوز روش محاسبه‌ای تعریف نشده" />
      )}

      <AnimatedList spacing={1}>
        {methods.map((m) => {
          const variableLabels = Object.fromEntries(m.formula.variables.map((v) => [v.key, v.label]));
          return (
            <Box
              key={m.id}
              sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
            >
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {m.formula.name}
                    </Typography>
                    {m.isBuiltIn && <Chip label="پیش‌فرض" size="small" sx={{ height: 20 }} />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {m.formula.description}
                  </Typography>
                  <Typography variant="caption" fontFamily="monospace" color="primary.main" dir="ltr" sx={{ display: "block", mt: 0.5 }}>
                    {formatWageFormula(m.formula.root, variableLabels)}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.5} mt={1}>
                <IconButton
                  size="small"
                  onClick={() => {
                    setEditingId(m.id);
                    setFormOpen(true);
                  }}
                  aria-label="ویرایش"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => duplicateMutation.mutate(m.id)} aria-label="کپی">
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
                {m.isBuiltIn && m.originalSnapshot && (
                  <IconButton size="small" onClick={() => setRestoringId(m.id)} aria-label="بازگردانی به پیش‌فرض">
                    <RestartAltIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton size="small" color="error" onClick={() => handleDeleteRequest(m.id)} aria-label="حذف">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          );
        })}
      </AnimatedList>

      <WageMethodFormDialog open={formOpen} existing={editingMethod} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={!!deletingId}
        title="حذف روش محاسبه"
        description={
          deletingMethod
            ? deletingUsageCount > 0
              ? `هشدار: ${deletingUsageCount} آیتم دستمزد نیرو هم‌اکنون از «${deletingMethod.formula.name}» استفاده می‌کنند. با حذف این روش، آن آیتم‌ها به‌طور خودکار غیرفعال می‌شوند (تاریخچهٔ محاسبات قبلی‌شان حفظ می‌شود) تا روش دیگری برایشان انتخاب کنید. آیا مطمئن هستید؟`
              : `آیا از حذف «${deletingMethod.formula.name}» مطمئن هستید؟`
            : ""
        }
        confirmLabel="حذف"
        loading={deleteMutation.isPending}
        onCancel={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
      />

      <ConfirmDialog
        open={!!restoringId}
        title="بازگردانی به پیش‌فرض"
        description={restoringMethod ? `«${restoringMethod.formula.name}» به حالت اولیهٔ خودش بازمی‌گردد.` : ""}
        confirmLabel="بازگردانی"
        confirmColor="primary"
        loading={restoreMutation.isPending}
        onCancel={() => setRestoringId(null)}
        onConfirm={() => restoringId && restoreMutation.mutate(restoringId)}
      />
    </Box>
  );
}
