import { formatPercent } from "../../shared/utils/format";
import { Box, Card, CardActionArea, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import IconButton from "@mui/material/IconButton";
import { useTranslation } from "react-i18next";
import type { FloorStageWithStats } from "../../entities/FloorStage";
import { STANDARD_STAGE_KEYS } from "../../core/seedFloorStages";

interface FloorStageTimelineProps {
  stages: FloorStageWithStats[];
  onSelect: (stage: FloorStageWithStats) => void;
  onMove?: (stage: FloorStageWithStats, direction: "up" | "down") => void;
  movingStageId?: string | null;
}

const STATUS_COLOR: Record<string, "default" | "info" | "warning" | "success"> = {
  not_started: "default",
  in_progress: "info",
  blocked: "warning",
  completed: "success",
};

function stageDisplayTitle(stage: FloorStageWithStats, t: (key: string) => unknown): string {
  if (!stage.isCustom && STANDARD_STAGE_KEYS.includes(stage.key)) {
    return String(t(`floor.stageTitle.${stage.key}`));
  }
  return stage.title;
}

export function FloorStageTimeline({ stages, onSelect, onMove, movingStageId }: FloorStageTimelineProps) {
  const { t } = useTranslation();

  return (
    <Stack spacing={1}>
      {stages.map((stage) => (
        <Card key={stage.id} variant="outlined">
          <CardActionArea onClick={() => onSelect(stage)}>
            <CardContent sx={{ py: 1.25 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                  {stage.status === "completed" && <CheckCircleIcon fontSize="small" color="success" />}
                  {stage.status === "blocked" && <BlockIcon fontSize="small" color="warning" />}
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    {stageDisplayTitle(stage, t)}
                  </Typography>
                  <Chip
                    size="small"
                    label={t(`floor.stageStatus.${stage.status}`)}
                    color={STATUS_COLOR[stage.status]}
                    sx={{ height: 18, fontSize: 10 }}
                  />
                </Stack>
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  {formatPercent(stage.progress)}
                </Typography>
                {onMove && (
                  <Stack direction="row" spacing={0}>
                    <IconButton
                      size="small"
                      disabled={movingStageId === stage.id || stages[0]?.id === stage.id}
                      onClick={(event) => { event.stopPropagation(); onMove(stage, "up"); }}
                      aria-label={String(t("floor.actions.moveStageUp"))}
                    >
                      <ArrowUpwardIcon fontSize="inherit" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={movingStageId === stage.id || stages[stages.length - 1]?.id === stage.id}
                      onClick={(event) => { event.stopPropagation(); onMove(stage, "down"); }}
                      aria-label={String(t("floor.actions.moveStageDown"))}
                    >
                      <ArrowDownwardIcon fontSize="inherit" />
                    </IconButton>
                  </Stack>
                )}
              </Stack>
              <LinearProgress
                variant="determinate"
                value={stage.progress}
                color={stage.status === "blocked" ? "warning" : "primary"}
                sx={{ height: 5, borderRadius: 3, mt: 0.75 }}
              />
              {stage.tasksCount > 0 && (
                <Box mt={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {t("floor.overview.tasksCount", { count: stage.tasksCount })}
                    {stage.readyForNext
                      ? ` · ${t("floor.overview.readyForNext")}`
                      : stage.remainingItemsCount > 0
                        ? ` · ${t("floor.overview.remainingItems", { count: stage.remainingItemsCount })}`
                        : ""}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  );
}
