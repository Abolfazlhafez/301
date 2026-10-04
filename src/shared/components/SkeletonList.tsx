import { Box, Skeleton, Stack } from "@mui/material";

interface SkeletonListProps {
  /** تعداد ردیف اسکلت که نمایش داده می‌شود. */
  count?: number;
  /** ارتفاع هر ردیف اسکلت، برای تطبیق با ارتفاع واقعی کارت‌های آن صفحه. */
  rowHeight?: number;
  /** آیا هر ردیف یک آواتار دایره‌ای در کنار خودش دارد (مثل کارت نیروها). */
  withAvatar?: boolean;
}

/**
 * جایگزین اسپینر ساده برای لیست‌های اصلی — چون اسکلت متحرک حس بارگذاری
 * سریع‌تر و «آماده‌تر» می‌دهد و ساختار صفحه را از همان لحظهٔ اول نشان
 * می‌دهد (به‌جای یک چرخ‌دندهٔ خنثی وسط صفحه که هیچ اطلاعاتی از چیدمان
 * صفحه نمی‌دهد).
 */
export function SkeletonList({ count = 4, rowHeight = 76, withAvatar = true }: SkeletonListProps) {
  return (
    <Stack spacing={1.25}>
      {Array.from({ length: count }).map((_, i) => (
        <Box
          key={i}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 1.5,
            borderRadius: 3,
            bgcolor: "background.paper",
            height: rowHeight,
          }}
        >
          {withAvatar && <Skeleton variant="circular" width={rowHeight - 32} height={rowHeight - 32} />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="55%" height={22} />
            <Skeleton variant="text" width="35%" height={18} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
