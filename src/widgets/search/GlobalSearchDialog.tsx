import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AppBar,
  Chip,
  Box,
  Dialog,
  IconButton,
  InputAdornment,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import HistoryIcon from "@mui/icons-material/History";
import ClearIcon from "@mui/icons-material/Clear";
import PersonIcon from "@mui/icons-material/Person";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import EventNoteIcon from "@mui/icons-material/EventNote";
import ConstructionIcon from "@mui/icons-material/Construction";
import GroupsIcon from "@mui/icons-material/Groups";
import LayersIcon from "@mui/icons-material/Layers";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import DescriptionIcon from "@mui/icons-material/Description";
import ArticleIcon from "@mui/icons-material/Article";
import { workersApi } from "../../shared/api/workersApi";
import { cashbookApi } from "../../shared/api/cashbookApi";
import { futureActivitiesApi } from "../../shared/api/futureActivitiesApi";
import { equipmentApi } from "../../shared/api/equipmentApi";
import { floorsApi } from "../../shared/api/floorsApi";
import { floorTasksApi } from "../../shared/api/floorTasksApi";
import { floorIssuesApi } from "../../shared/api/floorIssuesApi";
import { floorPlansApi } from "../../shared/api/floorPlansApi";
import { workLogNoteApi } from "../../shared/api/workLogNoteApi";
import { EmptyState } from "../../shared/components/EmptyState";
import { AnimatedList } from "../../shared/components/AnimatedList";
import { getTodayIso } from "../../shared/utils/jalaliDate";
import { addRecentSearch, clearRecentSearches, loadRecentSearches } from "../../shared/hooks/recentSearches";
import {
  filterGlobalSearchResults,
  getGlobalSearchResultPath,
  GLOBAL_SEARCH_MIN_QUERY_LENGTH,
  type GlobalSearchResult,
} from "./globalSearchFilter";

interface GlobalSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * جستجوی سراسری روی چهار دستهٔ اصلی اطلاعات اپ: نیروها، تراکنش‌های دفتر
 * حساب، فعالیت‌های آینده/تاریخچه، و تجهیزات. چون این اپ کاملاً آفلاین است و حجم
 * داده‌ها برای یک کارگاه معمولاً کوچک است (چند ده نیرو، چند صد تراکنش)،
 * فیلتر کاملاً سمت کلاینت و روی داده‌ای که React Query خودش کش می‌کند انجام
 * می‌شود — نیازی به جستجوی سرور یا ایندکس جداگانه نیست.
 *
 * چون این اپ برای هیچ رکوردی صفحهٔ جزئیات مستقل ندارد (نه نیرو، نه تراکنش،
 * نه فعالیت — همه‌شان داخل دیالوگ‌های ویرایش در همان صفحهٔ فهرست باز
 * می‌شوند)، لمس یک نتیجه فقط به زیرتب مربوطه هدایت می‌کند، نه به یک صفحهٔ
 * اختصاصی آن رکورد؛ چون چنین صفحه‌ای اصلاً در معماری اپ وجود ندارد.
 *
 * منطق واقعی فیلتر کردن (که مستعد باگ است) در globalSearchFilter.ts
 * جداگانه و مستقل از React نگه داشته شده تا مستقیماً قابل تست باشد.
 */
