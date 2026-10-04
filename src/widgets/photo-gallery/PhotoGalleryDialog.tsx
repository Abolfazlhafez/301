import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { PhotoRelatedType } from "../../entities/Photo";
import { PhotoGallery } from "./PhotoGallery";

interface PhotoGalleryDialogProps {
  open: boolean;
  title: string;
  relatedType: PhotoRelatedType;
  relatedId: string | null;
  floorId?: string;
  stageId?: string;
  taskId?: string;
  issueId?: string;
  checklistItemId?: string;
  onClose: () => void;
}

export function PhotoGalleryDialog({ open, title, relatedType, relatedId, floorId, stageId, taskId, issueId, checklistItemId, onClose }: PhotoGalleryDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {title}
        <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pb: 4 }}>
        {open && <PhotoGallery relatedType={relatedType} relatedId={relatedId} floorId={floorId} stageId={stageId} taskId={taskId} issueId={issueId} checklistItemId={checklistItemId} compact />}
      </DialogContent>
    </Dialog>
  );
}
