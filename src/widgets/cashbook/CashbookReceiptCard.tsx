import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Box, Stack, Typography } from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { CashbookEntry } from "../../entities/Cashbook";
import { formatCurrency } from "../../shared/utils/format";
import { LanguageCode, getLanguageInfo } from "../../shared/i18n/languages";
import { toJalaliWithWeekday } from "../../shared/utils/jalaliDate";

const RECEIPT_WIDTH_PX = 480;
const NAVY = "#111C33";

interface CashbookReceiptCardProps {
  id?: string;
  entry: CashbookEntry;
  workerName?: string | null;
  projectName?: string;
  /**
   * آدرس قابل‌نمایش عکس رسید (در صورت وجود). این باید از قبل resolve
   * شده باشد (مثلاً با getPhotoUrl بعد از این‌که photosApi.list کش عکس‌ها را
   * گرم کرده است) — این کامپوننت خودش هیچ fetch یا کش‌گرم‌کنی انجام نمی‌دهد.
   */
  receiptImageUrl?: string | null;
}

/**
 * رسید جدولی یک تراکنش دفتر حساب — قابل اشتراک‌گذاری یا ذخیره به‌عنوان عکس.
 * تمام اطلاعات تراکنش (نوع، عنوان، مبلغ، تاریخ+روز هفته، نیروی مرتبط،
 * توضیحات) در قالب یک جدول تمیز و حرفه‌ای نمایش داده می‌شود، و در صورت
 * وجود عکس رسید، خود عکس هم بالای جدول نمایش داده می‌شود.
 */
export const CashbookReceiptCard = forwardRef<HTMLDivElement, CashbookReceiptCardProps>(function CashbookReceiptCard(
  { id, entry, workerName, projectName, receiptImageUrl },
  ref
) {
  const { t, i18n } = useTranslation();
  // جهت از جدول زبان‌های پروژه می‌آید؛ i18n.dir() برای کردی (ku) به‌اشتباه ltr برمی‌گرداند.
  const dir = getLanguageInfo(i18n.language as LanguageCode).dir;
  const brand = t("cashbook.receipt.brand");
  const isDeposit = entry.type === "deposit";
  const rows: { label: string; value: string }[] = [
    { label: t("cashbook.receipt.rowType"), value: t(`cashbook.entryType.${entry.type}`) },
    { label: t("cashbook.receipt.rowTitle"), value: entry.title },
    { label: t("cashbook.receipt.rowDate"), value: toJalaliWithWeekday(entry.date) },
  ];
  if (workerName) rows.push({ label: t("cashbook.receipt.rowWorker"), value: workerName });
  if (entry.description) rows.push({ label: t("cashbook.receipt.rowNotes"), value: entry.description });
  rows.push({ label: t("cashbook.receipt.rowId"), value: entry.id.slice(0, 8).toUpperCase() });

  return (
    <Box
      id={id}
      ref={ref}
      sx={{
        width: RECEIPT_WIDTH_PX,
        bgcolor: "#ffffff",
        color: "#1a1a1a",
        fontFamily: "Vazirmatn, IRANSans, Tahoma, sans-serif",
        direction: dir,
        boxSizing: "border-box",
        border: "1px solid #eee",
      }}
    >
      {/* هدر */}
      <Box sx={{ bgcolor: NAVY, p: "20px 24px" }}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "12px",
              bgcolor: "rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ReceiptLongIcon sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>{t("cashbook.receipt.title")}</Typography>
            <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
              {projectName || brand}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* مبلغ برجسته */}
      <Box sx={{ textAlign: "center", py: "22px", borderBottom: "1px dashed #eee" }}>
        <Typography sx={{ fontSize: 12, color: "#999" }}>{isDeposit ? t("cashbook.receipt.amountDeposit") : t("cashbook.receipt.amountPaid")}</Typography>
        <Typography
          sx={{ fontSize: 26, fontWeight: 800, color: isDeposit ? "#2E7D32" : "#C62828", mt: 0.5 }}
        >
          {isDeposit ? "+" : "-"}
          {formatCurrency(entry.amount)}
        </Typography>
      </Box>

      {/* عکس رسید (در صورت وجود) — دقیقاً همان تصویری که کاربر هنگام ثبت
          تراکنش گرفته یا از گالری انتخاب کرده است. */}
      {receiptImageUrl && (
        <Box sx={{ p: "16px 24px 0", borderBottom: "1px dashed #eee", pb: "16px" }}>
          <Typography sx={{ fontSize: 11, color: "#999", mb: 1 }}>{t("cashbook.receipt.photoLabel")}</Typography>
          <Box
            component="img"
            src={receiptImageUrl}
            alt={t("cashbook.receipt.photoAlt")}
            sx={{
              width: "100%",
              maxHeight: 360,
              objectFit: "contain",
              borderRadius: 1.5,
              border: "1px solid #eee",
              display: "block",
            }}
          />
        </Box>
      )}

      {/* جدول اطلاعات */}
      <Box sx={{ p: "20px 24px" }}>
        {rows.map((row, i) => (
          <Stack
            key={row.label}
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            sx={{ py: "10px", borderBottom: i < rows.length - 1 ? "1px solid #f3f3f3" : "none" }}
          >
            <Typography sx={{ fontSize: 12.5, color: "#888" }}>{row.label}</Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#222", textAlign: dir === "rtl" ? "left" : "right", maxWidth: "65%" }}>
              {row.value}
            </Typography>
          </Stack>
        ))}
      </Box>

      {/* فوتر */}
      <Box sx={{ bgcolor: "#FAFAFA", px: "24px", py: "10px", textAlign: "center" }}>
        <Typography sx={{ fontSize: 10, color: "#aaa" }}>{t("cashbook.receipt.footer", { brand })}</Typography>
      </Box>
    </Box>
  );
});

export { RECEIPT_WIDTH_PX };
