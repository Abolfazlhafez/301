import { useQuery } from "@tanstack/react-query";
import { Box, Paper, Typography } from "@mui/material";
import LayersIcon from "@mui/icons-material/Layers";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mui/material/styles";
import { floorsApi } from "../../shared/api/floorsApi";
import { toJalaliShort } from "../../shared/utils/jalaliDate";

/**
 * کارت دفترچهٔ دیجیتال طبقات در داشبورد — تنها ورودی سراسری برنامه به
 * قابلیت «دفترچهٔ طبقه» (چون در نوار پایین آیتم جدیدی اضافه نشده، طبق
 * تصمیم معماری بخش ۴۵ پرامپت).
 */
export function ProjectFloorsCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const ChevronIcon = theme.direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;

  const { data } = useQuery({
    queryKey: ["floors"],
    queryFn: () => floorsApi.list(),
  });

  const floors = data ?? [];
  const avgProgress = floors.length > 0 ? Math.round(floors.reduce((acc, f) => acc + f.progress, 0) / floors.length) : 0;
  const openTasks = floors.reduce((sum, f) => sum + f.openTasksCount, 0);
  const latestActivity = floors.map(f => f.lastActivityAt).filter(Boolean).sort().at(-1) ?? null;

  return (
    <Paper
      variant="outlined"
      component="button"
      onClick={() => navigate("/project")}
      sx={{
        p: 2,
        width: "100%",
        textAlign: "start",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "primary.main",
          color: "primary.contrastText",
          flexShrink: 0,
        }}
      >
        <LayersIcon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {t("floor.dashboard.title")}
        </Typography>
        {floors.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            {t("floor.dashboard.empty")}
          </Typography>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary">
              {t("floor.dashboard.subtitle", { count: floors.length, progress: avgProgress })} · {t("floor.dashboard.openTasks", { count: openTasks })}
            </Typography>
            {latestActivity && (
              <Typography variant="caption" color="text.secondary" display="block">
                {t("floor.dashboard.lastActivity")}: {toJalaliShort(latestActivity)}
              </Typography>
            )}
          </>
        )}
      </Box>
      <ChevronIcon color="action" />
    </Paper>
  );
}
