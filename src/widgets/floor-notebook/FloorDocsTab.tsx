import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Fab, IconButton, Stack, Typography, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import DescriptionIcon from "@mui/icons-material/Description";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import { useTranslation } from "react-i18next";
import { floorPlansApi } from "../../shared/api/floorPlansApi";
import { extractErrorMessage } from "../../shared/api/client";
import { CreateFloorPlanInput, FloorPlan } from "../../entities/FloorPlan";
import { EmptyState } from "../../shared/components/EmptyState";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { PhotoGallery } from "../photo-gallery/PhotoGallery";
import { FloorPlanFormDialog } from "./FloorPlanFormDialog";
import { photosApi, getPhotoUrl } from "../../shared/api/photosApi";

interface FloorDocsTabProps {
  floorId: string;
}

export function FloorDocsTab({ floorId }: FloorDocsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [revisionOf, setRevisionOf] = useState<FloorPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<FloorPlan | null>(null);
  const [viewingPlan, setViewingPlan] = useState<FloorPlan | null>(null);
  const [historyPlan, setHistoryPlan] = useState<FloorPlan | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["floorPlans", floorId],
    queryFn: () => floorPlansApi.listByFloor(floorId),
  });

  const revisionHistoryQuery = useQuery({
    queryKey: ["floorPlanRevisions", historyPlan?.id],
    queryFn: () => floorPlansApi.listRevisionChain(historyPlan!.id),
    enabled: !!historyPlan,
  });

  const planPhotoQuery = useQuery({
    queryKey: ["floorPlanPhoto", viewingPlan?.filePhotoId],
    queryFn: () => photosApi.getById(viewingPlan!.filePhotoId!),
    enabled: !!viewingPlan?.filePhotoId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["floorPlans", floorId] });
    queryClient.invalidateQueries({ queryKey: ["floorActivity", floorId] });
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateFloorPlanInput) => floorPlansApi.create(input),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.planCreated") as string, "success");
      setFormOpen(false);
      setRevisionOf(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => floorPlansApi.remove(id),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.planDeleted") as string, "success");
      setDeletingPlan(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const plans = plansQuery.data ?? [];
  // فقط آخرین نسخهٔ فعال هر زنجیره نمایش داده می‌شود؛ نسخه‌های قدیمی حذف
  // نشده‌اند اما برای این‌که فهرست شلوغ نشود پشت «تاریخچهٔ نسخه‌ها» می‌مانند.
  const activePlans = plans.filter((p) => p.isActiveRevision);

  return (
    <Box display="flex" flexDirection="column" gap={2} sx={{ position: "relative", minHeight: 200, pb: 8 }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {t("floor.docsTab.plansTitle")}
      </Typography>

      {activePlans.length === 0 ? (
        <EmptyState icon={<DescriptionIcon fontSize="inherit" />} title={t("floor.docsTab.plansEmpty") as string} />
      ) : (
        <Stack spacing={1}>
          {activePlans.map((plan) => (
            <Card key={plan.id} variant="outlined">
              <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle2" fontWeight={700}>
                        {plan.title}
                      </Typography>
                      <Chip size="small" label={t(`floor.planCategory.${plan.category}`)} sx={{ height: 18, fontSize: 10 }} />
                      {plan.revision && (
                        <Chip size="small" variant="outlined" label={`Rev. ${plan.revision}`} sx={{ height: 18, fontSize: 10 }} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {t(`floor.planStatus.${plan.status}`)}
                      {plan.designer ? ` · ${plan.designer}` : ""}
                    </Typography>
                  </Box>
                  <Stack direction="row">
                    <IconButton
                      size="small"
                      onClick={() => setViewingPlan(plan)}
                      title={t("floor.planViewer.view") as string}
                      disabled={!plan.filePhotoId}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setHistoryPlan(plan)}
                      title={t("floor.docsTab.viewRevisions") as string}
                    >
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setRevisionOf(plan);
                        setFormOpen(true);
                      }}
                      title={t("floor.form.plan.newRevisionOf") as string}
                    >
                      <DescriptionIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeletingPlan(plan)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Fab
        color="primary"
        size="medium"
        onClick={() => {
          setRevisionOf(null);
          setFormOpen(true);
        }}
        sx={{ position: "fixed", bottom: 84, insetInlineStart: 20, zIndex: 5 }}
        aria-label={t("floor.docsTab.addPlan") as string}
      >
        <AddIcon />
      </Fab>

      <Divider />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={700}>
          {t("floor.docsTab.photosTitle")}
        </Typography>
        <Button size="small" startIcon={<CompareArrowsIcon />} onClick={() => setCompareOpen(true)}>
          {t("floor.docsTab.comparePhases")}
        </Button>
      </Stack>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="caption" fontWeight={700}>{t("floor.docsTab.phaseBefore")}</Typography>
          <PhotoGallery relatedType="floor" relatedId={floorId} floorId={floorId} phase="before" compact />
        </Box>
        <Box>
          <Typography variant="caption" fontWeight={700}>{t("floor.docsTab.phaseDuring")}</Typography>
          <PhotoGallery relatedType="floor" relatedId={floorId} floorId={floorId} phase="during" compact />
        </Box>
        <Box>
          <Typography variant="caption" fontWeight={700}>{t("floor.docsTab.phaseAfter")}</Typography>
          <PhotoGallery relatedType="floor" relatedId={floorId} floorId={floorId} phase="after" compact />
        </Box>
      </Stack>

      <Dialog open={compareOpen} onClose={() => setCompareOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t("floor.docsTab.compareTitle")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {([
              ["before", t("floor.docsTab.phaseBefore")],
              ["during", t("floor.docsTab.phaseDuring")],
              ["after", t("floor.docsTab.phaseAfter")],
            ] as const).map(([phase, label]) => (
              <Box key={phase}>
                <Typography variant="subtitle2" fontWeight={700} mb={0.75}>{label}</Typography>
                <PhotoGallery relatedType="floor" relatedId={floorId} floorId={floorId} phase={phase} compact />
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompareOpen(false)}>{t("floor.form.plan.cancel")}</Button>
        </DialogActions>
      </Dialog>

      <FloorPlanFormDialog
        open={formOpen}
        floorId={floorId}
        revisionOf={revisionOf}
        loading={createMutation.isPending}
        onClose={() => {
          setFormOpen(false);
          setRevisionOf(null);
        }}
        onSubmit={(input) => createMutation.mutate(input)}
      />

      <Dialog open={!!historyPlan} onClose={() => setHistoryPlan(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t("floor.docsTab.viewRevisions")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            {(revisionHistoryQuery.data ?? []).map((rev) => (
              <Card key={rev.id} variant={rev.isActiveRevision ? "elevation" : "outlined"}>
                <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700}>{rev.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {rev.revision || "—"} · {t(`floor.planStatus.${rev.status}`)}
                      </Typography>
                    </Box>
                    <Button size="small" onClick={() => setViewingPlan(rev)} disabled={!rev.filePhotoId}>
                      {t("floor.planViewer.view")}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setHistoryPlan(null)}>{t("floor.form.plan.cancel")}</Button></DialogActions>
      </Dialog>

      <Dialog open={!!viewingPlan} onClose={() => setViewingPlan(null)} fullWidth maxWidth="md">
        <DialogTitle>{viewingPlan?.title ?? ""}</DialogTitle>
        <DialogContent dividers sx={{ p: 1, bgcolor: "background.default" }}>
          {planPhotoQuery.data ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 320, bgcolor: "#111", borderRadius: 1 }}>
              <img
                src={getPhotoUrl(planPhotoQuery.data.filename)}
                alt={viewingPlan?.title ?? ""}
                style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", display: "block" }}
              />
            </Box>
          ) : (
            <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ minHeight: 240 }}>
              <DescriptionIcon color="disabled" />
              <Typography variant="body2" color="text.secondary">
                {t("floor.planViewer.noPreview")}
              </Typography>
            </Stack>
          )}
          {viewingPlan && (
            <Stack spacing={0.5} sx={{ p: 1.5 }}>
              <Typography variant="body2" fontWeight={700}>
                {viewingPlan.code || "—"} · {viewingPlan.revision || "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`floor.planStatus.${viewingPlan.status}`)}{viewingPlan.designer ? ` · ${viewingPlan.designer}` : ""}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewingPlan(null)} color="inherit">{t("floor.form.plan.cancel")}</Button>
          {planPhotoQuery.data && (
            <Button
              component="a"
              href={getPhotoUrl(planPhotoQuery.data.filename)}
              download={planPhotoQuery.data.originalName}
              startIcon={<DownloadIcon />}
            >
              {t("floor.planViewer.download")}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deletingPlan}
        title={t("floor.docsTab.plansTitle") as string}
        description={t("floor.dialogs.deletePlanMessage") as string}
        confirmLabel={t("floor.dialogs.confirm") as string}
        loading={deleteMutation.isPending}
        onConfirm={() => deletingPlan && deleteMutation.mutate(deletingPlan.id)}
        onCancel={() => setDeletingPlan(null)}
      />
    </Box>
  );
}
