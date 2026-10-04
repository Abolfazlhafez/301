import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { cashboxFundApi } from "../../shared/api/cashboxFundApi";
import { extractErrorMessage } from "../../shared/api/client";
import { useToast } from "../../shared/components/ToastProvider";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { CashboxFund } from "../../entities/CashboxFund";

interface CashboxFundManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * مدیریت صندوق‌ها: افزودن صندوق جدید، تغییر صندوق پیش‌فرض، و حذف. صندوق
 * پیش‌فرض قابل حذف نیست (باید اول یک صندوق دیگر را پیش‌فرض کرد)، و صندوقی
 * که تراکنش دارد هم قابل حذف نیست — این محدودیت‌ها را خودِ cashboxFundService
 * اعمال می‌کند، این‌جا فقط پیام خطا نمایش داده می‌شود.
 */
export function CashboxFundManagerDialog({ open, onClose }: CashboxFundManagerDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [newFundName, setNewFundName] = useState("");
  const [deletingFund, setDeletingFund] = useState<CashboxFund | null>(null);

  const { data: funds } = useQuery({
    queryKey: ["cashbox-funds"],
    queryFn: () => cashboxFundApi.list(),
    enabled: open,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["cashbox-funds"] });
    queryClient.invalidateQueries({ queryKey: ["cashbook"] });
    queryClient.invalidateQueries({ queryKey: ["cashbook-summary"] });
  }

  const createMutation = useMutation({
    mutationFn: () => cashboxFundApi.create({ name: newFundName }),
    onSuccess: () => {
      invalidate();
      setNewFundName("");
      showToast(t("cashboxFund.toastCreated") as string, "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => cashboxFundApi.setDefault(id),
    onSuccess: () => {
      invalidate();
      showToast(t("cashboxFund.toastDefaultChanged") as string, "success");
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cashboxFundApi.remove(id),
    onSuccess: () => {
      invalidate();
      showToast(t("cashboxFund.toastDeleted") as string, "success");
      setDeletingFund(null);
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {t("cashboxFund.dialogTitle")}
          <IconButton onClick={onClose} size="small" aria-label={t("common.close") as string}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
            {t("cashboxFund.description")}
          </Typography>

          <List disablePadding>
            {(funds ?? []).map((fund, index) => (
              <Box key={fund.id}>
                {index > 0 && <Divider component="li" />}
                <ListItem
                  disableGutters
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => setDefaultMutation.mutate(fund.id)}
                        disabled={fund.isDefault || setDefaultMutation.isPending}
                        title={fund.isDefault ? t("cashboxFund.isDefaultTitle") as string : t("cashboxFund.setDefaultTitle") as string}
                      >
                        {fund.isDefault ? (
                          <StarIcon fontSize="small" color="warning" />
                        ) : (
                          <StarBorderIcon fontSize="small" />
                        )}
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeletingFund(fund)}
                        disabled={fund.isDefault}
                        title={fund.isDefault ? t("cashboxFund.cannotDeleteDefault") as string : t("cashboxFund.deleteTitle") as string}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Typography variant="body2" fontWeight={600}>
                          {fund.name}
                        </Typography>
                        {fund.isDefault && (
                          <Chip label={t("cashboxFund.defaultChip") as string} size="small" color="primary" variant="outlined" />
                        )}
                      </Stack>
                    }
                  />
                </ListItem>
              </Box>
            ))}
          </List>

          <Stack direction="row" spacing={1} mt={2}>
            <TextField
              size="small"
              fullWidth
              placeholder={t("cashboxFund.newFundPlaceholder") as string}
              value={newFundName}
              onChange={(e) => setNewFundName(e.target.value)}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={!newFundName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {t("cashboxFund.add")}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} color="inherit">
            {t("cashboxFund.close")}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deletingFund}
        title={t("cashboxFund.deleteConfirmTitle") as string}
        description={t("cashboxFund.deleteConfirmDescription", { name: deletingFund?.name }) as string}
        confirmLabel={t("cashboxFund.deleteTitle") as string}
        loading={deleteMutation.isPending}
        onConfirm={() => deletingFund && deleteMutation.mutate(deletingFund.id)}
        onCancel={() => setDeletingFund(null)}
      />
    </>
  );
}
