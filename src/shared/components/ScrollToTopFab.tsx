import { Fab, Fade, Zoom } from "@mui/material";
import { useTranslation } from "react-i18next";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { useScrollToTop } from "../hooks/useScrollToTop";

interface ScrollToTopFabProps {
  /** برای جلوگیری از تداخل با FAB اصلی «افزودن» (که پایین-چپ است)، این دکمه در سمت راست قرار می‌گیرد. */
  bottom?: number;
}

/**
 * دکمه شناور کوچک «بازگشت به بالا» — فقط وقتی که کاربر مقدار قابل‌توجهی در
 * لیست پایین رفته باشد ظاهر می‌شود. کاملاً مستقل و بدون وابستگی به داده؛
 * در هر صفحه‌ای با لیست بلند (نیروها، گزارش کار، دفتر حساب) قابل استفاده است.
 */
export function ScrollToTopFab({ bottom = 84 }: ScrollToTopFabProps = {}) {
  const { t } = useTranslation();
  const { visible, scrollToTop } = useScrollToTop();

  return (
    <Zoom in={visible}>
      <Fade in={visible}>
        <Fab
          size="small"
          onClick={scrollToTop}
          aria-label={t("common.scrollToTop") as string}
          sx={{
            position: "fixed",
            bottom,
            right: 20,
            zIndex: 5,
            bgcolor: "background.paper",
            color: "text.secondary",
            boxShadow: 2,
            "&:hover": { bgcolor: "background.paper" },
          }}
        >
          <KeyboardArrowUpIcon />
        </Fab>
      </Fade>
    </Zoom>
  );
}
