import { createTheme, ThemeOptions } from "@mui/material/styles";
import { faIR, enUS, arSA, trTR, ruRU, urPK, kuCKB } from "@mui/material/locale";
import { DialogUpTransition } from "../components/DialogUpTransition";

// نگاشت زبان اپ به بستهٔ زبان داخلی MUI (برای متن اجزای داخلی مثل صفحه‌بندی).
// پشتو بستهٔ اختصاصی در MUI ندارد، پس روی انگلیسی برمی‌گردد — این فقط چند
// رشتهٔ داخلی کامپوننت است، نه محتوای واقعی اپ که جداگانه با i18next
// ترجمه می‌شود.
const MUI_LOCALE_MAP: Record<string, typeof faIR> = {
  fa: faIR,
  en: enUS,
  ar: arSA,
  tr: trTR,
  ur: urPK,
  ku: kuCKB,
  ps: enUS,
  ru: ruRU,
};

/**
 * تم اصلی برنامه — طراحی مسطح و مینیمال (سبک ۲۰۲۶).
 * به‌جای گلس‌مورفیسم و گرادینت رنگی سنگین، از سطوح تخت با کنتراست کم،
 * سایه‌های بسیار ظریف و یک لهجه رنگ واحد (نارنجی) استفاده می‌شود تا
 * برنامه در حجم بالای اطلاعات (لیست‌ها، جداول، کارت‌های حساب) آرام،
 * خوانا و «سبک» به نظر برسد.
 * فونت وزیرمتن (Vazirmatn) از طریق CDN بارگذاری می‌شود.
 */

const FONT_FAMILY = "'Vazirmatn', 'Roboto', 'Arial', sans-serif";

// پس‌زمینه‌ی تخت و خنثی — دیگر گرادینت رنگی نداریم، فقط یک سطح خاکستریِ
// بسیار روشن (روز) / سرمه‌ای بسیار تیره و یکدست (شب) که کارت‌های سفید/تیره
// روی آن با سایه‌ای ظریف جدا می‌شوند.
export const LIGHT_BODY_BACKGROUND = "#F4F5F7";
export const DARK_BODY_BACKGROUND = "#111318";

// نگه‌داشته شده برای سازگاری با کدهای دیگری که ممکن است این ثابت‌ها را
// import کرده باشند (مثلاً کامپوننت‌های سفارشی پس‌زمینه)؛ اکنون تخت هستند.
export const LIGHT_GRADIENT_FROM = LIGHT_BODY_BACKGROUND;
export const LIGHT_GRADIENT_TO = LIGHT_BODY_BACKGROUND;
export const DARK_GRADIENT_FROM = DARK_BODY_BACKGROUND;
export const DARK_GRADIENT_TO = DARK_BODY_BACKGROUND;
export const LIGHT_BODY_GRADIENT = LIGHT_BODY_BACKGROUND;
export const DARK_BODY_GRADIENT = DARK_BODY_BACKGROUND;

const SHADOW_SM = "0 1px 2px rgba(17,19,24,0.06)";
const SHADOW_MD = "0 2px 10px rgba(17,19,24,0.07)";
const SHADOW_MD_DARK = "0 2px 10px rgba(0,0,0,0.35)";

