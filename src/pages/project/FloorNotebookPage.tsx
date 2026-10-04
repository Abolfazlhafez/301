import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Box, Button, Chip, Dialog, DialogContent, DialogTitle, Divider, Grid, IconButton, List, ListItem, ListItemText, Menu, MenuItem, Stack, Typography, useTheme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import FavoriteIcon from "@mui/icons-material/Favorite";
import PaymentsIcon from "@mui/icons-material/Payments";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import SpaceDashboardIcon from "@mui/icons-material/SpaceDashboard";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import DescriptionIcon from "@mui/icons-material/Description";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import { IconTabBar } from "../../shared/components/IconTabBar";
import { floorsApi } from "../../shared/api/floorsApi";
import { extractErrorMessage } from "../../shared/api/client";
import { UpdateFloorInput } from "../../entities/Floor";
import { LoadingState } from "../../shared/components/LoadingState";
import { ErrorState } from "../../shared/components/ErrorState";
import { StatCard } from "../../shared/components/StatCard";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useToast } from "../../shared/components/ToastProvider";
import { SwipeableTabPanel } from "../../shared/components/SwipeableTabPanel";
import { FloorFormDialog } from "../../widgets/floor-notebook/FloorFormDialog";
import { FloorOverviewTab } from "../../widgets/floor-notebook/FloorOverviewTab";
import { FloorTasksTab } from "../../widgets/floor-notebook/FloorTasksTab";
import { FloorDocsTab } from "../../widgets/floor-notebook/FloorDocsTab";
import { FloorIssuesTab } from "../../widgets/floor-notebook/FloorIssuesTab";
import { FloorFinanceTab } from "../../widgets/floor-notebook/FloorFinanceTab";
import { FloorReportsTab } from "../../widgets/floor-notebook/FloorReportsTab";
import { FloorExportSummary } from "../../widgets/floor-notebook/FloorExportSummary";
import { usePdfExport } from "../../shared/hooks/usePdfExport";
import { floorStagesApi } from "../../shared/api/floorStagesApi";
import { floorTasksApi } from "../../shared/api/floorTasksApi";
import { floorPlansApi } from "../../shared/api/floorPlansApi";
import { floorIssuesApi } from "../../shared/api/floorIssuesApi";
import { floorWorkersApi } from "../../shared/api/floorWorkersApi";
import { floorChecklistApi } from "../../shared/api/floorChecklistApi";
import { workLogNoteApi } from "../../shared/api/workLogNoteApi";
import { cashbookApi } from "../../shared/api/cashbookApi";
import { photosApi } from "../../shared/api/photosApi";
import { formatArea, formatCurrency, formatPercent } from "../../shared/utils/format";

const TAB_COUNT = 6;

