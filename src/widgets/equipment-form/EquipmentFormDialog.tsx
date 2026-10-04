import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CreateEquipmentInput, Equipment, UpdateEquipmentInput } from "../../entities/Equipment";

interface EquipmentFormDialogProps {
  open: boolean;
  equipment?: Equipment | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEquipmentInput | UpdateEquipmentInput) => void;
}

export function EquipmentFormDialog({ open, equipment, loading, onClose, onSubmit }: EquipmentFormDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setCode(equipment?.code || "");
      setName(equipment?.name || "");
      setUnit(equipment?.unit || "عدد");
      setTotalQuantity(equipment ? String(equipment.totalQuantity) : "");
      setDescription(equipment?.description || "");
      setErrors({});
    }
  }, [open, equipment]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "نام لوازم الزامی است.";
    if (!unit.trim()) e.unit = "واحد شمارش الزامی است.";
    const qty = Number(totalQuantity);
    if (!totalQuantity || isNaN(qty) || qty < 0) e.totalQuantity = "تعداد باید عددی مثبت باشد.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit({
      // اگر کاربر خالی بگذارد، سرویس خودش یک کد خودکار تولید می‌کند (فقط
      // موقع ساخت قلم جدید؛ موقع ویرایش، کد قبلی دست‌نخورده می‌ماند چون
      // کلید undefined ارسال نمی‌شود).
      ...(equipment ? { code: code.trim() || equipment.code } : code.trim() ? { code: code.trim() } : {}),
      name: name.trim(),
      unit: unit.trim(),
      totalQuantity: Number(totalQuantity),
      description: description.trim() || null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {equipment ? "ویرایش لوازم" : "افزودن لوازم جدید"}
        <IconButton onClick={onClose} size="small" aria-label="بستن">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <TextField
            label="کد شناسایی (اختیاری)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={equipment ? equipment.code : "خالی بگذارید تا خودکار ساخته شود"}
            helperText="برای چسباندن روی خودِ قلم یا جستجوی سریع؛ اگر خالی بماند خودکار ساخته می‌شود."
          />
          <TextField
            label="نام لوازم"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            placeholder="مثلا: بتونیر، کلاه ایمنی، بیل"
            autoFocus
          />
          <TextField
            label="واحد شمارش"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            error={!!errors.unit}
            helperText={errors.unit}
            placeholder="عدد، دستگاه، متر، کیلوگرم"
          />
          <TextField
            label="تعداد کل موجود در کارگاه"
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(e.target.value.replace(/[^\d.]/g, ""))}
            error={!!errors.totalQuantity}
            helperText={errors.totalQuantity}
            inputMode="numeric"
          />
          <TextField
            label="توضیحات (اختیاری)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          انصراف
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {equipment ? "ذخیره تغییرات" : "افزودن"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
