import { Card, CardContent, Typography, useTheme } from "@mui/material";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DailyWorkerReport } from "../../entities/Report";
import { toJalaliShort } from "../../shared/utils/jalaliDate";

interface MonthlyChartProps {
  data: DailyWorkerReport[];
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const theme = useTheme();

  const chartData = data.map((d) => ({
    label: toJalaliShort(d.date).slice(5),
    salary: d.payableSalary,
  }));

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>
          نمودار حقوق روزانه در این بازه
        </Typography>
        <div style={{ width: "100%", height: 220, direction: "ltr" }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} reversed />
              <YAxis
                tick={{ fontSize: 10, fontFamily: "Vazirmatn" }}
                tickFormatter={(v) => `${Math.round(v / 1000)}K`}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: "Vazirmatn",
                  direction: "rtl",
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                }}
                formatter={(value: number) => [`${value.toLocaleString("fa-IR")} تومان`, "حقوق"]}
                labelFormatter={(label) => `تاریخ: ${label}`}
              />
              <Bar dataKey="salary" fill={theme.palette.secondary.main} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
