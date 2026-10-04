import { Box, Chip, Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CallIcon from "@mui/icons-material/Call";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { Worker } from "../../entities/Worker";
import { formatCurrency } from "../../shared/utils/format";
import { WorkerAvatar } from "./WorkerAvatar";
import { WorkerAccountSection } from "../../pages/reports/WorkerAccountSection";

interface WorkerProfileDialogProps {
  open: boolean;
  worker: Worker | null;
  onClose: () => void;
}

/**
 * دیالوگ «پروفایل نیرو»: پروفایل و اطلاعات تماس/بانکی یک نیروی مشخص، به همراه
 * حساب طلب و بدهی همان نیرو، هر دو در یک‌جا.
 *
 * پیش‌تر «حساب تکی نیرو» یک تب مستقل در صفحهٔ «مدیریت» بود که کاربر باید
 * ابتدا نیرو را از یک فهرست کشویی جدا انتخاب می‌کرد. اکنون با زدن روی
 * نام/کارت هر نیرو در بخش «منابع کارگاه ← نیروها»، همین‌جا هم پروفایل و هم
 * حساب او با هم باز می‌شود — بدون نیاز به رفتن به یک صفحهٔ دیگر و انتخاب
 * دوبارهٔ همان نیرو از یک فهرست.
 */
export function WorkerProfileDialog({ open, worker, onClose }: WorkerProfileDialogProps) {
  if (!worker) return null;

  const fullName = `${worker.firstName} ${worker.lastName}`;
  const initials = `${worker.firstName.charAt(0)}${worker.lastName.charAt(0)}`;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          پروفایل نیرو
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="بستن">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        {/* --- کارت پروفایل --- */}
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <WorkerAvatar avatarPhotoId={worker.avatarPhotoId} initials={initials} size={64} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Typography variant="h6" fontWeight={700} noWrap>
                  {fullName}
                </Typography>
                <Chip
                  label={worker.isActive ? "فعال" : "غیرفعال"}
                  size="small"
                  color={worker.isActive ? "success" : "default"}
                  sx={{ height: 20 }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {worker.position}
              </Typography>
              <Typography variant="caption" color="primary.main" fontWeight={700}>
                {formatCurrency(worker.dailyBaseSalary)} / روز
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={0.75}>
            {worker.phoneNumber && (
              <Stack
                component="a"
                href={`tel:${worker.phoneNumber}`}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ width: "fit-content", textDecoration: "none", color: "inherit" }}
              >
                <CallIcon fontSize="small" color="primary" />
                <Typography variant="body2" color="primary.main" fontWeight={600}>
                  {worker.phoneNumber}
                </Typography>
              </Stack>
            )}
            {(worker.cardNumbers ?? []).map((num, idx) => (
              <Stack key={`card-${idx}`} direction="row" alignItems="center" spacing={1}>
                <CreditCardIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  شماره کارت{worker.cardNumbers.length > 1 ? ` ${idx + 1}` : ""}: {num}
                </Typography>
              </Stack>
            ))}
            {(worker.shebaNumbers ?? []).map((num, idx) => (
              <Stack key={`sheba-${idx}`} direction="row" alignItems="center" spacing={1}>
                <CreditCardIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  شبا{worker.shebaNumbers.length > 1 ? ` ${idx + 1}` : ""}: IR{num}
                </Typography>
              </Stack>
            ))}
          </Stack>

          {worker.description && (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
              {worker.description}
            </Typography>
          )}
        </Stack>

        <Divider />

        {/* --- حساب طلب و بدهی همین نیرو --- */}
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AccountBalanceWalletIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              حساب طلب و بدهی
            </Typography>
          </Stack>
          <WorkerAccountSection fixedWorkerId={worker.id} onFixedWorkerDeleted={onClose} />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
