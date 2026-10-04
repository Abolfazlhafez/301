import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ApartmentIcon from "@mui/icons-material/Apartment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { projectsApi } from "../../shared/api/projectsApi";
import { useToast } from "../../shared/components/ToastProvider";
import type { Project } from "../../entities/Project";

/**
 * کارت «پروژه‌ها» در صفحهٔ تنظیمات — همان قابلیت سوییچ/ساخت/ویرایش/حذف پروژه
 * که در نوار بالا (`ProjectSwitcher`) هست، اینجا هم در دسترس قرار می‌گیرد؛
 * چون مورد ۲ فهرست کارها صراحتاً «سوییچر پروژه در تنظیمات» را هم خواسته،
 * نه فقط نوار بالا. عمداً یک کامپوننت جدا و سبک است (نه از ProjectSwitcher
 * صدا زده می‌شود) چون آن کامپوننت با استایل دکمهٔ نوار بالای تیره طراحی شده
 * و بازاستفادهٔ مستقیمش داخل یک Card ریسک بهم‌ریختن ظاهر نوار بالا را داشت؛
 * منطق (همان projectsApi و همان کوئری‌کلیدها) کاملاً یکی است تا هر دو جا
 * همیشه هم‌گام بمانند.
 */
export function ProjectsSettingsCard() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formName, setFormName] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formSupervisor, setFormSupervisor] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
  });
  const { data: activeProjectId } = useQuery({
    queryKey: ["projects", "active"],
    queryFn: () => projectsApi.getActiveProjectId(),
  });

  function invalidateProjectQueries() {
    // دقیقاً همان دلیل ProjectSwitcher: با تغییر پروژهٔ فعال، تقریباً همهٔ
    // دادهٔ صفحات باید از نو خوانده شود.
    queryClient.invalidateQueries();
  }

  const switchMutation = useMutation({
    mutationFn: (id: string) => projectsApi.setActiveProjectId(id),
    onSuccess: invalidateProjectQueries,
    onError: () => showToast(t("topbar.project.nameRequired") as string, "error"),
  });

  const createMutation = useMutation({
    mutationFn: () => projectsApi.create({ name: formName, location: formLocation, supervisorName: formSupervisor }),
    onSuccess: async (created) => {
      await projectsApi.setActiveProjectId(created.id);
      invalidateProjectQueries();
      closeDialog();
    },
    onError: (err) => showToast(err instanceof Error ? err.message : String(err), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      projectsApi.update(editingProject!.id, { name: formName, location: formLocation, supervisorName: formSupervisor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      closeDialog();
    },
    onError: (err) => showToast(err instanceof Error ? err.message : String(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: invalidateProjectQueries,
    onError: (err) => showToast(err instanceof Error ? err.message : String(err), "error"),
  });

  function openCreateDialog() {
    setFormName("");
    setFormLocation("");
    setFormSupervisor("");
    setEditingProject(null);
    setDialogMode("create");
  }

  function openEditDialog(project: Project) {
    setFormName(project.name);
    setFormLocation(project.location);
    setFormSupervisor(project.supervisorName);
    setEditingProject(project);
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingProject(null);
  }

  function handleSave() {
    if (!formName.trim()) {
      showToast(t("topbar.project.nameRequired") as string, "error");
      return;
    }
    if (dialogMode === "create") createMutation.mutate();
    else updateMutation.mutate();
  }

  function handleDelete(project: Project) {
    if (projects.length <= 1) {
      showToast(t("topbar.project.cannotDeleteLast") as string, "error");
      return;
    }
    if (window.confirm(t("topbar.project.deleteConfirm", { name: project.name }) as string)) {
      deleteMutation.mutate(project.id);
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <ApartmentIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700}>
            {t("settings.projectsSection.title")}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("settings.projectsSection.description")}
        </Typography>

        <List dense disablePadding>
          {projects.map((project) => (
            <ListItem
              key={project.id}
              disablePadding
              secondaryAction={
                <Stack direction="row" spacing={0.5}>
                  <IconButton size="small" onClick={() => openEditDialog(project)} aria-label={t("topbar.project.renameProject") as string}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(project)} aria-label={t("topbar.project.deleteProject") as string}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              }
            >
              <ListItemButton
                selected={project.id === activeProjectId}
                onClick={() => {
                  if (project.id !== activeProjectId) switchMutation.mutate(project.id);
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {project.id === activeProjectId ? (
                    <CheckCircleIcon fontSize="small" color="primary" />
                  ) : (
                    <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
                  )}
                </ListItemIcon>
                <ListItemText primary={project.name} secondary={project.location || undefined} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 1.5 }} />

        <Button startIcon={<AddIcon />} onClick={openCreateDialog} size="small">
          {t("topbar.project.newProject")}
        </Button>
      </CardContent>

      <Dialog open={dialogMode !== null} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {dialogMode === "create" ? t("topbar.project.dialogCreateTitle") : t("topbar.project.dialogEditTitle")}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label={t("topbar.project.nameLabel")}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              label={t("topbar.project.locationLabel")}
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              fullWidth
            />
            <TextField
              label={t("topbar.project.supervisorLabel")}
              value={formSupervisor}
              onChange={(e) => setFormSupervisor(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>{t("topbar.project.cancel")}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {t("topbar.project.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
