import { IconButton, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { TimeLoss } from "../../entities/TimeLoss";
import { formatMinutesToText } from "../../shared/utils/format";

interface TimeLossItemProps {
  timeLoss: TimeLoss;
  onEdit: (timeLoss: TimeLoss) => void;
  onDelete: (timeLoss: TimeLoss) => void;
}

export function TimeLossItem({ timeLoss, onEdit, onDelete }: TimeLossItemProps) {
  const { t } = useTranslation();
  return (
    <ListItem
      disableGutters
      sx={{ py: 0.75 }}
      secondaryAction={
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={() => onEdit(timeLoss)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => onDelete(timeLoss)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
    >
      <ListItemText
        primary={
          <Typography variant="body2" fontWeight={600}>
            {timeLoss.reason} — {timeLoss.startTime} {t("timeLoss.item.rangeSeparator")} {timeLoss.endTime}
          </Typography>
        }
        secondary={`${formatMinutesToText(timeLoss.durationMinutes)}${
          timeLoss.note ? " — " + timeLoss.note : ""
        }`}
      />
    </ListItem>
  );
}
