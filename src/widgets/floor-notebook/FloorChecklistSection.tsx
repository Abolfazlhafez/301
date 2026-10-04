import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { useTranslation } from "react-i18next";
import { floorChecklistApi } from "../../shared/api/floorChecklistApi";
import { extractErrorMessage } from "../../shared/api/client";
import type { FloorChecklistItem } from "../../entities/FloorChecklistItem";
import { useToast } from "../../shared/components/ToastProvider";
import { workersApi } from "../../shared/api/workersApi";
import { projectsApi } from "../../shared/api/projectsApi";
import { PhotoGalleryDialog } from "../photo-gallery/PhotoGalleryDialog";

interface FloorChecklistSectionProps {
  floorId: string;
}

function itemTitle(item: FloorChecklistItem, t: (key: string) => unknown): string {
  if (!item.isCustom && item.key) return String(t(`floor.checklistTitle.${item.key}`));
  return item.title;
}

export function FloorChecklistSection({ floorId }: FloorChecklistSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [newItemTitle, setNewItemTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FloorChecklistItem | null>(null);
  const [editStatus, setEditStatus] = useState<FloorChecklistItem["status"]>("pending");
  const [editNote, setEditNote] = useState("");
  const [editWorkerId, setEditWorkerId] = useState("");
  const [photosItem, setPhotosItem] = useState<FloorChecklistItem | null>(null);

  const { data: workers = [] } = useQuery({
    queryKey: ["workers", "active", floorId],
    queryFn: async () => {
      const projectId = await projectsApi.getActiveProjectId();
      return workersApi.list({ isActive: true, projectId });
    },
  });

  const { data } = useQuery({
    queryKey: ["floorChecklist", floorId],
    queryFn: () => floorChecklistApi.listByFloor(floorId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["floorChecklist", floorId] });
    queryClient.invalidateQueries({ queryKey: ["floors", floorId] });
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FloorChecklistItem["status"] }) =>
      floorChecklistApi.update(id, { status }),
    onSuccess: invalidate,
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const editMutation = useMutation({
    mutationFn: () => floorChecklistApi.update(editing!.id, { status: editStatus, note: editNote.trim() || null, workerId: editWorkerId || null }),
    onSuccess: () => { invalidate(); setEditing(null); showToast(t("floor.toasts.checklistUpdated") as string, "success"); },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const addMutation = useMutation({
    mutationFn: () => floorChecklistApi.create({ floorId, title: newItemTitle.trim() }),
    onSuccess: () => {
      invalidate();
      showToast(t("floor.toasts.checklistItemAdded") as string, "success");
      setNewItemTitle("");
      setAdding(false);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1} flexWrap="wrap" rowGap={0.5}>
        <Typography variant="subtitle1" fontWeight={700}>
          {t("floor.tasksTab.checklistTitle")}
        </Typography>
        {/* خلاصهٔ سریع پیشرفت چک‌لیست — بدون نیاز به شمردن دستی آیتم‌های
            تیک‌خورده در یک لیست بلند. «تکمیل» فقط یعنی passed؛ آیتم‌های
            failed هنوز کار دارند، پس در شمارش تکمیل حساب نمی‌شوند. */}
        {(data ?? []).length > 0 && (
          <Stack direction="row" spacing={0.5}>
            <Chip
              size="small"
              variant="outlined"
              label={t("floor.checklistProgress.completedCount", {
                completed: (data ?? []).filter((i) => i.status === "passed").length,
                total: (data ?? []).length,
              }) as string}
              sx={{ height: 20, fontSize: 11 }}
            />
            {(data ?? []).some((i) => i.status === "failed") && (
              <Chip
                size="small"
                color="error"
                variant="outlined"
                label={t("floor.checklistProgress.failedCount", {
                  count: (data ?? []).filter((i) => i.status === "failed").length,
                }) as string}
                sx={{ height: 20, fontSize: 11 }}
              />
            )}
          </Stack>
        )}
      </Stack>
      <Stack spacing={0.5}>
        {(data ?? []).map((item) => (
          <Stack key={item.id} direction="row" alignItems="center" spacing={1}>
            <Checkbox
              checked={item.status === "passed"}
              indeterminate={item.status === "failed"}
              onChange={(e) =>
                toggleMutation.mutate({ id: item.id, status: e.target.checked ? "passed" : "pending" })
              }
              size="small"
            />
            <Typography
              variant="body2"
              sx={{ textDecoration: item.status === "passed" ? "line-through" : "none", flex: 1 }}
            >
              {itemTitle(item, t)}
            </Typography>
            {item.status === "failed" && (
              <Chip size="small" color="error" label={t("floor.checklistStatus.failed")} sx={{ height: 18, fontSize: 10 }} />
            )}
            <IconButton size="small" onClick={() => setPhotosItem(item)} aria-label={t("floor.checklist.photos") as string}>
              <PhotoCameraIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => { setEditing(item); setEditStatus(item.status); setEditNote(item.note || ""); setEditWorkerId(item.workerId || ""); }} aria-label={t("floor.form.checklistItem.edit") as string}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      <PhotoGalleryDialog
        open={!!photosItem}
        title={photosItem ? `${t("floor.checklist.photos")} · ${itemTitle(photosItem, t)}` : t("floor.checklist.photos") as string}
        relatedType="floor"
        relatedId={photosItem ? floorId : null}
        floorId={floorId}
        checklistItemId={photosItem?.id}
        onClose={() => setPhotosItem(null)}
      />

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t("floor.form.checklistItem.edit")}</DialogTitle>
        <DialogContent><Stack spacing={2} mt={0.5}>
          <TextField select label={t("floor.checklistStatus.label")} value={editStatus} onChange={(e) => setEditStatus(e.target.value as FloorChecklistItem["status"])}>
            <MenuItem value="pending">{t("floor.checklistStatus.pending")}</MenuItem>
            <MenuItem value="passed">{t("floor.checklistStatus.passed")}</MenuItem>
            <MenuItem value="failed">{t("floor.checklistStatus.failed")}</MenuItem>
          </TextField>
          <TextField select label={t("floor.form.checklistItem.worker")} value={editWorkerId} onChange={(e) => setEditWorkerId(e.target.value)}>
            <MenuItem value="">{t("floor.form.task.noWorker")}</MenuItem>
            {workers.map(w => <MenuItem key={w.id} value={w.id}>{w.firstName} {w.lastName}</MenuItem>)}
          </TextField>
          <TextField label={t("floor.form.checklistItem.note")} value={editNote} onChange={(e) => setEditNote(e.target.value)} multiline minRows={2} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setEditing(null)} color="inherit">{t("floor.form.task.cancel")}</Button><Button variant="contained" disabled={editMutation.isPending} onClick={() => editMutation.mutate()}>{t("floor.form.task.save")}</Button></DialogActions>
      </Dialog>

      {adding ? (
        <Stack direction="row" spacing={1} mt={1}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder={t("floor.form.checklistItem.title") as string}
          />
          <Button
            size="small"
            variant="contained"
            disabled={!newItemTitle.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            {t("floor.form.checklistItem.save")}
          </Button>
        </Stack>
      ) : (
        <Button size="small" startIcon={<AddIcon />} onClick={() => setAdding(true)} sx={{ mt: 1 }}>
          {t("floor.tasksTab.checklistAddItem")}
        </Button>
      )}
    </Box>
  );
}
