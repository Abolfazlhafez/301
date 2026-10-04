import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { wageAssignmentApi } from "../../shared/api/wageAssignmentApi";
import { wageMethodApi } from "../../shared/api/wageMethodApi";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CallIcon from "@mui/icons-material/Call";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import CalculateIcon from "@mui/icons-material/Calculate";
import ShareIcon from "@mui/icons-material/Share";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import { Worker } from "../../entities/Worker";
import { formatCurrency } from "../../shared/utils/format";
import { WorkerAvatar } from "./WorkerAvatar";

interface WorkerCardProps {
  worker: Worker;
  onEdit: (worker: Worker) => void;
  onDelete: (worker: Worker) => void;
  onToggleActive: (worker: Worker) => void;
  onOpenGallery: (worker: Worker) => void;
  onOpenWageDialog: (worker: Worker) => void;
  onCopyValue: (value: string, label: string) => void;
  onShareInfo: (worker: Worker) => void;
  /** با زدن روی نام/آواتار این نیرو صدا زده می‌شود — پروفایل او را به همراه
   * حساب طلب و بدهی‌اش باز می‌کند. */
  onOpenProfile: (worker: Worker) => void;
  /**
   * حضور و غیاب دیگر تب مستقلی نیست — طبق ادغام، مستقیماً از همین‌جا (کارت
   * نیرو) با یک تپ باز می‌شود؛ آن تب داشت با انتخابگر نیرو + تاریخ کار
   * می‌کرد، ولی وقتی کاربر همین‌جا روی یک نیروی مشخص ایستاده، تکرار همان
   * انتخاب یک قدم اضافه بی‌فایده بود.
   */
  onOpenAttendance: (worker: Worker) => void;
}

export function WorkerCard({
  worker,
  onEdit,
  onDelete,
  onToggleActive,
  onOpenGallery,
  onOpenWageDialog,
  onCopyValue,
  onShareInfo,
  onOpenProfile,
  onOpenAttendance,
}: WorkerCardProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const { data: primaryAssignment } = useQuery({
    queryKey: ["wage-assignments", worker.id, "card-summary"],
    queryFn: async () => {
      const assignments = await wageAssignmentApi.listByWorker(worker.id);
      return assignments[0] ?? null;
    },
  });

  const { data: primaryMethod } = useQuery({
    queryKey: ["wage-method", primaryAssignment?.wageMethodId],
    queryFn: () => wageMethodApi.findByIdOrNull(primaryAssignment!.wageMethodId),
    enabled: !!primaryAssignment,
  });

  const fullName = `${worker.firstName} ${worker.lastName}`;
  const initials = `${worker.firstName.charAt(0)}${worker.lastName.charAt(0)}`;

  return (
    <Card variant="outlined" sx={{ opacity: worker.isActive ? 1 : 0.6 }}>
      <CardContent sx={{ py: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            onClick={() => onOpenProfile(worker)}
            sx={{ flex: 1, minWidth: 0, cursor: "pointer" }}
          >
          <WorkerAvatar avatarPhotoId={worker.avatarPhotoId} initials={initials} size={44} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {fullName}
              </Typography>
              {!worker.isActive && (
                <Chip label="غیرفعال" size="small" color="default" sx={{ height: 20 }} />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" noWrap>
              {worker.position}
            </Typography>
            {primaryMethod && (
              <Typography variant="caption" color="primary.main" noWrap sx={{ display: "block" }}>
                روش پرداخت: {primaryMethod.formula.name}
              </Typography>
            )}
            {worker.phoneNumber && (
              <Stack
                component="a"
                href={`tel:${worker.phoneNumber}`}
                onClick={(e) => e.stopPropagation()}
                direction="row"
                alignItems="center"
                spacing={0.5}
                mt={0.25}
                sx={{
                  width: "fit-content",
                  textDecoration: "none",
                  color: "inherit",
                  "&:active": { opacity: 0.6 },
                }}
              >
                <CallIcon sx={{ fontSize: 14 }} color="primary" />
                <Typography variant="caption" color="primary.main" fontWeight={600}>
                  {worker.phoneNumber}
                </Typography>
              </Stack>
            )}
            <Typography variant="caption" color="primary.main" fontWeight={700}>
              {formatCurrency(worker.dailyBaseSalary)} / روز
            </Typography>
          </Box>
          </Stack>

          <Stack alignItems="center" spacing={0}>
            <Switch
              checked={worker.isActive}
              onChange={() => onToggleActive(worker)}
              size="small"
              color="success"
            />
            <Stack direction="row" alignItems="center">
              <Tooltip title="حضور و غیاب">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAttendance(worker);
                  }}
                  aria-label={`حضور و غیاب ${fullName}`}
                >
                  <HowToRegIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>

      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onEdit(worker);
          }}
        >
          <EditIcon fontSize="small" sx={{ ml: 1 }} />
          ویرایش
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onOpenGallery(worker);
          }}
        >
          <PhotoLibraryIcon fontSize="small" sx={{ ml: 1 }} />
          گالری عکس
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onOpenWageDialog(worker);
          }}
        >
          <CalculateIcon fontSize="small" sx={{ ml: 1 }} />
          محاسبه دستمزد
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onShareInfo(worker);
          }}
        >
          <ShareIcon fontSize="small" sx={{ ml: 1 }} />
          اشتراک‌گذاری اطلاعات تماس/بانکی
        </MenuItem>
        {worker.phoneNumber && (
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              onCopyValue(worker.phoneNumber!, "شماره تلفن");
            }}
          >
            <CallIcon fontSize="small" sx={{ ml: 1 }} />
            کپی شماره تلفن
          </MenuItem>
        )}
        {worker.cardNumbers?.map((num, idx) => (
          <MenuItem
            key={`card-${idx}`}
            onClick={() => {
              setAnchorEl(null);
              onCopyValue(num, `شماره کارت ${idx + 1}`);
            }}
          >
            <CreditCardIcon fontSize="small" sx={{ ml: 1 }} />
            کپی شماره کارت {worker.cardNumbers.length > 1 ? idx + 1 : ""}
          </MenuItem>
        ))}
        {worker.shebaNumbers?.map((num, idx) => (
          <MenuItem
            key={`sheba-${idx}`}
            onClick={() => {
              setAnchorEl(null);
              onCopyValue(`IR${num}`, `شماره شبا ${idx + 1}`);
            }}
          >
            <CreditCardIcon fontSize="small" sx={{ ml: 1 }} />
            کپی شبا {worker.shebaNumbers.length > 1 ? idx + 1 : ""}
          </MenuItem>
        ))}
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onDelete(worker);
          }}
          sx={{ color: "error.main" }}
        >
          <DeleteIcon fontSize="small" sx={{ ml: 1 }} />
          حذف
        </MenuItem>
      </Menu>
    </Card>
  );
}
