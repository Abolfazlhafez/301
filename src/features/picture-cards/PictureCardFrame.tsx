import { useState, type ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import type { PictureCardTemplateId } from "../../entities/PictureCard";

const FONT_FAMILY = "'Vazirmatn', 'Roboto', 'Arial', sans-serif";

/**
 * یک ردیف از جدول حضور و غیاب/غیبت مجاز در قالب «گزارش کار». این آرایه از
 * قبل توسط دیالوگ ساخت گزارش فیلتر و مرتب شده می‌آید — خودِ PictureCardFrame
 * هیچ منطق انتخاب/فیلتری ندارد (فقط رندر خالص)، دقیقاً مثل آرایهٔ photos.
 */
export interface PictureCardFrameAttendanceRow {
  id: string;
  workerFullName: string;
  /** برچسب وضعیت آماده برای نمایش (مثلاً «حاضر»، «مرخصی استعلاجی»، «غایب»). */
  statusLabel: string;
  /** رنگ نشانگر وضعیت (سبز برای حاضر، نارنجی برای مرخصی، قرمز برای غایب). */
  statusColor: string;
  /** ساعت ورود/خروج در صورت وجود (فقط برای ردیف‌های حضور، نه غیبت). */
  timeLabel?: string | null;
}

/**
 * تصویری که اگر بارگذاری آن با خطا مواجه شود، به‌جای شکستن ظاهر کارت، یک جای‌گزین خنثی نمایش می‌دهد.
 *
 * پشتیبانی از کادر دستی (کراپ/زوم): چون همهٔ خانه‌های کارت با object-fit:cover
 * پر می‌شوند، برای این‌که کاربر بتواند کانون تصویر را جابه‌جا کند و/یا زوم کند،
 * از object-position (بر اساس focalX/focalY درصدی) به‌همراه transform:scale
 * (بر اساس zoom) استفاده می‌کنیم؛ هر دو روی خودِ عنصر img اعمال می‌شوند تا
 * html2canvas هم درست آن را رندر کند (بر خلاف clip-path که در html2canvas
 * قابل‌اعتماد نیست).
 */
function CardCellImage({
  url,
  alt,
  width,
  focalX,
  focalY,
  zoom,
}: {
  url: string;
  alt: string;
  width: number;
  focalX?: number | null;
  focalY?: number | null;
  zoom?: number | null;
}) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "rgba(120,120,120,0.15)",
          color: "rgba(90,90,90,0.7)",
          fontFamily: FONT_FAMILY,
          fontSize: Math.max(10, width / 70),
          textAlign: "center",
          px: 1,
        }}
      >
        پیش‌نمایش در دسترس نیست
      </Box>
    );
  }

  const posX = focalX ?? 50;
  const posY = focalY ?? 50;
  const scale = zoom && zoom > 1 ? Math.min(zoom, 2.5) : 1;

  return (
    <Box
      component="img"
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
      sx={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: `${posX}% ${posY}%`,
        display: "block",
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: `${posX}% ${posY}%`,
      }}
    />
  );
}

export interface PictureCardFramePhoto {
  id: string;
  url: string;
  caption?: string | null;
  /** درصد افقی کانون کادر (۰ تا ۱۰۰)؛ نبود آن یعنی وسط. */
  focalX?: number | null;
  /** درصد عمودی کانون کادر (۰ تا ۱۰۰)؛ نبود آن یعنی وسط. */
  focalY?: number | null;
  /** ضریب بزرگ‌نمایی داخل خانهٔ خودش؛ نبود آن یعنی بدون زوم. */
  zoom?: number | null;
}

/**
 * یک ردیف از لوازم/مصالح مصرفی در قالب «گزارش کار». دقیقاً مثل
 * PictureCardFrameAttendanceRow، از قبل توسط دیالوگ ساخت گزارش فیلتر شده می‌آید.
 */
export interface PictureCardFrameEquipmentRow {
  id: string;
  name: string;
  code: string;
  /** یادداشت اختیاری (مثلاً مقدار مصرفی)؛ اگر خالی باشد نمایش داده نمی‌شود. */
  note?: string | null;
}

