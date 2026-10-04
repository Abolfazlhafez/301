import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { workerGroupApi } from "../../shared/api/workerGroupApi";
import { extractErrorMessage } from "../../shared/api/client";
import { useToast } from "../../shared/components/ToastProvider";
import type { Worker } from "../../entities/Worker";
import type { WorkerGroup } from "../../entities/WorkerGroup";

interface WorkerGroupFormDialogProps {
  open: boolean;
  existing: WorkerGroup | null;
  /** فهرست همهٔ نیروهای پروژهٔ فعال — برای انتخاب اعضای اکیپ. */
  workers: Worker[];
  onClose: () => void;
}

/**
 * فرم ساخت/ویرایش یک اکیپ: نام، توضیح اختیاری، و فهرست تیک‌خور نیروهایی
 * که عضو این اکیپ‌اند. یک نیرو می‌تواند هم‌زمان عضو چند اکیپ باشد (مثلاً
 * گاهی با اکیپ گچ‌کار و گاهی با اکیپ نقاش کار می‌کند)، پس هیچ محدودیتی
 * روی انتخاب اعضای مشترک بین اکیپ‌های مختلف اعمال نمی‌شود.
 */
export function WorkerGroupFormDialog({ open, existing, workers, onClose }: WorkerGroupFormDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setSelectedIds(existing?.memberWorkerIds ?? []);
  }, [open, existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), description: description.trim() || null, memberWorkerIds: selectedIds };
      if (existing) {
        return workerGroupApi.update(existing.id, payload);
      }
      return workerGroupApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-groups"] });
      showToast(existing ? "اکیپ ویرایش شد." : "اکیپ اضافه شد.", "success");
      onClose();
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  function toggleMember(workerId: string) {
    setSelectedIds((prev) => (prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]));
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          {existing ? "ویرایش اکیپ" : "اکیپ جدید"}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="بستن">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="نام اکیپ"
            placeholder="مثلاً: اکیپ گچ‌کار محمدی"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            fullWidth
          />
          <TextField
            label="توضیح (اختیاری)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          <Divider />

          <Box>
            <Typography variant="body2" fontWeight={700} mb={0.5}>
              اعضای اکیپ
            </Typography>
            <Typography variant="caption" color="text.secondary">
              نیروهایی که با هم این اکیپ را تشکیل می‌دهند را انتخاب کنید.
            </Typography>
          </Box>

          {workers.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              هنوز هیچ نیرویی ثبت نشده است.
            </Typography>
          ) : (
            <List
              dense
              sx={{ maxHeight: 260, overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 2 }}
            >
              {workers.map((w) => {
                const checked = selectedIds.includes(w.id);
                return (
                  <ListItemButton key={w.id} onClick={() => toggleMember(w.id)} dense>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple size="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${w.firstName} ${w.lastName}`}
                      secondary={w.position || undefined}
                      primaryTypographyProps={{ variant: "body2" }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}

          {selectedIds.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {selectedIds.length} نفر انتخاب شده
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saveMutation.isPending}>
          انصراف
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          variant="contained"
          disabled={saveMutation.isPending || !name.trim()}
        >
          {saveMutation.isPending ? "در حال ذخیره..." : "ذخیره"}
        </Button>
      </Stack>
    </Dialog>
  );
}
