import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { alpha } from "@mui/material/styles";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { projectsApi } from "../../shared/api/projectsApi";
import { useToast } from "../../shared/components/ToastProvider";
import type { Project } from "../../entities/Project";

/**
 * سوییچر پروژه در بالای برنامه — تنها راه دیدن/تعویض/ساخت/ویرایش/حذف
 * پروژه‌ها. بدون این کامپوننت، همهٔ زیرساخت چند-پروژه‌ای که در سرویس‌ها و
 * دیتابیس ساخته شده، از دید کاربر کاملاً نامرئی می‌ماند.
 */
export function ProjectSwitcher() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
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
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  function invalidateProjectQueries() {
    // با تغییر پروژهٔ فعال، تقریباً همهٔ داده‌های صفحه (طبقات، نیروها، دفتر
    // حساب، حضور و غیاب و...) باید از نو خوانده شوند؛ به‌جای فهرست‌کردن
    // تک‌تک queryKeyها (که با هر جدول جدید ناقص می‌شود)، کل کش را بی‌اعتبار
    // می‌کنیم تا هیچ صفحه‌ای داده‌ی پروژهٔ قبلی را نشان ندهد.
    queryClient.invalidateQueries();
  }

  const switchMutation = useMutation({
    mutationFn: (id: string) => projectsApi.setActiveProjectId(id),
    onSuccess: () => {
      invalidateProjectQueries();
      setMenuAnchor(null);
    },
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
    onSuccess: () => {
      invalidateProjectQueries();
      setMenuAnchor(null);
    },
    onError: (err) => showToast(err instanceof Error ? err.message : String(err), "error"),
  });

  function openCreateDialog() {
    setFormName("");
    setFormLocation("");
    setFormSupervisor("");
    setEditingProject(null);
    setDialogMode("create");
    setMenuAnchor(null);
  }

  function openEditDialog(project: Project) {
    setFormName(project.name);
    setFormLocation(project.location);
    setFormSupervisor(project.supervisorName);
    setEditingProject(project);
    setDialogMode("edit");
    setMenuAnchor(null);
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
    <>
      <Button
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        color="inherit"
        aria-label={t("topbar.project.switcherAria") as string}
        sx={{
          justifyContent: "flex-start",
          textTransform: "none",
          minWidth: 0,
          maxWidth: "48vw",
          gap: 0.5,
          pl: 1.25,
          pr: 0.75,
          py: 0.5,
          borderRadius: 999,
          bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.06 : 0.045),
          "&:hover": {
            bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.1 : 0.07),
          },
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ fontSize: "1.05rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {activeProject?.name || t("app.name")}
        </Typography>
        <ExpandMoreIcon fontSize="small" sx={{ flexShrink: 0, color: "text.secondary" }} />
      </Button>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {projects.map((project) => (
          <MenuItem
            key={project.id}
            selected={project.id === activeProject?.id}
            onClick={() => {
              if (project.id !== activeProject?.id) switchMutation.mutate(project.id);
              else setMenuAnchor(null);
            }}
          >
            <ListItemIcon>{project.id === activeProject?.id ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            <ListItemText primary={project.name} secondary={project.location || undefined} />
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                openEditDialog(project);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(project);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={openCreateDialog}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("topbar.project.newProject")} />
        </MenuItem>
      </Menu>

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
    </>
  );
}
