import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { KaregahYarLogoMark } from "./KaregahYarLogoMark";

// این پرچم در سطح ماژول (نه state) نگه‌داشته می‌شود چون باید در کل «نشست
// اجرای پردازه» (از باز شدن اپ تا کامل بسته‌شدن آن) فقط یک‌بار true شود.
// چون HashRouter کلاینت‌ساید است، رفتن بین صفحات باعث unmount/remount شدن
// کامپوننت App نمی‌شود؛ در نتیجه این پرچم عملاً یعنی «اسپلش فقط در همان
// اولین رندر واقعی اپ نمایش داده می‌شود»، نه هر بار عوض شدن تب/صفحه.
let hasShownEntrySplash = false;

export interface AppEntrySplashProps {
  /** حالت فعلی تم اپ، برای نمایش نسخهٔ رنگی درست لوگو (روشن/تاریک). */
  mode: "light" | "dark";
}

/**
 * پلی بین اسپلش‌اسکرین بومی اندروید (که یک تصویر ثابت است و بلافاصله با
 * اولین پینت وب‌ویو ناپدید می‌شود) و محتوای واقعی اپ. بدون این کامپوننت،
 * آن گذار می‌توانست یک‌دفعه/خشک به نظر برسد؛ اینجا لوگوی واقعی برند (همان
 * کلاه ایمنی، با رنگ‌بندی مخصوص حالت روشن یا تاریک) با ورود مرحله‌ای
 * اجزا (زمینه → گنبد → نوار تهویه → لبه، و در حالت تاریک حلقهٔ برند)
 * ظاهر می‌شود، اسم برنامه با کمی تأخیر از پی‌اش می‌آید، و کل لایه بعد
 * از حدود ۹۵۰ میلی‌ثانیه محو می‌شود. مقدارها عمداً کوتاه نگه داشته
 * شده‌اند — این باید یک خوش‌آمد ظریف باشد، نه یک مانع در برابر کاربری
 * که هر روز صبح برای اولین کار سریع به اپ سر می‌زند.
 * محتوای واقعی اپ همزمان زیر این لایه mount و آماده می‌شود؛ یعنی این
 * اسپلش صرفاً یک پوشش بصری است و هیچ تأخیری به کارکرد واقعی اپ اضافه نمی‌کند.
 */
export function AppEntrySplash({ mode }: AppEntrySplashProps) {
  const [mounted, setMounted] = useState(() => !hasShownEntrySplash);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    hasShownEntrySplash = true;
    const exitTimer = setTimeout(() => setExiting(true), 700);
    const removeTimer = setTimeout(() => setMounted(false), 950);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.75,
        bgcolor: "background.default",
        opacity: exiting ? 0 : 1,
        transition: "opacity 250ms ease-in",
        pointerEvents: "none",
      }}
    >
      <Box
        sx={{
          borderRadius: "20px",
          boxShadow: mode === "dark" ? "0 8px 28px rgba(0,0,0,0.45)" : "0 8px 24px rgba(232,95,0,0.25)",
        }}
      >
        <KaregahYarLogoMark mode={mode} size={76} animated />
      </Box>
      <Typography
        variant="subtitle1"
        fontWeight={700}
        sx={{
          animation: "karegahyar-splash-text 400ms ease-out 420ms both",
          "@keyframes karegahyar-splash-text": {
            from: { opacity: 0, transform: "translateY(6px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        کارگاه‌یار
      </Typography>
    </Box>
  );
}