export interface PictureCardFrameProps {
  /** فعلاً فقط یک قالب («گزارش کار») در دسترس است؛ بقیهٔ قالب‌ها چون خراب
   * رندر می‌شدند حذف شدند. این پراپرتی برای سازگاری با فراخوان‌های قبلی
   * نگه داشته شده ولی عملاً روی خروجی تأثیری ندارد. */
  templateId?: PictureCardTemplateId;
  title?: string | null;
  subtitle?: string | null;
  dateLabel?: string | null;
  /** محل پروژه/کارگاه؛ فقط در قالب «گزارش کار» نمایش داده می‌شود. */
  location?: string | null;
  /** توضیحات متنی کار؛ فقط در قالب «گزارش کار» نمایش داده می‌شود. */
  description?: string | null;
  /** ردیف‌های حضور/غیبت مجاز؛ فقط در قالب «گزارش کار» و فقط وقتی حداقل یک ردیف موجود باشد نمایش داده می‌شود. */
  attendanceRows?: PictureCardFrameAttendanceRow[];
  /** ردیف‌های لوازم/مصالح مصرفی؛ کاملاً اختیاری، فقط وقتی حداقل یک ردیف موجود باشد نمایش داده می‌شود. */
  equipmentRows?: PictureCardFrameEquipmentRow[];
  photos: PictureCardFramePhoto[];
  /** عرض کارت بر حسب پیکسل (برای پیش‌نمایش کوچک یا خروجی با کیفیت بالا). */
  width?: number;
}

/**
 * رندر یک پیکچر کارت حرفه‌ای بر اساس قالب و Layout انتخاب‌شده.
 *
 * این کامپوننت هم برای پیش‌نمایش زنده در دیالوگ ساخت/ویرایش، هم برای تصویر
 * کوچک لیست کارت‌ها، و هم برای رندر مخفی جهت خروجی PDF/تصویر استفاده می‌شود؛
 * بنابراین کاملاً بدون وابستگی به state یا تعامل کاربر (pure) نوشته شده است.
 */