export function FloorNotebookPage() {
  const { floorId = "" } = useParams<{ floorId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [tab, setTab] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { exportToPdf, isExporting } = usePdfExport();

  const BackIcon = theme.direction === "rtl" ? ArrowForwardIcon : ArrowBackIcon;

  const { data: floor, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["floors", floorId],
    queryFn: () => floorsApi.getById(floorId),
    enabled: !!floorId,
  });

  const exportStages = useQuery({ queryKey: ["floorExportStages", floorId], queryFn: () => floorStagesApi.listByFloor(floorId), enabled: false });
  const exportTasks = useQuery({ queryKey: ["floorExportTasks", floorId], queryFn: () => floorTasksApi.listByFloor(floorId), enabled: false });
  const exportPlans = useQuery({ queryKey: ["floorExportPlans", floorId], queryFn: () => floorPlansApi.listByFloor(floorId), enabled: false });
  const exportIssues = useQuery({ queryKey: ["floorExportIssues", floorId], queryFn: () => floorIssuesApi.listByFloor(floorId), enabled: false });
  const exportWorkers = useQuery({ queryKey: ["floorExportWorkers", floorId], queryFn: () => floorWorkersApi.listByFloor(floorId), enabled: false });
  const exportChecklist = useQuery({ queryKey: ["floorExportChecklist", floorId], queryFn: () => floorChecklistApi.listByFloor(floorId), enabled: false });
  const exportReports = useQuery({ queryKey: ["floorExportReports", floorId], queryFn: () => workLogNoteApi.listByFloor(floorId), enabled: false });
  const exportCashbook = useQuery({ queryKey: ["floorExportCashbook", floorId], queryFn: () => cashbookApi.list({ floorId }), enabled: false });
  const exportPhotos = useQuery({ queryKey: ["floorExportPhotos", floorId], queryFn: () => photosApi.list({ floorId }), enabled: false });
  const costQuery = useQuery({ queryKey: ["cashbook", "floor", floorId], queryFn: () => cashbookApi.list({ floorId }) });
  const floorCost = (costQuery.data ?? []).reduce((sum, entry) => sum + (entry.type === "deposit" ? 0 : entry.amount), 0);
  const { data: handoverChecklist = [] } = useQuery({ queryKey: ["floorHandoverChecklist", floorId], queryFn: () => floorChecklistApi.listByFloor(floorId), enabled: !!floorId });
  const handoverPassedCount = handoverChecklist.filter((item) => item.status === "passed").length;
  const handoverReady =
    handoverChecklist.length > 0 &&
    handoverPassedCount === handoverChecklist.length &&
    (floor?.openIssuesCount ?? 0) === 0 &&
    (floor?.progress ?? 0) >= 100;

  const updateMutation = useMutation({
    mutationFn: (input: UpdateFloorInput) => floorsApi.update(floorId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      showToast(t("floor.toasts.floorUpdated") as string, "success");
      setEditOpen(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => floorsApi.duplicate(floorId),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      showToast(t("floor.toasts.floorDuplicated") as string, "success");
      navigate(`/project/floors/${created.id}`);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => floorsApi.remove(floorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floors"] });
      showToast(t("floor.toasts.floorDeleted") as string, "success");
      navigate("/project", { replace: true });
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  if (isLoading) return <LoadingState />;
  if (isError || !floor) {
    return <ErrorState message={extractErrorMessage(error) || (t("common.notFound") as string)} onRetry={() => refetch()} />;
  }

  function handleTabChange(value: number) {
    setTab(value);
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate("/project")} aria-label={t("floor.backButton") as string}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} noWrap>
            {floor.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t(`floor.usageType.${floor.usageType}`)} · {t(`floor.status.${floor.status}`)}
            {floor.area != null ? ` · ${formatArea(floor.area)}` : ""}
            {` · ${formatPercent(floor.progress)}`}
          </Typography>
        </Box>
        <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label={t("common.menu") as string}>
          <MoreVertIcon />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setEditOpen(true);
            }}
          >
            {t("floor.editFloor")}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              duplicateMutation.mutate();
            }}
            disabled={duplicateMutation.isPending}
          >
            {t("floor.duplicateFloor")}
          </MenuItem>
          <MenuItem
            onClick={async () => {
              setMenuAnchor(null);
              await Promise.all([exportStages.refetch(), exportTasks.refetch(), exportPlans.refetch(), exportIssues.refetch(), exportWorkers.refetch(), exportChecklist.refetch(), exportReports.refetch(), exportCashbook.refetch(), exportPhotos.refetch()]);
              setTimeout(() => exportToPdf("floor-notebook-export", `floor-${floor.number ?? floor.id}-notebook.pdf`), 50);
            }}
            disabled={isExporting}
          >
            {t("floor.actions.exportNotebook")}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setDeleteOpen(true);
            }}
            sx={{ color: "error.main" }}
          >
            {t("floor.deleteFloor")}
          </MenuItem>
        </Menu>
      </Stack>

      <Grid container spacing={1.25}>
        <Grid item xs={6} sm={3}>
          <StatCard
            title={t("floor.overview.kpiProgress") as string}
            value={formatPercent(floor.progress)}
            icon={<TrendingUpIcon />}
            color="#2563eb"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title={t("floor.overview.kpiOpenTasks") as string}
            value={String(floor.openTasksCount)}
            icon={<AssignmentIcon />}
            color="#7c3aed"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title={t("floor.overview.kpiOpenIssues") as string}
            value={String(floor.openIssuesCount)}
            icon={<ReportProblemIcon />}
            color="#dc2626"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title={t("floor.overview.kpiCost") as string}
            value={costQuery.isLoading ? "…" : formatCurrency(floorCost)}
            icon={<PaymentsIcon />}
            color="#16a34a"
          />
        </Grid>
      </Grid>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }} aria-live="polite">
        <Chip
          size="small"
          icon={<AssignmentIcon fontSize="small" />}
          label={t("floor.handover.checklistProgress", { passed: handoverPassedCount, total: handoverChecklist.length }) as string}
          variant="outlined"
        />
        <Chip
          size="small"
          color={handoverReady ? "success" : "warning"}
          label={t(handoverReady ? "floor.handover.handover" : "floor.handover.needsFix") as string}
        />
      </Box>

      <Button
        onClick={() => setHealthDialogOpen(true)}
        variant="outlined"
        size="small"
        startIcon={<FavoriteIcon fontSize="small" />}
        sx={{ alignSelf: "flex-start", borderRadius: 99, textTransform: "none" }}
        aria-label={t("floor.overview.kpiHealth") as string}
      >
        {t("floor.overview.kpiHealth")}: {floor.healthScore}/100
      </Button>

      <Dialog open={healthDialogOpen} onClose={() => setHealthDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("floor.health.dialogTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {t("floor.health.startScore")}
            </Typography>
            {floor.healthBreakdown.length === 0 ? (
              <Typography variant="body2" color="success.main">
                {t("floor.health.noPenalties")}
              </Typography>
            ) : (
              <List dense disablePadding>
                {floor.healthBreakdown.map((factor) => (
                  <ListItem key={factor.labelKey} disableGutters>
                    <ListItemText
                      primary={<Typography color="error.main">{t(factor.labelKey, { count: factor.count })}</Typography>}
                    />
                    <Typography variant="body2" fontWeight={700} color="error.main">
                      -{factor.penalty}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            )}
            <Divider />
            <Typography variant="subtitle1" fontWeight={800}>
              {t("floor.health.resultScore", { score: floor.healthScore })}
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>

      <IconTabBar
        value={tab}
        onChange={handleTabChange}
        items={[
          { label: t("floor.tabs.overview"), icon: <SpaceDashboardOutlinedIcon />, activeIcon: <SpaceDashboardIcon /> },
          { label: t("floor.tabs.tasks"), icon: <AssignmentOutlinedIcon />, activeIcon: <AssignmentIcon /> },
          { label: t("floor.tabs.docs"), icon: <DescriptionOutlinedIcon />, activeIcon: <DescriptionIcon /> },
          { label: t("floor.tabs.issues"), icon: <ReportProblemOutlinedIcon />, activeIcon: <ReportProblemIcon /> },
          { label: t("floor.tabs.finance"), icon: <PaymentsOutlinedIcon />, activeIcon: <PaymentsIcon /> },
          { label: t("floor.reportsTab.reportsTitle"), icon: <AssessmentOutlinedIcon />, activeIcon: <AssessmentIcon /> },
        ]}
      />

      <SwipeableTabPanel activeIndex={tab} count={TAB_COUNT} onChangeIndex={setTab}>
        {tab === 0 && <FloorOverviewTab floorId={floorId} />}
        {tab === 1 && <FloorTasksTab floorId={floorId} />}
        {tab === 2 && <FloorDocsTab floorId={floorId} />}
        {tab === 3 && <FloorIssuesTab floorId={floorId} />}
        {tab === 4 && <FloorFinanceTab floorId={floorId} />}
        {tab === 5 && <FloorReportsTab floorId={floorId} />}
      </SwipeableTabPanel>

      <FloorExportSummary
        floor={floor}
        stages={exportStages.data ?? []}
        tasks={exportTasks.data ?? []}
        plans={exportPlans.data ?? []}
        issues={exportIssues.data ?? []}
        workers={exportWorkers.data ?? []}
        checklist={exportChecklist.data ?? []}
        reports={exportReports.data ?? []}
        cashbookEntries={exportCashbook.data ?? []}
        photos={exportPhotos.data ?? []}
      />

      <FloorFormDialog
        open={editOpen}
        floor={floor}
        loading={updateMutation.isPending}
        onClose={() => setEditOpen(false)}
        onSubmit={(input) => updateMutation.mutate(input as UpdateFloorInput)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={t("floor.dialogs.deleteFloorTitle") as string}
        description={t("floor.dialogs.deleteFloorMessage") as string}
        confirmLabel={t("floor.dialogs.confirm") as string}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
    </Box>
  );
}
