import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import PaidIcon from "@mui/icons-material/Paid";
import { workerGroupApi } from "../../shared/api/workerGroupApi";
import { workersApi } from "../../shared/api/workersApi";
import { attendanceApi } from "../../shared/api/attendanceApi";
import { extractErrorMessage } from "../../shared/api/client";
import { useToast } from "../../shared/components/ToastProvider";
import { EmptyState } from "../../shared/components/EmptyState";
import { AnimatedList } from "../../shared/components/AnimatedList";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { HasDependenciesError } from "../../core/errors";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import { WorkerGroupFormDialog } from "./WorkerGroupFormDialog";
import { GroupPaymentsDialog } from "./GroupPaymentsDialog";
import type { WorkerGroup } from "../../entities/WorkerGroup";

interface WorkerGroupsDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * مدیریت «اکیپ‌ها» — گروه‌هایی از نیروها که با هم روی یک کار قرار می‌گیرند
 * و دستمزدشان به‌جای محاسبهٔ فردی، به‌صورت یک مبلغ کلی پرداخت می‌شود (رجوع
 * کن به توضیح WorkerGroup/GroupWagePayment برای منطق کامل). این دیالوگ از
 * نوار ابزار صفحهٔ «نیروها» باز می‌شود، چون مفهوماً همان‌جا تعلق دارد اما
 * از فهرست تک‌تک نیروها جداست.
 */
export function WorkerGroupsDialog({ open, onClose }: WorkerGroupsDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WorkerGroup | null>(null);
  const [paymentsGroup, setPaymentsGroup] = useState<WorkerGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<WorkerGroup | null>(null);
  const [blockedDeleteMessage, setBlockedDeleteMessage] = useState<string | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ["worker-groups"],
    queryFn: () => workerGroupApi.list(),
    enabled: open,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-for-groups"],
    queryFn: () => workersApi.list({ isActive: true }),
    enabled: open,
  });

  // برای نمایش «امروز چند نفر از اکیپ حاضرند» روی کارت هر اکیپ — یک بار همهٔ
  // حضورهای امروز را می‌گیریم و بعد برای هر اکیپ فقط تقاطع با اعضایش را
  // می‌شماریم؛ به این ترتیب نیازی به یک کوئری جدا برای هر اکیپ نیست.
  const { data: todayAttendances = [] } = useQuery({
    queryKey: ["attendances", "by-date", getTodayIso()],
    queryFn: () => attendanceApi.list({ date: getTodayIso() }),
    enabled: open,
  });
  const presentWorkerIdsToday = new Set(todayAttendances.map((a) => a.workerId));

  const workersById = new Map(workers.map((w) => [w.id, w]));

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => workerGroupApi.toggleActive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worker-groups"] }),
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workerGroupApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-groups"] });
      showToast("اکیپ حذف شد.", "success");
      setDeletingGroup(null);
    },
    onError: (err) => {
      if (err instanceof HasDependenciesError) {
        setBlockedDeleteMessage(err.message);
        return;
      }
      showToast(extractErrorMessage(err), "error");
    },
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              اکیپ‌ها (پرداخت جمعی)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              برای نیروهایی که گروهی کار می‌کنند و دستمزدشان یک‌جا و کلی پرداخت می‌شود
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="بستن">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingGroup(null);
                setFormOpen(true);
              }}
              sx={{ alignSelf: "flex-start" }}
            >
              افزودن اکیپ
            </Button>

            {groups.length === 0 ? (
              <EmptyState
                icon={<GroupWorkIcon fontSize="inherit" />}
                title="هنوز اکیپی ثبت نشده"
                description="اگر برخی نیروها به‌صورت گروهی (مثلاً اکیپ گچ‌کار) کار می‌کنند و دستمزدشان یک‌جا پرداخت می‌شود، اینجا یک اکیپ برایشان بسازید."
              />
            ) : (
              <AnimatedList spacing={1}>
                {groups.map((group) => {
                  const memberNames = group.memberWorkerIds
                    .map((id) => workersById.get(id))
                    .filter((w): w is NonNullable<typeof w> => !!w)
                    .map((w) => `${w.firstName} ${w.lastName}`);

                  return (
                    <Box
                      key={group.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        opacity: group.isActive ? 1 : 0.55,
                      }}
                    >
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {group.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {group.memberWorkerIds.length} عضو
                            {memberNames.length > 0 ? `: ${memberNames.join("، ")}` : ""}
                          </Typography>
                          {!group.isActive && <Chip label="غیرفعال" size="small" sx={{ height: 18, mt: 0.5 }} />}
                        </Box>
                        {group.isActive && group.memberWorkerIds.length > 0 && (
                          <Chip
                            label={`امروز ${
                              group.memberWorkerIds.filter((id) => presentWorkerIdsToday.has(id)).length
                            } از ${group.memberWorkerIds.length} حاضر`}
                            size="small"
                            color={
                              group.memberWorkerIds.every((id) => presentWorkerIdsToday.has(id))
                                ? "success"
                                : group.memberWorkerIds.some((id) => presentWorkerIdsToday.has(id))
                                  ? "warning"
                                  : "default"
                            }
                            sx={{ flexShrink: 0 }}
                          />
                        )}
                      </Stack>
                      <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          startIcon={<PaidIcon fontSize="small" />}
                          onClick={() => setPaymentsGroup(group)}
                        >
                          پرداخت‌های جمعی
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setEditingGroup(group);
                            setFormOpen(true);
                          }}
                        >
                          ویرایش
                        </Button>
                        <Button size="small" onClick={() => toggleActiveMutation.mutate(group.id)}>
                          {group.isActive ? "غیرفعال کردن" : "فعال کردن"}
                        </Button>
                        <Button size="small" color="error" onClick={() => setDeletingGroup(group)}>
                          حذف
                        </Button>
                      </Stack>
                    </Box>
                  );
                })}
              </AnimatedList>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      <WorkerGroupFormDialog open={formOpen} existing={editingGroup} workers={workers} onClose={() => setFormOpen(false)} />

      <GroupPaymentsDialog open={!!paymentsGroup} group={paymentsGroup} onClose={() => setPaymentsGroup(null)} />

      <ConfirmDialog
        open={!!deletingGroup}
        title="حذف اکیپ"
        description={deletingGroup ? `آیا از حذف اکیپ «${deletingGroup.name}» مطمئن هستید؟` : ""}
        confirmLabel="حذف"
        loading={deleteMutation.isPending}
        onCancel={() => setDeletingGroup(null)}
        onConfirm={() => deletingGroup && deleteMutation.mutate(deletingGroup.id)}
      />

      <ConfirmDialog
        open={!!blockedDeleteMessage}
        title="حذف ممکن نیست"
        description={blockedDeleteMessage ?? ""}
        confirmLabel={deletingGroup?.isActive ? "غیرفعال کردن اکیپ" : "متوجه شدم"}
        confirmColor="warning"
        onCancel={() => setBlockedDeleteMessage(null)}
        onConfirm={() => {
          if (deletingGroup?.isActive) {
            toggleActiveMutation.mutate(deletingGroup.id);
          }
          setBlockedDeleteMessage(null);
          setDeletingGroup(null);
        }}
      />
    </>
  );
}
