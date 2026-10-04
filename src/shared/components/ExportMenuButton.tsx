import { useState } from "react";
import { Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem, ListSubheader } from "@mui/material";
import { useTranslation } from "react-i18next";
import IosShareIcon from "@mui/icons-material/IosShare";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import GridOnIcon from "@mui/icons-material/GridOn";
import SaveAltIcon from "@mui/icons-material/SaveAlt";

interface ExportMenuButtonProps {
  onExportImage: () => void | Promise<void>;
  onExportExcel: () => void | Promise<void>;
  /**
   * ذخیرهٔ مستقیم عکس در حافظهٔ گوشی، بدون بازکردن منوی اشتراک‌گذاری.
   * اختیاری است: اگر داده نشود، آیتم منوی متناظر اصلاً نمایش داده نمی‌شود
   * — یعنی جاهایی از اپ که هنوز به‌روزرسانی نشده‌اند، دقیقاً مثل قبل کار
   * می‌کنند (بدون هیچ تغییر رفتاری ناخواسته).
   */
  onSaveImageToDevice?: () => void | Promise<void>;
  /** معادل onSaveImageToDevice، برای خروجی اکسل/CSV. */
  onSaveExcelToDevice?: () => void | Promise<void>;
  disabled?: boolean;
  label?: string;
}

/**
 * دکمهٔ مشترک «خروجی» با گزینه‌های عکس (برای اشتراک‌گذاری سریع در پیام‌رسان‌ها)
 * و اکسل/CSV (برای بایگانی یا محاسبات بیشتر در اکسل)، به‌علاوهٔ گزینهٔ
 * «ذخیره در گوشی» برای هرکدام — چون قبلاً تنها راه نگه‌داشتن فایل، عبور از
 * منوی اشتراک‌گذاری سیستم و پیداکردن گزینهٔ «ذخیره در فایل‌ها» توسط خودِ
 * کاربر بود؛ الان یک اقدام مستقیم و قطعی است. هم در «دفتر حساب» و هم در
 * «مدیریت حساب» استفاده می‌شود تا رفتار و ظاهر این خروجی‌ها همه‌جای اپ یکسان باشد.
 */
export function ExportMenuButton({
  onExportImage,
  onExportExcel,
  onSaveImageToDevice,
  onSaveExcelToDevice,
  disabled,
  label,
}: ExportMenuButtonProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const hasSaveToDeviceOptions = !!onSaveImageToDevice || !!onSaveExcelToDevice;

  async function handlePick(action: () => void | Promise<void>) {
    setAnchorEl(null);
    setIsExporting(true);
    try {
      await action();
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<IosShareIcon fontSize="small" />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={disabled || isExporting}
      >
        {isExporting ? t("common.exportMenu.exporting") : label ?? t("common.exportMenu.label")}
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => handlePick(onExportImage)}>
          <ListItemIcon>
            <ImageOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("common.exportMenu.shareImage")}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handlePick(onExportExcel)}>
          <ListItemIcon>
            <GridOnIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("common.exportMenu.shareExcel")}</ListItemText>
        </MenuItem>
        {hasSaveToDeviceOptions && [
          <Divider key="save-divider" />,
          <ListSubheader key="save-subheader" sx={{ lineHeight: 2.2 }}>
            {t("common.exportMenu.saveToDeviceHeader")}
          </ListSubheader>,
          onSaveImageToDevice && (
            <MenuItem key="save-image" onClick={() => handlePick(onSaveImageToDevice)}>
              <ListItemIcon>
                <SaveAltIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t("common.exportMenu.saveImage")}</ListItemText>
            </MenuItem>
          ),
          onSaveExcelToDevice && (
            <MenuItem key="save-excel" onClick={() => handlePick(onSaveExcelToDevice)}>
              <ListItemIcon>
                <SaveAltIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t("common.exportMenu.saveExcel")}</ListItemText>
            </MenuItem>
          ),
        ]}
      </Menu>
    </>
  );
}