export function GlobalSearchDialog({ open, onClose }: GlobalSearchDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  // فیلتر روی نسخهٔ deferred اجرا می‌شود تا تایپ سریع، روی هر کلید فیلتر سنگین را بلاک نکند.
  const deferredQuery = useDeferredValue(query);
  const today = getTodayIso();

  // تاریخچهٔ جستجوهای اخیر — هر بار دیالوگ باز می‌شود دوباره خوانده
  // می‌شود (نه فقط یک‌بار در mount اول کامپوننت)، چون همین دیالوگ در
  // AppLayout همیشه mount شده و فقط open/close می‌شود.
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  useEffect(() => {
    if (open) loadRecentSearches().then(setRecentSearches);
  }, [open]);

  // میان‌برهای سریع به چهار مقصد اصلی — فقط وقتی جعبهٔ جستجو هنوز خالی است
  // نمایش داده می‌شوند. برخی کاربران این دیالوگ را بیشتر به‌عنوان یک راه
  // سریع برای «رفتن به یک بخش» باز می‌کنند تا واقعاً جستجوی متنی، پس به‌جای
  // صفحهٔ کاملاً خالی، این چهار میان‌بر مستقیماً همان مقصد را پیشنهاد می‌دهند.
  const quickShortcuts: { label: string; to: string; icon: JSX.Element }[] = [
    { label: t("globalSearch.shortcutWorkers"), to: "/resources?tab=workers", icon: <GroupsIcon color="primary" /> },
    {
      label: t("globalSearch.shortcutCashbook"),
      to: "/reports?tab=cashbook",
      icon: <AccountBalanceWalletIcon color="primary" />,
    },
    {
      label: t("globalSearch.shortcutActivities"),
      to: "/activities?tab=upcoming",
      icon: <EventNoteIcon color="primary" />,
    },
    {
      label: t("globalSearch.shortcutEquipment"),
      to: "/resources?tab=equipment",
      icon: <ConstructionIcon color="primary" />,
    },
  ];

  const { data: workers = [] } = useQuery({
    queryKey: ["workers", "search-all"],
    queryFn: () => workersApi.list(),
    enabled: open,
  });

  const { data: cashbookEntries = [] } = useQuery({
    queryKey: ["cashbook", "search-all"],
    queryFn: () => cashbookApi.list(),
    enabled: open,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["future-activities", "search-all"],
    queryFn: () => futureActivitiesApi.listAll({ scope: "all", includeCompleted: true }),
    enabled: open,
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment", "search-all"],
    queryFn: () => equipmentApi.list(),
    enabled: open,
  });

  const { data: floors = [] } = useQuery({
    queryKey: ["floors", "search-all"],
    queryFn: () => floorsApi.list(),
    enabled: open,
  });

  const { data: floorTasks = [] } = useQuery({
    queryKey: ["floorTasks", "search-all"],
    queryFn: () => floorTasksApi.listAll(),
    enabled: open,
  });

  const { data: floorIssues = [] } = useQuery({
    queryKey: ["floorIssues", "search-all"],
    queryFn: () => floorIssuesApi.listAll(),
    enabled: open,
  });

  const { data: floorPlans = [] } = useQuery({
    queryKey: ["floorPlans", "search-all"],
    queryFn: () => floorPlansApi.listAll(),
    enabled: open,
  });

  const { data: floorReports = [] } = useQuery({
    queryKey: ["work-log-notes", "floor-search-all"],
    queryFn: async () => {
      const notes = await workLogNoteApi.listAll();
      return notes.filter((note) => !!note.floorId);
    },
    enabled: open,
  });

  const results = useMemo<GlobalSearchResult[]>(
    () =>
      filterGlobalSearchResults(
        deferredQuery,
        { workers, cashbookEntries, activities, equipment, floors, floorTasks, floorIssues, floorPlans, floorReports },
        today,
        {
          cashbookEntryTypes: {
            expense: t("cashbook.entryType.expense"),
            salary: t("cashbook.entryType.salary"),
            deposit: t("cashbook.entryType.deposit"),
          },
          activityCompletedSuffix: t("globalSearch.activityCompletedSuffix"),
          openTasksSuffix: t("globalSearch.openTasksSuffix"),
        }
      ),
    [deferredQuery, workers, cashbookEntries, activities, equipment, floors, floorTasks, floorIssues, floorPlans, floorReports, today, t]
  );

  function handleSelect(result: GlobalSearchResult) {
    // ثبت در تاریخچه فقط وقتی معنادار است که کاربر واقعاً یک نتیجه را از
    // میان جستجوی متنی خودش انتخاب کرده باشد (نه وقتی از میان‌برهای
    // دسترسی سریع رفته)، چون آن حالت اصلاً query ای ندارد.
    if (query.trim()) addRecentSearch(query).then(setRecentSearches);
    onClose();
    setQuery("");
    navigate(getGlobalSearchResultPath(result));
  }

  function handleClose() {
    setQuery("");
    onClose();
  }

  function handleShortcutClick(to: string) {
    onClose();
    setQuery("");
    navigate(to);
  }

  function handleRecentSearchClick(recentQuery: string) {
    setQuery(recentQuery);
  }

  function handleClearRecentSearches() {
    clearRecentSearches().then(() => setRecentSearches([]));
  }

  const showEmptyState = deferredQuery.trim().length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH && results.length === 0;
  const showHint = query.trim().length > 0 && query.trim().length < GLOBAL_SEARCH_MIN_QUERY_LENGTH;
  const showShortcuts = query.trim().length === 0;

  return (
    <Dialog fullScreen open={open} onClose={handleClose}>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={handleClose} aria-label={t("globalSearch.closeAriaLabel") as string}>
            <CloseIcon />
          </IconButton>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={t("globalSearch.placeholder") as string}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Toolbar>
      </AppBar>

      <Box sx={{ overflowY: "auto", flex: 1 }}>
        {showShortcuts && (
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: "block", mb: 0.5 }}>
              {t("globalSearch.quickAccess")}
            </Typography>
            {quickShortcuts.map((shortcut) => (
              <ListItemButton
                key={shortcut.to}
                onClick={() => handleShortcutClick(shortcut.to)}
                sx={{ borderRadius: 1.5, transition: "background-color 120ms ease-out" }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{shortcut.icon}</ListItemIcon>
                <ListItemText primary={shortcut.label} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            ))}

            {/* جستجوهای اخیر — فقط وقتی حداقل یک مورد در تاریخچه باشد نمایش
                داده می‌شود (نه یک بخش خالی گیج‌کننده برای کاربر تازه/حالت
                incognito). زدن هر چیپ فقط متن جستجو را پر می‌کند، نه این‌که
                مستقیم به نتیجه برود — چون ممکن است همان عبارت الان چند
                نتیجهٔ متفاوت داشته باشد. */}
            {recentSearches.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t("globalSearch.recentSearches")}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={handleClearRecentSearches}
                    aria-label={t("globalSearch.clearRecentSearches") as string}
                  >
                    <ClearIcon fontSize="inherit" />
                  </IconButton>
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    px: 1,
                    overflowX: "auto",
                    overflowY: "hidden",
                    pb: 0.5,
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": { display: "none" },
                  }}
                >
                  {recentSearches.map((recentQuery) => (
                    <Chip
                      key={recentQuery}
                      size="small"
                      variant="outlined"
                      icon={<HistoryIcon fontSize="small" />}
                      label={recentQuery}
                      onClick={() => handleRecentSearchClick(recentQuery)}
                      sx={{ flexShrink: 0 }}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        )}

        {showHint && (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {t("globalSearch.minCharsHint")}
            </Typography>
          </Box>
        )}

        {showEmptyState && (
          <EmptyState
            icon={<SearchIcon fontSize="inherit" />}
            title={t("globalSearch.emptyTitle") as string}
            description={t("globalSearch.emptyDescription") as string}
          />
        )}

        {results.length > 0 && (
          <AnimatedList spacing={0}>
            {results.map((result) => (
              <ListItemButton
                key={`${result.kind}-${result.id}`}
                onClick={() => handleSelect(result)}
                sx={{
                  transition: "background-color 120ms ease-out",
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {result.kind === "worker" && <PersonIcon color="primary" />}
                  {result.kind === "cashbook" && <AccountBalanceWalletIcon color="primary" />}
                  {result.kind === "activity" && <EventNoteIcon color="primary" />}
                  {result.kind === "equipment" && <ConstructionIcon color="primary" />}
                  {result.kind === "floor" && <LayersIcon color="primary" />}
                  {result.kind === "floorTask" && <AssignmentIcon color="primary" />}
                  {result.kind === "floorIssue" && <ReportProblemIcon color="primary" />}
                  {result.kind === "floorPlan" && <DescriptionIcon color="primary" />}
                  {result.kind === "floorReport" && <ArticleIcon color="primary" />}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                      <Typography component="span" variant="body2" fontWeight={600} noWrap sx={{ minWidth: 0, flex: 1 }}>
                        {result.title}
                      </Typography>
                      {result.kind.startsWith("floor") && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t(`floor.search.${result.kind}`)}
                          sx={{ height: 20, flexShrink: 0, fontSize: 10 }}
                        />
                      )}
                    </Box>
                  }
                  secondary={result.subtitle}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            ))}
          </AnimatedList>
        )}
      </Box>
    </Dialog>
  );
}
