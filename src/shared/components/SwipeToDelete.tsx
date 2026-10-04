import { PointerEvent as ReactPointerEvent, ReactNode, useRef, useState } from "react";
import { Box, IconButton } from "@mui/material";
import { useTranslation } from "react-i18next";
import DeleteIcon from "@mui/icons-material/Delete";
import { haptics } from "../utils/haptics";

const REVEAL_WIDTH = 76;
const TRIGGER_THRESHOLD = REVEAL_WIDTH * 0.65;

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  /** برای غیرفعال کردن سواپ روی موارد خاص (مثلاً وقتی خودِ فهرست در حالت انتخاب چندتایی است). */
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * آیتم فهرست را در یک لایهٔ قابل کشیدن (فقط افقی) می‌پیچد؛ کشیدن به یک‌سمت
 * دکمهٔ حذف قرمز را زیرِ کارت آشکار می‌کند. خودِ swipe هرگز مستقیماً چیزی
 * حذف نمی‌کند — فقط دکمهٔ حذف را در دسترس می‌گذارد و onDelete را صدا
 * می‌زند، که در تمام صفحات همان مسیر تأییدِ حذف موجود (ConfirmDialog) را باز
 * می‌کند؛ یعنی سواپ یک میان‌بر برای دسترسی سریع‌تر است، نه دور زدن ایمنی.
 *
 * پیاده‌سازی با pointer events (نه یک کتابخانهٔ swipe سنگین) چون فقط یک
 * حرکت افقیِ ساده لازم است و سبک ماندن برای اپلیکیشن آفلاین/موبایل مهم است.
 */
export function SwipeToDelete({ children, onDelete, disabled, ariaLabel }: SwipeToDeleteProps) {
  const { t } = useTranslation();
  const [dragX, setDragX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const axisLockRef = useRef<"none" | "horizontal" | "vertical">("none");
  const hapticFiredRef = useRef(false);

  function handlePointerDown(e: ReactPointerEvent) {
    if (disabled || e.pointerType === "mouse") return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    axisLockRef.current = "none";
    hapticFiredRef.current = false;
    setDragging(true);
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (axisLockRef.current === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // اگر حرکت عمودی بیشتر بود، یعنی کاربر دارد اسکرول می‌کند نه سواپ —
      // کنترل را کامل به اسکرول عادی لیست واگذار می‌کنیم.
      axisLockRef.current = Math.abs(dy) > Math.abs(dx) ? "vertical" : "horizontal";
    }
    if (axisLockRef.current !== "horizontal") return;

    // فقط کشیدن به‌سمت چپ (منفی) اجازه داده می‌شود چون دکمهٔ حذف در سمت چپ کارت آشکار می‌شود.
    const next = Math.min(0, Math.max(dx, -REVEAL_WIDTH * 1.4));
    setDragX(next);

    if (!hapticFiredRef.current && Math.abs(next) >= TRIGGER_THRESHOLD) {
      hapticFiredRef.current = true;
      haptics.light();
    } else if (hapticFiredRef.current && Math.abs(next) < TRIGGER_THRESHOLD) {
      hapticFiredRef.current = false;
    }
  }

  function finishDrag() {
    setDragging(false);
    if (axisLockRef.current !== "horizontal") {
      setDragX(0);
      return;
    }
    if (Math.abs(dragX) >= TRIGGER_THRESHOLD) {
      setDragX(-REVEAL_WIDTH);
      setRevealed(true);
    } else {
      setDragX(0);
      setRevealed(false);
    }
  }

  function closeReveal() {
    setDragX(0);
    setRevealed(false);
  }

  return (
    <Box sx={{ position: "relative", overflow: "hidden", borderRadius: 3 }}>
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          // موقعیت فیزیکی («right»، نه inline-end): چون translateX جهت‌ناآگاه
          // است، کشیدن به چپ همیشه فضای خالی سمت راستِ واقعی صفحه را آشکار
          // می‌کند — چه اپ RTL باشد چه LTR. استفاده از inset-inline-end اینجا
          // در حالت RTL برعکس می‌شد و دکمهٔ حذف را سمت اشتباه نشان می‌داد.
          right: 0,
          width: REVEAL_WIDTH,
          display: "flex",
          alignItems: "stretch",
          bgcolor: "error.main",
          borderRadius: 3,
        }}
      >
        <IconButton
          onClick={() => {
            haptics.medium();
            onDelete();
            closeReveal();
          }}
          aria-label={ariaLabel ?? (t("common.delete") as string)}
          sx={{ color: "error.contrastText", width: "100%", borderRadius: 0 }}
        >
          <DeleteIcon />
        </IconButton>
      </Box>
      <Box
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={(e) => {
          // وقتی دکمهٔ حذف باز است، اولین لمس روی خودِ کارت فقط باید ببندتش،
          // نه این‌که مستقیم اکشن کارت (مثل باز شدن ویرایش) اجرا شود.
          if (revealed) {
            e.stopPropagation();
            e.preventDefault();
            closeReveal();
          }
        }}
        sx={{
          position: "relative",
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
          touchAction: "pan-y",
          bgcolor: "background.default",
          // فرضیهٔ محتمل مورد ۹ («باگ هنگام انتخاب متن»): این کارت شامل متن
          // (نام کارگر/فعالیت/تراکنش) است؛ در همان چند پیکسل اول یک لمس که
          // ممکن است بعداً به سواپ تبدیل شود، هنوز axisLock تشخیص داده
          // نشده و ما preventDefault نمی‌زنیم — دقیقاً همان بازه‌ای که
          // مرورگرهای موبایل می‌توانند یک لمسِ کمی‌کشیده‌شده روی متن را
          // «شروع انتخاب متن» تفسیر کنند. بنابراین فقط در طول خودِ ژست
          // (dragging=true) انتخاب متن را موقتاً غیرفعال می‌کنیم؛ به‌محض
          // پایان ژست به auto برمی‌گردد، پس امکان انتخاب/کپی متن (مثلاً نام
          // کارگر) در حالت عادی — بدون لمس/کشیدن — کاملاً دست‌نخورده می‌ماند
          // (بر خلاف غیرفعال‌کردن دائمی و همیشگیِ انتخاب متن، که تست
          // رگرسیون جداگانه‌ای برایش نوشته شده و آن را ممنوع می‌کند).
          userSelect: dragging ? "none" : "auto",
          WebkitUserSelect: dragging ? "none" : "auto",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
