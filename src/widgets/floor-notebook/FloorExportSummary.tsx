import { forwardRef } from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import i18n from "../../shared/i18n";
import { getPhotoUrl } from "../../shared/api/photosApi";
import { formatArea, formatCurrency, formatPercent } from "../../shared/utils/format";
import type { FloorWithStats } from "../../entities/Floor";
import type { FloorStageWithStats } from "../../entities/FloorStage";
import type { FloorTask } from "../../entities/FloorTask";
import type { FloorIssue } from "../../entities/FloorIssue";
import type { FloorPlan } from "../../entities/FloorPlan";
import type { FloorWorkerWithDetails } from "../../entities/FloorWorker";
import type { FloorChecklistItem } from "../../entities/FloorChecklistItem";
import type { WorkLogNote } from "../../entities/WorkLogNote";
import type { CashbookEntry } from "../../entities/Cashbook";
import type { Photo } from "../../entities/Photo";

interface Props { floor: FloorWithStats; stages: FloorStageWithStats[]; tasks: FloorTask[]; issues: FloorIssue[]; plans: FloorPlan[]; workers: FloorWorkerWithDetails[]; checklist: FloorChecklistItem[]; reports: WorkLogNote[]; cashbookEntries: CashbookEntry[]; photos: Photo[]; }

export const FloorExportSummary = forwardRef<HTMLDivElement, Props>(function FloorExportSummary({ floor, stages, tasks, issues, plans, workers, checklist, reports, cashbookEntries, photos }, ref) {
  const { t } = useTranslation();
  const cost = cashbookEntries.filter(e => e.type !== "deposit").reduce((sum, e) => sum + e.amount, 0);
  const selectedPhotos = photos.slice(0, 9);
  const lastReport = reports[0];
  return <Box ref={ref} sx={{ position: "fixed", left: -100000, top: 0, width: 794, minHeight: 1123, bgcolor: "white", color: "#111", p: 5, direction: i18n.dir(), fontFamily: "sans-serif" }}>
    <Typography variant="h4" fontWeight={900}>{floor.name}</Typography>
    <Typography variant="body2" color="text.secondary">{floor.number ?? "—"} · {floor.area != null ? formatArea(floor.area) : "—"} · {formatPercent(floor.progress)}</Typography>
    <Divider sx={{ my: 2 }} />
    <Stack spacing={1.2}>
      <Typography variant="h6">{t("floor.tabs.overview")}</Typography>{stages.map(s => <Typography key={s.id} variant="body2">• {s.title || s.key}: {formatPercent(s.progress)} — {s.tasksCount} — {s.openIssuesCount}</Typography>)}
      <Typography variant="h6" sx={{ mt: 1 }}>{t("floor.overview.kpiOpenTasks")}</Typography>{tasks.filter(t => t.status !== "done").slice(0, 30).map(t => <Typography key={t.id} variant="body2">• {t.title}</Typography>)}
      <Typography variant="h6" sx={{ mt: 1 }}>{t("floor.overview.kpiOpenIssues")}</Typography>{issues.filter(i => i.status === "open" || i.status === "in_progress").slice(0, 30).map(i => <Typography key={i.id} variant="body2">• {i.title} — {t(`floor.issueSeverity.${i.severity}`)}</Typography>)}
      <Typography variant="h6" sx={{ mt: 1 }}>{t("floor.docsTab.plansTitle")}</Typography>{plans.filter(p => p.isActiveRevision).map(p => <Typography key={p.id} variant="body2">• {p.title} — {t("floor.docsTab.revisionLabel")} {p.revision ?? "—"}</Typography>)}
      <Typography variant="h6" sx={{ mt: 1 }}>{t("floor.financeTab.workersTitle")}</Typography>{workers.map(w => <Typography key={w.id} variant="body2">• {w.workerFullName}{w.role ? ` — ${w.role}` : ""}</Typography>)}
      <Typography variant="h6" sx={{ mt: 1 }}>{t("floor.financeTab.linkedTotal")}</Typography><Typography variant="body2">{formatCurrency(cost)}</Typography>
      <Typography variant="h6" sx={{ mt: 1 }}>{t("floor.tabs.tasks")}</Typography>{checklist.map(c => <Typography key={c.id} variant="body2">• {c.title || c.key} — {t(`floor.checklistStatus.${c.status}`)}</Typography>)}
      {lastReport && <><Typography variant="h6" sx={{ mt: 1 }}>{t("floor.reportsTab.reportsTitle")}</Typography><Typography variant="body2">{lastReport.date}: {lastReport.description}</Typography></>}
      {selectedPhotos.length > 0 && <Box>
        <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>{t("floor.docsTab.photosTitle")}</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
          {selectedPhotos.map(photo => <img key={photo.id} src={getPhotoUrl(photo.filename)} alt={photo.caption ?? ""} style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 6 }} />)}
        </Box>
      </Box>}
    </Stack>
  </Box>;
});
