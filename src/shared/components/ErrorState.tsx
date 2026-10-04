import { Alert, AlertTitle, Box, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import RefreshIcon from "@mui/icons-material/Refresh";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <Box py={3}>
      <Alert
        severity="error"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry} startIcon={<RefreshIcon />}>
              {t("common.retry")}
            </Button>
          ) : undefined
        }
      >
        <AlertTitle>{t("common.error")}</AlertTitle>
        {message}
      </Alert>
    </Box>
  );
}
