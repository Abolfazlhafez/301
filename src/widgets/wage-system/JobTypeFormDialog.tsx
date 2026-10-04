import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { jobTypeApi } from "../../shared/api/jobTypeApi";
import { wageMethodApi } from "../../shared/api/wageMethodApi";
import { JOB_CATEGORY_LABELS, JobCategory } from "../../entities/JobType";
import type { JobType } from "../../entities/JobType";
import { JobTypeIcon } from "../../shared/components/JobTypeIcon";
import { useToast } from "../../shared/components/ToastProvider";
import { extractErrorMessage } from "../../shared/api/client";

// فهرست کلیدهای آیکون قابل انتخاب — همان‌هایی که در JobTypeIcon.tsx ثبت شده‌اند.
// این‌جا صرفاً برای رندر گزینه‌های انتخاب تکرار شده (بدون export کردن رجیستری از آن فایل).
const ICON_OPTIONS = [
  "trowelBrick", "wallBrick", "concreteBlock", "plasterTrowel", "cementMix", "paintRoller",
  "tileGrid", "stoneSlab", "rebarBend", "formwork", "concretePour", "weldingMask", "steelFrame",
  "electricBolt", "conduitPanel", "pipeWrench", "gasFlame", "drainPipe", "pipeFitting",
  "windowFrame", "doorInstall", "cabinetBox", "sawBlade", "drywallPanel", "ceilingGrid",
  "facadePanel", "bitumenRoll", "asphaltRoad", "floorTile", "parquetPlank", "scaffold",
  "demolitionHammer", "excavator", "wheelbarrow", "craneHook", "guardShield", "generalWorker",
  "elevatorCar", "stairSteps", "upvcFrame", "floorCoveringRoll", "pipeInstall", "diggingShovel",
  "materialCarry",
];

const CATEGORIES = Object.keys(JOB_CATEGORY_LABELS) as JobCategory[];

interface JobTypeFormDialogProps {
  open: boolean;
  existing?: JobType | null;
  onClose: () => void;
}

export function JobTypeFormDialog({ open, existing, onClose }: JobTypeFormDialogProps) {
  const { t } = useTranslation();
  const categoryLabels: Record<JobCategory, string> = {
    structure: t("jobType.category.structure"),
    masonry: t("jobType.category.masonry"),
    finishing: t("jobType.category.finishing"),
    flooring: t("jobType.category.flooring"),
    mep: t("jobType.category.mep"),
    installation: t("jobType.category.installation"),
    sitework: t("jobType.category.sitework"),
    other: t("jobType.category.other"),
  };
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<JobCategory>("other");
  const [iconKey, setIconKey] = useState("generalWorker");
  const [wageNote, setWageNote] = useState("");
  const [selectedMethodIds, setSelectedMethodIds] = useState<Set<string>>(new Set());

  const { data: wageMethods = [] } = useQuery({
    queryKey: ["wage-methods"],
    queryFn: () => wageMethodApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setCategory(existing?.category ?? "other");
    setIconKey(existing?.iconKey ?? "generalWorker");
    setWageNote(existing?.wageNote ?? "");
    setSelectedMethodIds(new Set(existing?.suggestedWageMethodIds ?? []));
  }, [open, existing]);

  function toggleMethod(id: string) {
    setSelectedMethodIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        category,
        iconKey,
        wageNote: wageNote.trim(),
        suggestedWageMethodIds: Array.from(selectedMethodIds),
      };
      return existing ? jobTypeApi.update(existing.id, payload) : jobTypeApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-types"] });
      showToast(existing ? t("jobType.toastUpdated") as string : t("jobType.toastCreated") as string, "success");
      onClose();
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const canSubmit = !!name.trim();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" fontWeight={700}>
          {existing ? t("jobType.editTitle") : t("jobType.createTitle")}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} mt={0.5}>
          <TextField label={t("jobType.nameLabel")} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label={t("jobType.descriptionLabel")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />
          <TextField select label={t("jobType.categoryLabel")} value={category} onChange={(e) => setCategory(e.target.value as JobCategory)}>
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {categoryLabels[c]}
              </MenuItem>
            ))}
          </TextField>

          <Box>
            <Typography variant="body2" fontWeight={600} mb={1}>
              {t("jobType.iconLabel")}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 0.75 }}>
              {ICON_OPTIONS.map((key) => (
                <Box
                  key={key}
                  onClick={() => setIconKey(key)}
                  sx={{
                    aspectRatio: "1",
                    borderRadius: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: iconKey === key ? "primary.main" : "divider",
                    bgcolor: iconKey === key ? "action.selected" : "transparent",
                  }}
                >
                  <JobTypeIcon iconKey={key} fontSize="small" />
                </Box>
              ))}
            </Box>
          </Box>

          <TextField
            label={t("jobType.wageNoteLabel")}
            value={wageNote}
            onChange={(e) => setWageNote(e.target.value)}
            multiline
            minRows={2}
            helperText={t("jobType.wageNoteHelper")}
          />

          <Box>
            <Typography variant="body2" fontWeight={600} mb={0.5}>
              {t("jobType.suggestedMethodsLabel")}
            </Typography>
            <Stack>
              {wageMethods.map((m) => (
                <FormControlLabel
                  key={m.id}
                  control={<Checkbox checked={selectedMethodIds.has(m.id)} onChange={() => toggleMethod(m.id)} size="small" />}
                  label={<Typography variant="body2">{m.formula.name}</Typography>}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          {t("jobType.cancel")}
        </Button>
        <Button onClick={() => mutation.mutate()} variant="contained" disabled={mutation.isPending || !canSubmit}>
          {mutation.isPending ? t("jobType.saving") : t("jobType.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
