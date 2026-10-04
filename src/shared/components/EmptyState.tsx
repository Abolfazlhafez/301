import { Box, Typography } from "@mui/material";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      gap={1.5}
      py={6}
      px={2}
    >
      {icon && (
        <Box sx={{ color: "text.disabled", fontSize: 56, display: "flex" }}>{icon}</Box>
      )}
      <Typography variant="subtitle1" fontWeight={600}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" maxWidth={320}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}
