import { List, ListItem, ListItemText, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { FloorActivityEvent } from "../../entities/FloorActivityEvent";
import { EmptyState } from "../../shared/components/EmptyState";

interface FloorActivityFeedProps {
  events: FloorActivityEvent[];
}

export function FloorActivityFeed({ events }: FloorActivityFeedProps) {
  const { t } = useTranslation();

  if (events.length === 0) {
    return <EmptyState title={t("floor.overview.activityEmpty") as string} />;
  }

  return (
    <List dense disablePadding>
      {events.map((event) => (
        <ListItem key={event.id} disableGutters sx={{ py: 0.5 }}>
          <ListItemText
            primary={t(event.messageKey, event.params ?? undefined) as string}
            secondary={
              <Typography variant="caption" color="text.secondary">
                {new Date(event.createdAt).toLocaleString()}
              </Typography>
            }
          />
        </ListItem>
      ))}
    </List>
  );
}
