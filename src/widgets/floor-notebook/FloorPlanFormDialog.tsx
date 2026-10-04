import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useTranslation } from "react-i18next";
import { CreateFloorPlanInput, FLOOR_PLAN_CATEGORIES, FloorPlan, FloorPlanCategory } from "../../entities/FloorPlan";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import { JalaliDatePicker } from "../../shared/components/JalaliDatePicker";

interface FloorPlanFormDialogProps {
  open: boolean;
  floorId: string;
  /** اگر داده شود، فرم برای «نسخهٔ جدید» همین نقشه باز می‌شود (نه ویرایش مستقیم). */
  revisionOf?: FloorPlan | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateFloorPlanInput) => void;
}

export function FloorPlanFormDialog({ open, floorId, revisionOf, loading, onClose, onSubmit }: FloorPlanFormDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FloorPlanCategory>("architecture");
  const [code, setCode] = useState("");
  const [revision, setRevision] = useState("");
  const [designer, setDesigner] = useState("");
  const [date, setDate] = useState(getTodayIso());
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTitle(revisionOf?.title || "");
      setCategory(revisionOf?.category || "architecture");
      setCode(revisionOf?.code || "");
      setRevision("");
      setDesigner(revisionOf?.designer || "");
      setDate(getTodayIso());
      setDescription(revisionOf?.description || "");
      setFile(null);
      setErrors({});
    }
  }, [open, revisionOf]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = t("floor.form.plan.title") as string;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit({
      floorId,
      title: title.trim(),
      category,
      code: code.trim() || null,
      revision: revision.trim() || null,
      designer: designer.trim() || null,
      date,
      description: description.trim() || null,
      file,
      parentPlanId: revisionOf?.id ?? null,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {revisionOf ? t("floor.docsTab.viewRevisions") : t("floor.form.plan.addTitle")}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          {revisionOf && (
            <Typography variant="caption" color="text.secondary">
              {t("floor.form.plan.newRevisionOf")}: {revisionOf.title}
            </Typography>
          )}
          <TextField
            label={t("floor.form.plan.title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!!errors.title}
            helperText={errors.title}
            autoFocus
          />
          <TextField select label={t("floor.form.plan.category")} value={category} onChange={(e) => setCategory(e.target.value as FloorPlanCategory)}>
            {FLOOR_PLAN_CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {t(`floor.planCategory.${c}`)}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1.5}>
            <TextField label={t("floor.form.plan.code")} value={code} onChange={(e) => setCode(e.target.value)} fullWidth />
            <TextField label={t("floor.form.plan.revision")} value={revision} onChange={(e) => setRevision(e.target.value)} fullWidth />
          </Stack>
          <TextField label={t("floor.form.plan.designer")} value={designer} onChange={(e) => setDesigner(e.target.value)} />
          <JalaliDatePicker label={t("floor.form.plan.date") as string} value={date} onChange={setDate} />
          <TextField label={t("floor.form.plan.description")} value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} />

          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}>
            {file ? file.name : (t("floor.form.plan.file") as string)}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          {t("floor.form.plan.cancel")}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {t("floor.form.plan.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