function buildThemeOptions(mode: "light" | "dark", dir: "rtl" | "ltr" = "rtl"): ThemeOptions {
  const isDark = mode === "dark";

  return {
    direction: dir,
    palette: {
      mode,
      primary: {
        main: isDark ? "#FFA84D" : "#EA6A00", // نارنجی ایمنی، لهجه‌ی واحد برند در هر دو حالت
        light: isDark ? "#FFC784" : "#FF8A2E",
        dark: isDark ? "#D98526" : "#B85300",
        contrastText: isDark ? "#1A1400" : "#FFFFFF",
      },
      secondary: {
        main: isDark ? "#9AA7C4" : "#4A5568", // خاکستری آبی خنثی برای متن/آیکون ثانویه
        light: isDark ? "#C0C9DE" : "#697488",
        dark: isDark ? "#6E7A99" : "#323B49",
      },
      success: {
        main: isDark ? "#5FCF8E" : "#1E8E3E",
      },
      warning: {
        main: isDark ? "#F0A93E" : "#B25E00",
      },
      error: {
        main: isDark ? "#FF7B7B" : "#C62828",
      },
      info: {
        main: isDark ? "#7DAAFF" : "#1565C0",
      },
      background: {
        default: isDark ? DARK_BODY_BACKGROUND : LIGHT_BODY_BACKGROUND,
        paper: isDark ? "#1A1D24" : "#FFFFFF",
      },
      divider: isDark ? "rgba(255,255,255,0.09)" : "rgba(17,19,24,0.08)",
      text: {
        primary: isDark ? "#EDEEF2" : "#1A1D24",
        secondary: isDark ? "#9BA3B4" : "#5B6472",
      },
    },
    typography: {
      fontFamily: FONT_FAMILY,
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700, letterSpacing: "-0.01em" },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600 },
      body2: { lineHeight: 1.6 },
    },
    shape: {
      borderRadius: 10,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontFamily: FONT_FAMILY,
            backgroundColor: isDark ? DARK_BODY_BACKGROUND : LIGHT_BODY_BACKGROUND,
            backgroundImage: "none",
            minHeight: "100dvh",
          },
          "@keyframes karegahyar-accordion-in": {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 10,
            paddingTop: 9,
            paddingBottom: 9,
            fontSize: "0.9rem",
            boxShadow: "none",
            transition: "transform 120ms ease-out, background-color 150ms ease-out",
            "&:active": {
              transform: "scale(0.97)",
            },
          },
          sizeLarge: {
            paddingTop: 13,
            paddingBottom: 13,
            fontSize: "1rem",
          },
          contained: {
            boxShadow: "none",
            "&:hover": { boxShadow: "none" },
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: isDark ? "#1A1D24" : "#FFFFFF",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(17,19,24,0.07)"}`,
            boxShadow: "none",
          },
          elevation1: {
            boxShadow: isDark ? SHADOW_MD_DARK : SHADOW_SM,
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: isDark ? "#1A1D24" : "#FFFFFF",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(17,19,24,0.07)"}`,
            boxShadow: "none",
            transition: "transform 150ms ease-out, box-shadow 150ms ease-out, border-color 150ms ease-out",
          },
        },
      },
      MuiAppBar: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: isDark
            ? {
                backgroundColor: "#15171D",
                backgroundImage: "none",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }
            : {
                backgroundColor: "#FFFFFF",
                backgroundImage: "none",
                color: "#1A1D24",
                borderBottom: "1px solid rgba(17,19,24,0.07)",
              },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: isDark
            ? {
                backgroundColor: "#15171D",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }
            : {
                backgroundColor: "#FFFFFF",
                borderTop: "1px solid rgba(17,19,24,0.07)",
              },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            "&.Mui-selected": {
              fontWeight: 600,
            },
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          fullWidth: true,
          size: "small",
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: "box-shadow 150ms ease-out",
            "& .MuiOutlinedInput-notchedOutline": {
              transition: "border-color 150ms ease-out",
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: "transform 120ms ease-out",
            "&:active": {
              transform: "scale(0.9)",
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 8,
          },
        },
      },
      // انیمیشن‌های سریع و سبک برای Dialog/Menu/Accordion/Tooltip در کل اپ —
      // با override در سطح تم، نیازی به تغییر تک‌تک فایل‌ها نیست و رفتار در
      // همه‌جا یکدست می‌ماند. اعداد عمداً کوتاه انتخاب شده‌اند (اپ روی
      // موبایل باید سریع و سبک حس شود، نه کند و پرزرق‌وبرق).
      MuiDialog: {
        defaultProps: {
          transitionDuration: { enter: 220, exit: 160 },
          TransitionComponent: DialogUpTransition,
        },
        styleOverrides: {
          paper: {
            borderRadius: 14,
            boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.5)" : "0 8px 30px rgba(17,19,24,0.14)",
          },
        },
      },
      MuiMenu: {
        defaultProps: {
          transitionDuration: { enter: 150, exit: 110 },
        },
        styleOverrides: {
          paper: {
            borderRadius: 10,
            boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.45)" : "0 4px 20px rgba(17,19,24,0.12)",
          },
        },
      },
      MuiPopover: {
        defaultProps: {
          transitionDuration: { enter: 150, exit: 110 },
        },
      },
      MuiAccordion: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            transition: "background-color 150ms ease-out",
            backgroundImage: "none",
            "&:before": { display: "none" },
          },
        },
      },
      MuiAccordionDetails: {
        styleOverrides: {
          root: {
            animation: "karegahyar-accordion-in 180ms ease-out",
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          enterDelay: 300,
          leaveDelay: 0,
        },
      },
      MuiSnackbar: {
        defaultProps: {
          transitionDuration: { enter: 200, exit: 150 },
        },
      },
      MuiCollapse: {
        defaultProps: {
          timeout: 180,
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            boxShadow: isDark ? SHADOW_MD_DARK : SHADOW_MD,
            transition: "transform 150ms ease-out, box-shadow 150ms ease-out",
            "&:active": { transform: "scale(0.92)" },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: "background-color 120ms ease-out",
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(17,19,24,0.08)",
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 44,
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(17,19,24,0.045)",
            borderRadius: 999,
            padding: 4,
          },
          indicator: {
            height: "100%",
            borderRadius: 999,
            backgroundColor: isDark ? "#1A1D24" : "#FFFFFF",
            boxShadow: isDark ? "0 1px 4px rgba(0,0,0,0.4)" : "0 1px 4px rgba(17,19,24,0.12)",
            transition: "left 220ms cubic-bezier(0.34, 1.2, 0.64, 1), width 220ms cubic-bezier(0.34, 1.2, 0.64, 1)",
          },
          flexContainer: {
            position: "relative",
            zIndex: 1,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 36,
            borderRadius: 999,
            fontWeight: 600,
            fontSize: "0.85rem",
            textTransform: "none",
            color: isDark ? "rgba(237,238,242,0.65)" : "rgba(26,29,36,0.6)",
            transition: "color 150ms ease-out",
            "&.Mui-selected": {
              color: isDark ? "#FFA84D" : "#EA6A00",
            },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            transition: "transform 180ms cubic-bezier(0.34, 1.2, 0.64, 1), color 150ms ease-out",
          },
          thumb: {
            transition: "box-shadow 150ms ease-out",
          },
          track: {
            transition: "background-color 180ms ease-out, opacity 180ms ease-out",
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            transition: "transform 120ms ease-out, color 150ms ease-out",
            "&:active": {
              transform: "scale(0.88)",
            },
          },
        },
      },
      MuiRadio: {
        styleOverrides: {
          root: {
            transition: "transform 120ms ease-out, color 150ms ease-out",
            "&:active": {
              transform: "scale(0.88)",
            },
          },
        },
      },
    },
  };
}

export function createAppTheme(mode: "light" | "dark", dir: "rtl" | "ltr" = "rtl", lang: string = "fa") {
  const muiLocale = MUI_LOCALE_MAP[lang] ?? enUS;
  return createTheme(buildThemeOptions(mode, dir), muiLocale);
}
