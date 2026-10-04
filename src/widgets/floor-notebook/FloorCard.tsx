import { formatArea, formatPercent } from "../../shared/utils/format";
import { Box, Card, CardActionArea, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import LayersIcon from "@mui/icons-material/Layers";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useTranslation } from "react-i18next";
import type { FloorWithStats } from "../../entities/Floor";

interface FloorCardProps {
  floor: FloorWithStats;
  onClick: () => void;
}

const STATUS_COLOR: Record<string, "default" | "info" | "warning" | "success"> = {
  not_started: "default",
  in_progress: "info",
  paused: "warning",
  completed: "success",
};

export function FloorCard({ floor, onClick }: FloorCardProps) {
  const { t } = useTranslation();

  return (
    <Card variant="outlined">
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ py: 1.75 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <LayersIcon fontSize="small" color="action" />
                <Typography variant="subtitle1" fontWeight={700}>
                  {floor.name}
                </Typography>
                <Chip
                  size="small"
                  label={t(`floor.status.${floor.status}`)}
                  color={STATUS_COLOR[floor.status]}
                  variant={floor.status === "not_started" ? "outlined" : "filled"}
                  sx={{ height: 20, fontSize: 11 }}
                />
                {floor.criticalOpenIssuesCount > 0 && (
                  <Chip
                    size="small"
                    color="error"
                    icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                    label={floor.criticalOpenIssuesCount}
                    sx={{ height: 20, fontSize: 11 }}
                  />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
                {t(`floor.usageType.${floor.usageType}`)}
                {floor.area ? ` · ${formatArea(floor.area)}` : ""}
              </Typography>
            </Box>
            <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ whiteSpace: "nowrap" }}>
              {formatPercent(floor.progress)}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={floor.progress}
            sx={{ height: 6, borderRadius: 3, mt: 1.25 }}
          />
          <Stack direction="row" spacing={2} mt={1}>
            <Typography variant="caption" color="text.secondary">
              {t("floor.overview.kpiOpenTasks")}: {floor.openTasksCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("floor.overview.kpiOpenIssues")}: {floor.openIssuesCount}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
