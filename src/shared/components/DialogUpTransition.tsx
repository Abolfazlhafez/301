import { forwardRef } from "react";
import { Slide } from "@mui/material";
import type { TransitionProps } from "@mui/material/transitions";

/**
 * ترنزیشن پیش‌فرض همهٔ Dialogهای اپ (از طریق MuiDialog.defaultProps در
 * theme.ts، نه با تنظیم تک‌تک در هر فایل). به‌جای Fade ساده‌ی پیش‌فرض MUI،
 * پنجره از پایین صفحه به‌سمت بالا می‌لغزد — حس یک «بات‌شیت» بومی موبایل،
 * هماهنگ با باقی اپ که روی گوشی و به‌صورت تمام‌صفحه/نزدیک‌به‌پایین دیده
 * می‌شود. Backdrop مستقل از این هنوز با Fade خودش محو/ظاهر می‌شود (رفتار
 * پیش‌فرض MUI)، فقط خودِ کارت Dialog اینجا تغییر کرده.
 */
export const DialogUpTransition = forwardRef(function DialogUpTransition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return (
    <Slide
      ref={ref}
      direction="up"
      easing={{
        enter: "cubic-bezier(0.32, 0.9, 0.34, 1)",
        exit: "cubic-bezier(0.4, 0, 1, 1)",
      }}
      {...props}
    />
  );
});
