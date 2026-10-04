import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Stack, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EventNoteIcon from "@mui/icons-material/EventNote";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { useTranslation } from "react-i18next";
import { workLogNoteApi } from "../../shared/api/workLogNoteApi";
import { futureActivitiesApi } from "../../shared/api/futureActivitiesApi";
import { floorStagesApi } from "../../shared/api/floorStagesApi";
import { extractErrorMessage } from "../../shared/api/client";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import { useToast } from "../../shared/components/ToastProvider";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";

interface Props { floorId: string; }

export function FloorReportsTab({ floorId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [date, setDate] = useState(getTodayIso());
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDate, setActivityDate] = useState(getTodayIso());
  const [activityDescription, setActivityDescription] = useState("");

  const reportsQuery = useQuery({ queryKey: ["floorReports", floorId], queryFn: () => workLogNoteApi.listByFloor(floorId) });
  const activitiesQuery = useQuery({ queryKey: ["floorActivitiesLinked", floorId], queryFn: () => futureActivitiesApi.listByFloor(floorId) });
  const stagesQuery = useQuery({ queryKey: ["floorStages", floorId], queryFn: () => floorStagesApi.listByFloor(floorId) });

  const reportMutation = useMutation({
    mutationFn: () => workLogNoteApi.upsert(date, description, { floorId, stageId: stageId || null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["floorReports", floorId] }); queryClient.invalidateQueries({ queryKey: ["floorActivity", floorId] }); setReportOpen(false); setDescription(""); showToast(t("floor.reportsTab.reportSaved") as string, "success"); },
    onError: (e) => showToast(extractErrorMessage(e), "error"),
  });

  const activityMutation = useMutation({
    mutationFn: () => futureActivitiesApi.create({ date: activityDate, title: activityTitle, description: activityDescription || null, priority: "medium", floorId, stageId: stageId || null, taskId: null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["floorActivitiesLinked", floorId] }); setActivityOpen(false); setActivityTitle(""); setActivityDescription(""); showToast(t("floor.reportsTab.activitySaved") as string, "success"); },
    onError: (e) => showToast(extractErrorMessage(e), "error"),
  });

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={800}>{t("floor.reportsTab.reportsTitle")}</Typography>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setReportOpen(true)}>{t("floor.reportsTab.addReport")}</Button>
      </Stack>

      {reportsQuery.data?.length ? reportsQuery.data.map((report) => (
        <Card key={report.id} variant="outlined"><CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}><EventNoteIcon fontSize="small" color="action" /><Typography variant="subtitle2" fontWeight={700}>{report.date}</Typography><Chip size="small" label={t("floor.reportsTab.linkedToFloor")} /></Stack>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{report.description || t("floor.reportsTab.emptyReport")}</Typography>
        </CardContent></Card>
      )) : <Typography variant="body2" color="text.secondary">{t("floor.reportsTab.emptyReports")}</Typography>}

      <Divider />
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={800}>{t("floor.reportsTab.activitiesTitle")}</Typography>
        <Button startIcon={<AddIcon />} size="small" onClick={() => setActivityOpen(true)}>{t("floor.reportsTab.addActivity")}</Button>
      </Stack>
      {activitiesQuery.data?.length ? activitiesQuery.data.map((activity) => (
        <Card key={activity.id} variant="outlined"><CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
          <Stack direction="row" alignItems="center" spacing={1}><ScheduleIcon fontSize="small" color="action" /><Typography variant="subtitle2" fontWeight={700}>{activity.title}</Typography><Chip size="small" label={activity.isCompleted ? t("floor.reportsTab.completed") : activity.date} /></Stack>
          {activity.description && <Typography variant="body2" color="text.secondary" mt={0.5}>{activity.description}</Typography>}
        </CardContent></Card>
      )) : <Typography variant="body2" color="text.secondary">{t("floor.reportsTab.emptyActivities")}</Typography>}

      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("floor.reportsTab.addReport")}</DialogTitle>
        <DialogContent><Stack spacing={2} mt={0.5}>
          <JalaliDatePicker label={t("floor.reportsTab.date") as string} value={date} onChange={setDate} />
          <TextField select label={t("floor.reportsTab.stage")} value={stageId} onChange={(e) => setStageId(e.target.value)}><MenuItem value="">{t("floor.reportsTab.noStage")}</MenuItem>{(stagesQuery.data ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.isCustom ? s.title : t(`floor.stageTitle.${s.key}`)}</MenuItem>)}</TextField>
          <TextField multiline minRows={4} label={t("floor.reportsTab.description")} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setReportOpen(false)} color="inherit">{t("floor.form.task.cancel")}</Button><Button onClick={() => reportMutation.mutate()} disabled={!description.trim() || reportMutation.isPending} variant="contained">{t("floor.form.task.save")}</Button></DialogActions>
      </Dialog>

      <Dialog open={activityOpen} onClose={() => setActivityOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t("floor.reportsTab.addActivity")}</DialogTitle>
        <DialogContent><Stack spacing={2} mt={0.5}>
          <TextField label={t("floor.reportsTab.activityTitle")} value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} autoFocus />
          <JalaliDatePicker label={t("floor.reportsTab.date")} value={activityDate} onChange={setActivityDate} />
          <TextField select label={t("floor.reportsTab.stage")} value={stageId} onChange={(e) => setStageId(e.target.value)}><MenuItem value="">{t("floor.reportsTab.noStage")}</MenuItem>{(stagesQuery.data ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.isCustom ? s.title : t(`floor.stageTitle.${s.key}`)}</MenuItem>)}</TextField>
          <TextField multiline minRows={3} label={t("floor.reportsTab.description")} value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setActivityOpen(false)} color="inherit">{t("floor.form.task.cancel")}</Button><Button onClick={() => activityMutation.mutate()} disabled={!activityTitle.trim() || activityMutation.isPending} variant="contained">{t("floor.form.task.save")}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
