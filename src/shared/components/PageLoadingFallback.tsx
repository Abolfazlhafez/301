import { Box, Skeleton, Stack } from "@mui/material";

/**
 * جایگزین محتوای صفحه در طول کسری از ثانیه‌ای که chunk صفحهٔ لازی‌لود شده
 * دانلود/اجرا می‌شود (بعد از تقسیم باندل در App.tsx). به‌جای یک اسپینر خشک
 * وسط صفحه، یک اسکلت محو با انیمیشن shimmer نشان می‌دهد که حس واکنش‌گر
 * بودن اپ را حفظ می‌کند و از پرش ناگهانی محتوا جلوگیری می‌کند.
 */
export function PageLoadingFallback() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        py: 1,
        animation: "karegahyar-fade-in 220ms ease-out",
        "@keyframes karegahyar-fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      <Skeleton variant="rounded" height={40} width="55%" />
      <Stack direction="row" spacing={1.5}>
        <Skeleton variant="rounded" height={80} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={80} sx={{ flex: 1 }} />
      </Stack>
      <Skeleton variant="rounded" height={64} />
      <Skeleton variant="rounded" height={64} />
      <Skeleton variant="rounded" height={64} />
    </Box>
  );
}
