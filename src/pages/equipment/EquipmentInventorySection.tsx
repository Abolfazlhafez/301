import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Card, CardContent, Chip, Fab, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ConstructionIcon from "@mui/icons-material/Construction";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SearchIcon from "@mui/icons-material/Search";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import { equipmentApi } from "../../shared/api/equipmentApi";
import { extractErrorMessage } from "../../shared/api/client";
import { Equipment, CreateEquipmentInput, UpdateEquipmentInput } from "../../entities/Equipment";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { EquipmentFormDialog } from "../../widgets/equipment-form/EquipmentFormDialog";
import { PhotoGalleryDialog } from "../../widgets/photo-gallery/PhotoGalleryDialog";
import { formatNumber, matchesSearchTerm } from "../../shared/utils/format";
import { exportRowsAsCsv } from "../../shared/utils/exportCsv";
import { getTodayIso } from "../../shared/utils/jalaliDate";

export function EquipmentInventorySection() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [deletingEquipment, setDeletingEquipment] = useState<Equipment | null>(null);
  const [galleryEquipment, setGalleryEquipment] = useState<Equipment | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["equipment", "with-availability"],
    queryFn: () => equipmentApi.listWithAvailability(),
  });

  // فیلتر جستجو (نام/توضیحات) و «فقط کمبود موجودی» — وقتی تعداد اقلام
  // انبار زیاد می‌شود (چند ده قلم)، پیدا کردن یک قلم خاص یا دیدن سریع
  // چیزهایی که تمام شده‌اند بدون اسکرول کامل فهرست ممکن می‌شود.
  const filteredData = useMemo(() => {
    if (!data) return [];
    const term = search.trim();
    let list = term
      ? data.filter((eq) => matchesSearchTerm(`${eq.name} ${eq.code} ${eq.description ?? ""}`, term))
      : data;
    if (lowStockOnly) list = list.filter((eq) => eq.totalQuantity > 0 && eq.availableQuantity === 0);
    return list;
  }, [data, search, lowStockOnly]);

  const lowStockCount = useMemo(
    () => (data ?? []).filter((eq) => eq.totalQuantity > 0 && eq.availableQuantity === 0).length,
    [data]
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["equipment"] });
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateEquipmentInput) => equipmentApi.create(input),
    onSuccess: () => {
      invalidate();
      showToast("لوازم با موفقیت اضافه شد.", "success");
      setFormOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEquipmentInput }) =>
      equipmentApi.update(id, input),
    onSuccess: () => {
      invalidate();
      showToast("تغییرات ذخیره شد.", "success");
      setFormOpen(false);
      setEditingEquipment(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => equipmentApi.remove(id),
    onSuccess: () => {
      invalidate();
      showToast("لوازم حذف شد.", "success");
      setDeletingEquipment(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  function handleSubmit(input: CreateEquipmentInput | UpdateEquipmentInput) {
    if (editingEquipment) {
      updateMutation.mutate({ id: editingEquipment.id, input });
    } else {
      createMutation.mutate(input as CreateEquipmentInput);
    }
  }

  async function handleExportCsv() {
    if (!filteredData || filteredData.length === 0) return;
    setIsExportingCsv(true);
    try {
      const headers = ["کد", "نام لوازم", "توضیحات", "واحد", "موجودی کل", "تحویل‌داده‌شده", "در دسترس"];
      const rows = filteredData.map((eq) => [
        eq.code,
        eq.name,
        eq.description ?? "",
        eq.unit,
        eq.totalQuantity,
        eq.assignedQuantity,
        eq.availableQuantity,
      ]);
      await exportRowsAsCsv(headers, rows, `لوازم-کارگاه-${getTodayIso()}.csv`);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setIsExportingCsv(false);
    }
  }

  return (
    <Box display="flex" flexDirection="column" gap={2} sx={{ position: "relative", minHeight: 200 }}>
      {isLoading && <LoadingState message="در حال بارگذاری لوازم..." />}
      {isError && <ErrorState message={extractErrorMessage(error)} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={<ConstructionIcon fontSize="inherit" />}
          title="هنوز لوازمی ثبت نشده است."
          description="با دکمه + اولین قلم لوازم کارگاه را اضافه کنید."
        />
      )}

      {data && data.length > 0 && (
        <Stack spacing={1.25}>
          <TextField
            placeholder="جستجوی نام، کد یا توضیحات لوازم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              icon={<WarningAmberIcon fontSize="small" />}
              label={lowStockCount > 0 ? `فقط تمام‌شده‌ها (${lowStockCount})` : "فقط تمام‌شده‌ها"}
              onClick={() => setLowStockOnly((v) => !v)}
              color={lowStockOnly ? "error" : "default"}
              variant={lowStockOnly ? "filled" : "outlined"}
              disabled={lowStockCount === 0}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadIcon fontSize="small" />}
              onClick={handleExportCsv}
              disabled={isExportingCsv || filteredData.length === 0}
            >
              خروجی اکسل
            </Button>
          </Stack>

          {filteredData.length === 0 ? (
            <EmptyState
              title={lowStockOnly ? "چیزی تمام نشده است." : "چیزی با این عبارت پیدا نشد."}
              description="عبارت جستجو یا فیلتر را تغییر دهید."
            />
          ) : (
            filteredData.map((eq) => (
            <Card key={eq.id} variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle1" fontWeight={700}>
                        {eq.name}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={eq.code}
                        sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
                      />
                      {eq.totalQuantity > 0 && eq.availableQuantity === 0 && (
                        <Box
                          component="span"
                          sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "error.main",
                            bgcolor: "error.main",
                            opacity: 0.12,
                            px: 0.75,
                            py: 0.1,
                            borderRadius: 1,
                          }}
                        >
                          تمام شد
                        </Box>
                      )}
                    </Stack>
                    {eq.description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {eq.description}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={2} mt={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        کل: {formatNumber(eq.totalQuantity)} {eq.unit}
                      </Typography>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        color={eq.availableQuantity > 0 ? "success.main" : "error.main"}
                      >
                        در دسترس: {formatNumber(eq.availableQuantity)} {eq.unit}
                      </Typography>
                    </Stack>
                  </Box>
                  <Stack direction="row">
                    <IconButton size="small" color="info" onClick={() => setGalleryEquipment(eq)}>
                      <PhotoLibraryIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingEquipment(eq);
                        setFormOpen(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeletingEquipment(eq)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
            ))
          )}
        </Stack>
      )}

      <Fab
        color="primary"
        size="medium"
        onClick={() => {
          setEditingEquipment(null);
          setFormOpen(true);
        }}
        sx={{ position: "fixed", bottom: 84, left: 20, zIndex: 5 }}
        aria-label="افزودن لوازم"
      >
        <AddIcon />
      </Fab>

      <EquipmentFormDialog
        open={formOpen}
        equipment={editingEquipment}
        loading={createMutation.isPending || updateMutation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deletingEquipment}
        title="حذف لوازم"
        description={
          deletingEquipment ? `آیا از حذف «${deletingEquipment.name}» مطمئن هستید؟` : ""
        }
        confirmLabel="حذف"
        loading={deleteMutation.isPending}
        onConfirm={() => deletingEquipment && deleteMutation.mutate(deletingEquipment.id)}
        onCancel={() => setDeletingEquipment(null)}
      />

      <PhotoGalleryDialog
        open={!!galleryEquipment}
        title={galleryEquipment ? `گالری عکس — ${galleryEquipment.name}` : ""}
        relatedType="equipment"
        relatedId={galleryEquipment?.id ?? null}
        onClose={() => setGalleryEquipment(null)}
      />
    </Box>
  );
}
