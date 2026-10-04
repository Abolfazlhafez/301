import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { alpha } from "@mui/material/styles";
import { AppBar, Badge, Box, IconButton, Paper, Toolbar, Tooltip, Typography } from "@mui/material";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import DashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";
import EngineeringIcon from "@mui/icons-material/Engineering";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { futureActivitiesApi } from "../../shared/api/futureActivitiesApi";
import { GlobalSearchDialog } from "../search/GlobalSearchDialog";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { SwipeableTabPanel } from "../../shared/components/SwipeableTabPanel";

interface AppLayoutProps {
  children: ReactNode;
}

// شناسهٔ ویژه برای دکمهٔ جستجو — برخلاف بقیه، این یک مسیر نیست (نه یک
// value مسیریابی)، بلکه فقط دیالوگ جستجوی سراسری را باز می‌کند. طبق روند
// ۲۰۲۶-۲۰۲۷ ناوبری موبایل («ادغام کنش‌های اصلی داخل خودِ نوار ناوبری به‌جای
// شناور کردنشان بالای محتوا» + «دسترسی‌پذیری رادیکال»: مهم‌ترین کنش‌ها باید
// در «منطقهٔ امن» انگشت شست باشند، نه در گوشهٔ بالای صفحه)، آیکون جستجو از
// نوار بالا (که خارج از دسترس راحتِ شست است) به داخل نوار پایین منتقل شده و
// به‌عنوان یک دکمهٔ لهجه‌دار (accent) در وسط نوار جای گرفته است — دقیقاً جایی
// که شست به‌طور طبیعی می‌نشیند.
const SEARCH_NAV_VALUE = "__search__";

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const [searchOpen, setSearchOpen] = useState(false);

  // هر آیتم هم نسخهٔ خطی (حالت غیرفعال — سبک و کم‌حجم) و هم نسخهٔ توپر
  // (حالت فعال — برای تشخیص فوری در نگاه اول) آیکون خودش را دارد؛ این
  // «مورف» شکل آیکون هنگام فعال‌شدن، به‌جای رنگ‌شدنِ صرف، یکی از دو سیگنال
  // اصلی طراحی تازهٔ ناوبری است.
  const NAV_ITEMS = useMemo(
    () => [
      { label: t("nav.dashboard"), value: "/", icon: <DashboardOutlinedIcon />, activeIcon: <DashboardIcon /> },
      { label: t("nav.resources"), value: "/resources", icon: <Inventory2OutlinedIcon />, activeIcon: <Inventory2Icon /> },
      // دکمهٔ لهجه‌دار جستجو — همیشه در وسط نوار، بدون حالت «فعال»، هیچ‌وقت
      // pill لغزنده روی آن نمی‌نشیند (چون به هیچ مسیری تعلق ندارد).
      { label: t("topbar.search"), value: SEARCH_NAV_VALUE, icon: <SearchIcon />, activeIcon: <SearchIcon />, isAction: true },
      { label: t("nav.activities"), value: "/activities", icon: <AssignmentOutlinedIcon />, activeIcon: <AssignmentIcon /> },
      { label: t("nav.reports"), value: "/reports", icon: <AssessmentOutlinedIcon />, activeIcon: <AssessmentIcon /> },
    ],
    [t]
  );

  const activeNavValue =
    NAV_ITEMS.find((item) => item.value === location.pathname)?.value || "/";
  const activeNavIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.value === activeNavValue)
  );

  // مسیرهای واقعاً قابل ناوبری با سوایپ — همان چهار مقصد نوار پایین، بدون
  // دکمهٔ لهجه‌دار جستجو (که اصلاً مسیر نیست). این لیست ترتیب فیزیکی/منطقی
  // تب‌ها را هم مشخص می‌کند: سوایپ به چپ یک خانه جلو می‌رود، سوایپ به راست
  // یک خانه عقب (دقیقاً مطابق قرارداد SwipeableTabPanel که برای سوایپ بین
  // زیرتب‌ها هم استفاده شده — تجربه‌ای هم‌خانواده با سوایپ تب‌های Telegram).
  const swipeRoutes = useMemo(
    () => NAV_ITEMS.filter((item) => !item.isAction).map((item) => item.value),
    [NAV_ITEMS]
  );
  const swipeIndex = swipeRoutes.indexOf(location.pathname);

  // مختصات pill لغزندهٔ زیر آیتم فعال — به‌جای درصد ثابت بر اساس ایندکس
  // (که در چیدمان RTL نیازمند محاسبهٔ جهت‌دار جداگانه‌ای می‌بود)، مستقیماً
  // از offsetLeft/offsetWidth خودِ دکمهٔ فعال نسبت به کانتینرش خوانده
  // می‌شود؛ این مقدار در RTL هم به‌درستی موقعیت واقعی روی صفحه را می‌دهد،
  // پس نیازی به منطق جدا برای جهت متن نیست.
  const navItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const activeEl = navItemRefs.current[activeNavIndex];
      if (activeEl) {
        setPillStyle({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });
      }
    };
    measure();
    // چرخش صفحه یا تغییر اندازهٔ پنجره (حالت split-screen اندروید) می‌تواند
    // عرض دکمه‌ها را عوض کند؛ بدون این listener، pill تا سوییچ بعدی تب در
    // موقعیت/عرض قدیمی می‌ماند.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeNavIndex]);

  // تعداد فعالیت‌های امروز/سررسیدگذشته — روی بج آیکون «فعالیت‌ها» در ناوبری
  // پایین نمایش داده می‌شود تا کاربر بدون باز کردن آن صفحه بداند کاری
  // منتظرش هست یا نه. کلید کوئری عمداً با پیشوند «future-activities» یکی
  // است تا invalidateQueries(["future-activities"]) در خودِ آن صفحه (بعد از
  // هر تغییر/تکمیل/حذف فعالیت) این بج را هم به‌روز نگه دارد، بدون این‌که
  // لازم باشد آن صفحه مستقیماً از وجود این بج خبر داشته باشد.
  const { data: dueActivityCount } = useQuery({
    queryKey: ["future-activities", "due-count"],
    queryFn: () => futureActivitiesApi.countDueOrOverdue(),
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      {/* نوار بالا — طبق روند «رابط نامرئی» ۲۰۲۶: هرچه کنش پرتکرارتر است باید
          از این نوار (منطقهٔ کم‌دسترسِ شست) دورتر و به نوار پایین نزدیک‌تر
          شود؛ به همین دلیل جستجو از اینجا حذف و به داخل نوار پایین منتقل شده.
          آنچه اینجا می‌ماند (سوییچر پروژه، وضعیت آفلاین، تنظیمات) کنش‌هایی‌اند
          که یا همیشه در معرض دیدند و نه لمس، یا کم‌تکرارند — پس ماندنشان در
          «منطقهٔ خطر» بالای صفحه هزینهٔ کاربردی چندانی ندارد. شیشهٔ مات هم
          یک پله شفاف‌تر شده (blur بیشتر، پس‌زمینهٔ کم‌رنگ‌تر) تا حس «لایهٔ
          شناور روی محتوا» به‌جای یک نوار توپر و سنگین بدهد. */}
      <AppBar
        position="static"
        color="default"
        elevation={0}
        sx={{
          flexShrink: 0,
          backgroundColor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.55 : 0.7),
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: "50%",
              bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.12),
            }}
          >
            <EngineeringIcon color="primary" sx={{ fontSize: 19 }} />
          </Box>
          <ProjectSwitcher />
          {/* اسپیسر — قبلاً همین انبساط روی خودِ دکمهٔ سوییچر پروژه بود (flexGrow: 1)،
              که یعنی پس‌زمینهٔ pill آن هم به‌اندازهٔ کل فضای باقی‌مانده کش می‌آمد.
              با انتقال flexGrow به یک جعبهٔ خنثی، سوییچر پروژه یک چیپ کوتاه و
              هم‌اندازهٔ متنش می‌ماند (هم‌خانواده با شکل زبانه‌ها/ناوبری پایین)،
              و آیکون‌های آفلاین/تنظیمات همچنان به لبهٔ دیگر هدر رانده می‌شوند. */}
          <Box sx={{ flexGrow: 1 }} />
          {!isOnline && (
            <Tooltip title={t("topbar.offlineTooltip") as string}>
              <WifiOffIcon sx={{ fontSize: 20, color: "text.disabled" }} aria-label={t("topbar.offlineAria") as string} />
            </Tooltip>
          )}
          <IconButton
            onClick={() => navigate("/settings")}
            color="inherit"
            aria-label={t("topbar.settings") as string}
            sx={{
              width: 44,
              height: 44,
              bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.06 : 0.045),
            }}
          >
            <SettingsIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          width: "100%",
          // با overscroll-behavior روی خودِ html/body کافی نبود چون این Box
          // (نه body) در واقع ناحیه‌ای‌ست که واقعاً اسکرول می‌شود؛ بدون این
          // خط، کشیدنِ بیش‌ازحد لیست (یا ژست Pull-to-refresh) می‌توانست
          // باعث overscroll بومی WebView شود و برای یک لحظه پس‌زمینهٔ پنجرهٔ
          // اکتیویتی (که قبلاً تصویر اسپلش/لوگو بود) از پشت آن دیده شود.
          overscrollBehaviorY: "contain",
        }}
      >
        {/* روی چهار مقصد اصلی نوار پایین (داشبورد/منابع/فعالیت‌ها/گزارش‌ها)،
            کشیدن انگشت روی محتوا هم دقیقاً مثل زدن روی خودِ آیتم نوار پایین
            عمل می‌کند — تجربه‌ای که در ویدئوی مرجع (سوایپ بین تب‌های پایین
            تلگرام) دیده می‌شود. صفحات دیگر (تنظیمات، پروژه، دفترچهٔ طبقه،
            تنظیمات دستمزد) که مقصد نوار پایین نیستند، از این سوایپ مستثنا
            می‌مانند تا کاربر با یک کشیدن انگشت ساده به‌طور ناخواسته از
            آن‌ها بیرون پرتاب نشود — و همان انیمیشن سادهٔ محو/لغزش قبلی را
            برای این‌ها نگه می‌داریم. */}
        {swipeIndex !== -1 ? (
          <SwipeableTabPanel
            activeIndex={swipeIndex}
            count={swipeRoutes.length}
            onChangeIndex={(index) => navigate(swipeRoutes[index])}
          >
            <Box
              sx={{
                width: "100%",
                maxWidth: 720,
                mx: "auto",
                px: 2,
                pt: 2,
                pb: 3,
              }}
            >
              {children}
            </Box>
          </SwipeableTabPanel>
        ) : (
          <Box
            key={location.pathname}
            sx={{
              width: "100%",
              maxWidth: 720,
              mx: "auto",
              px: 2,
              pt: 2,
              pb: 3,
              animation: "karegahyar-page-in 200ms ease-out",
              "@keyframes karegahyar-page-in": {
                from: { opacity: 0, transform: "translateY(8px)" },
                to: { opacity: 1, transform: "translateY(0)" },
              },
            }}
          >
            {children}
          </Box>
        )}
      </Box>

      {/* نوار ناوبری پایین — سبک شناور و مینیمال؛ آیتم فعال با یک pill نرم
          رنگی مشخص می‌شود (بدون خط جداکننده و بدون سایه‌ی سنگین)، آیکونش از
          حالت خطی به حالت توپر «مورف» می‌شود، و تنها همان یک آیتم برچسب متنی
          نشان می‌دهد؛ بقیهٔ آیتم‌ها فقط آیکون‌اند تا نوار در نگاه اول ساکت‌تر
          و کم‌ازدحام‌تر به نظر برسد. */}
      <Box
        sx={{
          flexShrink: 0,
          px: 1.5,
          pb: "max(10px, env(safe-area-inset-bottom))",
          pt: 1,
        }}
      >
        {/* «شیشهٔ مایع» ۲۰۲۶-۲۰۲۷: به‌جای یک نوار توپر تخت، این ظرف اکنون
            نیمه‌شفاف با بلور پس‌زمینه و یک حاشیهٔ ظریف نوردار است — طوری که
            انگار روی محتوای زیرش شناور است، نه بخشی چسبیده به کف صفحه. سایهٔ
            نرم و پخش‌شده هم همین حس بلندشدگی از سطح را تقویت می‌کند. */}
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 999,
            p: 0.5,
            maxWidth: 480,
            mx: "auto",
            // طبق درخواست: نوار پایین بدون پس‌زمینه (نه شیشه‌ای، نه توپر) —
            // فقط آیکون‌ها و pill لغزندهٔ رنگی زیر آیتم فعال روی محتوای پشت
            // آن شناورند، بدون هیچ کادر/بلور/سایه‌ای دور کل نوار.
            backgroundColor: "transparent",
            boxShadow: "none",
            border: "none",
          }}
        >
          {/* pill نارنجی زیر آیتم فعال — به‌جای تعویض آنی رنگ پس‌زمینهٔ هر
              دکمه، این یک عنصر واحد است که با تغییر مسیر از موقعیت آیتم
              قبلی به موقعیت آیتم جدید می‌لغزد. پیش از اولین اندازه‌گیری
              (pillStyle === null، یعنی همان چند میلی‌ثانیهٔ اول رندر) چیزی
              نمایش داده نمی‌شود تا پرشی از گوشهٔ ۰,۰ دیده نشود. */}
          {pillStyle && (
            // نکته مهم دربارهٔ باگ RTL: قبلاً left/width/transition همگی داخل sx
            // بودند. sx از طریق Emotion + stylis-plugin-rtl رندر می‌شود، و آن
            // پلاگین برای زبان‌های راست‌چین به‌صورت خودکار «left» را به «right»
            // تبدیل می‌کند (فرض بر این‌که مقدار left یک مقدار «منطقی/نویسندگی»
            // است که باید در RTL آینه شود). اما اینجا pillStyle.left از
            // offsetLeft خودِ دکمه خوانده شده — یعنی از قبل یک مقدار «فیزیکی
            // واقعی روی صفحه» است (چه در LTR چه در RTL درست است، چون
            // offsetLeft همیشه موقعیت واقعی پس از layout را می‌دهد، نه چیزی
            // که نیاز به آینه شدن داشته باشد). وقتی stylis دوباره آن را به
            // right تبدیل می‌کرد، pill در زبان‌های راست‌چین (فارسی/عربی/اردو)
            // در موقعیت اشتباه می‌نشست — مستقل از حالت روشن/تاریک، چون این
            // تبدیل در هر دو تم به یک شکل اتفاق می‌افتد. راه‌حل: left/width و
            // transition متناظرشان را از sx به style (اینلاین) منتقل کردیم؛
            // استایل اینلاین هیچ‌وقت از فیلتر stylis رد نمی‌شود، پس مقدار
            // فیزیکی محاسبه‌شده دقیقاً همان‌جایی می‌نشیند که باید.
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                top: 4,
                bottom: 4,
                borderRadius: 999,
                bgcolor: "primary.main",
                zIndex: 0,
              }}
              style={{
                left: pillStyle.left,
                width: pillStyle.width,
                transition: "left 280ms cubic-bezier(0.34, 1.2, 0.4, 1), width 280ms cubic-bezier(0.34, 1.2, 0.4, 1)",
              }}
            />
          )}
          {NAV_ITEMS.map((item, index) => {
            const active = item.value === activeNavValue;
            const iconEl = active ? item.activeIcon : item.icon;

            // دکمهٔ لهجه‌دار جستجو: یک دایرهٔ توپر و کمی برجسته در وسط نوار —
            // نه یک تب مثل بقیه. طبق روند «ادغام کنش اصلی در خودِ نوار» به‌جای
            // FAB شناورِ جداگانه، اما چون این یک «کنش» است نه یک «مقصد»،
            // هیچ‌وقت حالت فعال/برچسب نمی‌گیرد و pill لغزنده از روی آن رد
            // می‌شود، نه روی آن می‌نشیند.
            if (item.isAction) {
              return (
                <Box
                  key={item.value}
                  ref={(el: HTMLButtonElement | null) => {
                    navItemRefs.current[index] = el;
                  }}
                  component="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label={item.label}
                  sx={{
                    position: "relative",
                    zIndex: 1,
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    // بدون این دو خط، دکمهٔ بومی <button> پس‌زمینه/کادر پیش‌فرض
                    // مرورگر (سفید + گاهی outline فوکوس) را نشان می‌دهد که پشت
                    // دایرهٔ نارنجی به‌صورت یک مربع نامتناسب دیده می‌شد — همان
                    // ناهماهنگی که آیتم‌های عادی نوار (با background: "none")
                    // از قبل نداشتند.
                    background: "none",
                    outline: "none",
                    cursor: "pointer",
                    py: 0.75,
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      minWidth: 44,
                      minHeight: 44,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      boxShadow: (theme) =>
                        `0 4px 14px ${alpha(theme.palette.primary.main, 0.45)}`,
                      transition: "transform 120ms ease-out",
                      "&:active": { transform: "scale(0.92)" },
                      "& svg": { fontSize: 22 },
                    }}
                  >
                    {iconEl}
                  </Box>
                </Box>
              );
            }

            return (
              <Box
                key={item.value}
                ref={(el: HTMLButtonElement | null) => {
                  navItemRefs.current[index] = el;
                }}
                component="button"
                onClick={() => navigate(item.value)}
                sx={{
                  position: "relative",
                  zIndex: 1,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.25,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  py: 0.75,
                  minHeight: 44,
                  borderRadius: 999,
                  color: active ? "primary.contrastText" : "text.secondary",
                  transition: "color 180ms ease-out, transform 120ms ease-out",
                  "&:active": { transform: "scale(0.96)" },
                  "& svg": { fontSize: 22 },
                }}
              >
                {item.value === "/activities" && !!dueActivityCount ? (
                  <Badge
                    badgeContent={dueActivityCount}
                    color="error"
                    max={9}
                    sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", minWidth: 16, height: 16 } }}
                  >
                    {iconEl}
                  </Badge>
                ) : (
                  iconEl
                )}
                {/* برچسب فقط زیر آیتم فعال دیده می‌شود — آیتم‌های غیرفعال فقط
                    آیکون‌اند. به‌جای mount/unmount ناگهانی، عرض و شفافیت
                    برچسب انیمیت می‌شوند تا ظاهرشدنش نرم باشد، نه پرشی؛ چون هر
                    آیتم مسیری flex:1 دارد، عرض واقعی دکمه (که pill لغزنده روی
                    آن اندازه می‌گیرد) هیچ‌وقت با نمایش/عدم‌نمایش این برچسب
                    عوض نمی‌شود. */}
                <Typography
                  variant="caption"
                  aria-hidden={!active}
                  sx={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    lineHeight: 1,
                    maxWidth: active ? 96 : 0,
                    opacity: active ? 1 : 0,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    transition: "max-width 220ms ease-out, opacity 160ms ease-out",
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Paper>
      </Box>

      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Box>
  );
}