export function PictureCardFrame({
  title,
  subtitle,
  dateLabel,
  location,
  description,
  attendanceRows = [],
  equipmentRows = [],
  photos,
  width = 900,
}: PictureCardFrameProps) {
  // فقط قالب «گزارش کار» — تنها قالب پیکچر کارت که فعلاً در اپ فعال است.
  // (قالب‌های دیگر قبلاً اینجا بودند ولی چون خراب رندر می‌شدند حذف شدند.)
  // ------------------------------------------------------------------
  const fieldRow = (icon: ReactNode, label: string, value: string | null | undefined) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: `${width / 130}px`, py: `${width / 130}px` }}>
      <Box
        sx={{
          display: "flex",
          color: "#0F3D33",
          flexShrink: 0,
          "& svg": { fontSize: width / 34 },
        }}
      >
        {icon}
      </Box>
      <Typography
        sx={{ fontFamily: FONT_FAMILY, color: "#0F3D33", fontWeight: 700, fontSize: width / 42, flexShrink: 0 }}
      >
        {label}:
      </Typography>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          borderBottom: "1.5px dotted #B9C4C0",
          pb: `${width / 260}px`,
        }}
      >
        {value && (
          <Typography
            sx={{ fontFamily: FONT_FAMILY, color: "#3A4744", fontWeight: 500, fontSize: width / 44 }}
            noWrap
          >
            {value}
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <Box
      dir="rtl"
      sx={{
        width,
        fontFamily: FONT_FAMILY,
        bgcolor: "#ffffff",
        border: "1px solid #E3E9E7",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 8px 28px rgba(15,61,51,0.12)",
      }}
    >
      {/* هدر: مشخصات پروژه در سمت راست (متن) + نشان سبز عنوان در سمت چپ (بصری) */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: `${width / 30}px`,
          px: `${width / 26}px`,
          pt: `${width / 26}px`,
          pb: `${width / 34}px`,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, pt: `${width / 60}px` }}>
          {fieldRow(<CalendarMonthOutlinedIcon />, "تاریخ", dateLabel)}
          {fieldRow(<PersonOutlineIcon />, "پروژه", subtitle)}
          {fieldRow(<LocationOnOutlinedIcon />, "محل پروژه", location)}
        </Box>

        <Box
          sx={{
            flexShrink: 0,
            alignSelf: "stretch",
            maxWidth: "50%",
            background: "linear-gradient(135deg, #0F3D33 0%, #175048 100%)",
            borderRadius: `${width / 16}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: `${width / 60}px`,
            px: `${width / 26}px`,
            py: `${width / 30}px`,
          }}
        >
          <AssignmentTurnedInOutlinedIcon sx={{ color: "#fff", fontSize: width / 13, flexShrink: 0, opacity: 0.95 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: FONT_FAMILY,
                color: "#fff",
                fontWeight: 800,
                fontSize: width / 20,
                lineHeight: 1.3,
              }}
              noWrap
            >
              {title || "گزارش کار"}
            </Typography>
            {subtitle && (
              <Typography
                sx={{ fontFamily: FONT_FAMILY, color: "rgba(255,255,255,0.85)", fontWeight: 500, fontSize: width / 42, mt: "3px" }}
                noWrap
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/*
        بخش تصاویر گزارش کار — بر خلاف بقیهٔ قالب‌ها (که همیشه با safePhotos
        محدود به حداکثر ۴ عکس کار می‌کنند)، این قالب دو مصرف دارد: هم برای
        «پیکچر کارت» دستی با حداکثر ۴ عکس انتخابی، و هم برای دکمهٔ اشتراک‌گذاری
        سریع «همهٔ عکس‌های همان روز» بدون نیاز به ساخت کارت. برای همین این‌جا
        از خودِ آرایهٔ کامل photos استفاده می‌شود، نه safePhotos، و شبکه هم
        به‌جای گرید ثابت ۲×۲ با ۴ خانه، به‌صورت پویا با هر تعداد عکسی که
        بیاید ردیف‌های جدید اضافه می‌کند.
      */}
      <Box sx={{ px: `${width / 26}px` }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: `${width / 150}px`,
            pb: `${width / 60}px`,
            mb: `${width / 40}px`,
            borderBottom: "1.5px solid #EDF1EF",
          }}
        >
          <Typography sx={{ fontFamily: FONT_FAMILY, color: "#17332C", fontWeight: 700, fontSize: width / 34 }}>
            تصاویر گزارش کار
          </Typography>
          <CameraAltOutlinedIcon sx={{ color: "#17332C", fontSize: width / 32 }} />
        </Box>

        {photos.length === 0 ? (
          <Box
            sx={{
              border: "1.5px dashed #D7DEDB",
              borderRadius: `${width / 40}px`,
              py: `${width / 16}px`,
              textAlign: "center",
            }}
          >
            <ImageOutlinedIcon sx={{ fontSize: width / 14, color: "#C7D0CD" }} />
            <Typography
              sx={{ fontFamily: FONT_FAMILY, fontSize: width / 44, color: "#A8B3AF", mt: `${width / 80}px` }}
            >
              عکسی برای این روز ثبت نشده است.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: `${width / 60}px` }}>
            {photos.map((photo, index) => (
              <Box
                key={photo.id}
                sx={{
                  borderRadius: `${width / 60}px`,
                  border: "1px solid #E3E9E7",
                  overflow: "hidden",
                  bgcolor: "#FAFBFA",
                }}
              >
                <Box sx={{ width: "100%", height: width / 3.45, position: "relative" }}>
                  <CardCellImage
                    url={photo.url}
                    alt={photo.caption || `عکس ${index + 1}`}
                    width={width}
                    focalX={photo.focalX}
                    focalY={photo.focalY}
                    zoom={photo.zoom}
                  />
                </Box>
                {photo.caption && (
                  <Box sx={{ px: `${width / 60}px`, py: `${width / 100}px` }}>
                    <Typography
                      sx={{
                        fontFamily: FONT_FAMILY,
                        fontSize: Math.max(11, width / 65),
                        color: "#3A4744",
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {photo.caption}
                    </Typography>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* بخش حضور و غیاب/غیبت مجاز — فقط وقتی حداقل یک ردیف انتخاب شده باشد
          نمایش داده می‌شود؛ کاملاً اختیاری، دقیقاً مثل توضیحات و عکس‌ها. */}
      {attendanceRows.length > 0 && (
        <Box sx={{ px: `${width / 26}px`, pt: `${width / 30}px` }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: `${width / 150}px`,
              pb: `${width / 60}px`,
              mb: `${width / 40}px`,
              borderBottom: "1.5px solid #EDF1EF",
            }}
          >
            <Typography sx={{ fontFamily: FONT_FAMILY, color: "#17332C", fontWeight: 700, fontSize: width / 34 }}>
              حضور و غیاب
            </Typography>
            <GroupsOutlinedIcon sx={{ color: "#17332C", fontSize: width / 32 }} />
          </Box>

          <Box
            sx={{
              border: "1px solid #E3E9E7",
              borderRadius: `${width / 50}px`,
              overflow: "hidden",
            }}
          >
            {attendanceRows.map((row, index) => (
              <Box
                key={row.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: `${width / 60}px`,
                  px: `${width / 34}px`,
                  py: `${width / 50}px`,
                  borderTop: index === 0 ? "none" : "1px solid #EDF1EF",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: `${width / 100}px`, minWidth: 0 }}>
                  <Box
                    sx={{
                      width: width / 90,
                      height: width / 90,
                      borderRadius: "50%",
                      bgcolor: row.statusColor,
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    sx={{
                      fontFamily: FONT_FAMILY,
                      color: "#22302B",
                      fontWeight: 600,
                      fontSize: width / 42,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.workerFullName}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: `${width / 80}px`, flexShrink: 0 }}>
                  {row.timeLabel && (
                    <Typography
                      sx={{ fontFamily: FONT_FAMILY, color: "#5B6863", fontWeight: 500, fontSize: width / 48 }}
                    >
                      {row.timeLabel}
                    </Typography>
                  )}
                  <Typography
                    sx={{ fontFamily: FONT_FAMILY, color: row.statusColor, fontWeight: 700, fontSize: width / 46 }}
                  >
                    {row.statusLabel}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* بخش لوازم/مصالح مصرفی — فقط وقتی حداقل یک ردیف انتخاب شده باشد
          نمایش داده می‌شود؛ کاملاً اختیاری، دقیقاً مثل بخش حضور و غیاب. */}
      {equipmentRows.length > 0 && (
        <Box sx={{ px: `${width / 26}px`, pt: `${width / 30}px` }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: `${width / 150}px`,
              pb: `${width / 60}px`,
              mb: `${width / 40}px`,
              borderBottom: "1.5px solid #EDF1EF",
            }}
          >
            <Typography sx={{ fontFamily: FONT_FAMILY, color: "#17332C", fontWeight: 700, fontSize: width / 34 }}>
              لوازم و مصالح مصرفی
            </Typography>
            <ConstructionOutlinedIcon sx={{ color: "#17332C", fontSize: width / 32 }} />
          </Box>

          <Box
            sx={{
              border: "1px solid #E3E9E7",
              borderRadius: `${width / 50}px`,
              overflow: "hidden",
            }}
          >
            {equipmentRows.map((row, index) => (
              <Box
                key={row.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: `${width / 60}px`,
                  px: `${width / 34}px`,
                  py: `${width / 50}px`,
                  borderTop: index === 0 ? "none" : "1px solid #EDF1EF",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: `${width / 100}px`, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontFamily: FONT_FAMILY,
                      color: "#22302B",
                      fontWeight: 600,
                      fontSize: width / 42,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.name}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_FAMILY, color: "#94A29D", fontWeight: 500, fontSize: width / 52 }}>
                    {row.code}
                  </Typography>
                </Box>
                {row.note && (
                  <Typography
                    sx={{
                      fontFamily: FONT_FAMILY,
                      color: "#5B6863",
                      fontWeight: 500,
                      fontSize: width / 48,
                      flexShrink: 0,
                    }}
                  >
                    {row.note}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* بخش توضیحات کار */}
      <Box sx={{ px: `${width / 26}px`, pt: `${width / 24}px`, pb: `${width / 30}px` }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: `${width / 150}px`,
            pb: `${width / 60}px`,
            mb: `${width / 40}px`,
            borderBottom: "1.5px solid #EDF1EF",
          }}
        >
          <Typography sx={{ fontFamily: FONT_FAMILY, color: "#17332C", fontWeight: 700, fontSize: width / 34 }}>
            توضیحات کار
          </Typography>
          <EditNoteOutlinedIcon sx={{ color: "#17332C", fontSize: width / 32 }} />
        </Box>

        {description?.trim() ? (
          <Box
            sx={{
              border: "1px solid #E3E9E7",
              borderRadius: `${width / 50}px`,
              px: `${width / 34}px`,
              py: `${width / 34}px`,
            }}
          >
            <Typography
              sx={{
                fontFamily: FONT_FAMILY,
                color: "#3A4744",
                fontWeight: 500,
                fontSize: width / 42,
                lineHeight: 1.9,
                whiteSpace: "pre-wrap",
              }}
            >
              {description}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              border: "1px solid #E3E9E7",
              borderRadius: `${width / 50}px`,
              px: `${width / 34}px`,
              py: `${width / 28}px`,
              display: "flex",
              flexDirection: "column",
              gap: `${width / 24}px`,
            }}
          >
            {[0, 1, 2].map((line) => (
              <Box key={line} sx={{ height: 0, borderBottom: "1.5px dotted #D7DEDB" }} />
            ))}
          </Box>
        )}
      </Box>

      {/* فوتر سبز تیره: تعداد عکس + شعار برند */}
      <Box
        sx={{
          background: "linear-gradient(95deg, #0F3D33 0%, #175048 100%)",
          px: `${width / 26}px`,
          py: `${width / 46}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <Typography
          sx={{ fontFamily: FONT_FAMILY, color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: width / 50 }}
        >
          {photos.length} عکس ثبت‌شده
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: `${width / 150}px` }}>
          <ConstructionOutlinedIcon sx={{ color: "rgba(255,255,255,0.85)", fontSize: width / 30 }} />
          <Typography
            sx={{
              fontFamily: FONT_FAMILY,
              color: "rgba(255,255,255,0.92)",
              fontWeight: 600,
              fontSize: width / 46,
              textAlign: "left",
            }}
          >
            کیفیت امروز، سازندگی فردا
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
