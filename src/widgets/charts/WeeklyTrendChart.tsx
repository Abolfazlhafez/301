import { Card, CardContent, Typography, useTheme } from "@mui/material";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DailyTrendPoint } from "../../entities/Report";
import { toJalaliShort } from "../../shared/utils/jalaliDate";

interface WeeklyTrendChartProps {
  data: DailyTrendPoint[];
}

export function WeeklyTrendChart({ data }: WeeklyTrendChartProps) {
  const theme = useTheme();

  const chartData = data.map((d) => ({
    ...d,
    label: toJalaliShort(d.date).slice(5), // فقط ماه/روز
    hours: Math.round((d.totalUsefulMinutes / 60) * 10) / 10,
  }));

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>
          روند ۷ روز اخیر (ساعات مفید کار)
        </Typography>
        <div style={{ width: "100%", height: 220, direction: "ltr" }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: "Vazirmatn" }} reversed />
              <YAxis tick={{ fontSize: 11, fontFamily: "Vazirmatn" }} />
              <Tooltip
                contentStyle={{
                  fontFamily: "Vazirmatn",
                  direction: "rtl",
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                }}
                formatter={(value: number) => [`${value} ساعت`, "ساعات مفید"]}
                labelFormatter={(label) => `تاریخ: ${label}`}
              />
              <Bar
                dataKey="hours"
                fill={theme.palette.primary.main}
                radius={[6, 6, 0, 0]}
                isAnimationActive
                animationDuration={550}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
