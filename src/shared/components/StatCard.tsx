import { Box, Card, Typography } from "@mui/material";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  color: string;
  onClick?: () => void;
}

export function StatCard({ title, value, icon, color, onClick }: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
      sx={{
        height: "100%",
        p: 1.75,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        transition: "transform 120ms ease-out",
        cursor: onClick ? "pointer" : "default",
        "&:active": { transform: "scale(0.98)" },
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: `${color}1A`,
          color,
          flexShrink: 0,
          "& svg": { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
          {title}
        </Typography>
        {/*
          با key={value}، هر بار عدد/متن تغییر کند (مثلاً بعد از ثبت یک
          تراکنش جدید، مانده صندوق آپدیت می‌شود)، این Typography دوباره mount
          می‌شود و انیمیشن fade+slide از نو اجرا می‌شود — یک بازخورد ظریف که
          نشان می‌دهد عدد واقعاً به‌روز شده، بدون نیاز به پارس کردن مقدار
          (که چون رشته‌های فرمت‌شدهٔ مختلف مثل «۹ ساعت» یا «۱٬۲۰۰٬۰۰۰ تومان»
          هستند، شمارش عددی واقعی امکان‌پذیر/امن نیست).
        */}
        <Typography
          key={value}
          variant="subtitle1"
          fontWeight={700}
          noWrap
          sx={{
            animation: "karegahyar-stat-update 260ms ease-out",
            "@keyframes karegahyar-stat-update": {
              from: { opacity: 0, transform: "translateY(3px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          {value}
        </Typography>
      </Box>
    </Card>
  );
}
