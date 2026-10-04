import { Box, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={2}
      py={6}
    >
      <CircularProgress color="primary" />
      <Typography variant="body2" color="text.secondary">
        {message ?? t("common.loading")}
      </Typography>
    </Box>
  );
}
