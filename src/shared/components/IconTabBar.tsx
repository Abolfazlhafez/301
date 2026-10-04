import { Badge, Box } from "@mui/material";
import { ReactNode } from "react";

export interface IconTabBarItem {
  label: string;
  icon: ReactNode;
  /** آیکون حالت فعال (اختیاری) — اگر ندهید، همان icon در هر دو حالت استفاده می‌شود. */
  activeIcon?: ReactNode;
  /** عدد کوچک روی آیکون (مثلاً تعداد مورد انتخاب‌شده در هر زیرتب). */
  badgeContent?: number;
}

interface IconTabBarProps {
  items: IconTabBarItem[];
  value: number;
  onChange: (index: number) => void;
}

/**
 * جایگزین نوار تب بالای صفحه (به‌جای MUI Tabs). قبلاً با تعداد زیاد
 * زبانه یا برچسب‌های بلند، نوار اسکرول‌شونده می‌شد و دو دکمهٔ فلش قبل/بعد
 * (scrollButtons="auto") کنارش ظاهر می‌شدند — این فلش‌ها هم فضای کمیاب
 * نوار را می‌خوردند و هم یعنی همیشه حداقل یک زبانه از دید پنهان بود.
 *
 * اینجا هر زبانه فقط یک آیکون کوچک ثابت است؛ برچسب متنی‌اش فقط برای
 * زبانهٔ *فعال* ظاهر می‌شود (دقیقاً هم‌خانواده با مورفِ نوار ناوبری پایین
 * در AppLayout: آیکون‌های خطی/توپر + برچسب فقط زیر آیتم انتخاب‌شده).
 * چون در حالت غیرفعال هر آیتم فقط یک آیکون است، کل ردیف — حتی با تعداد
 * زیاد زبانه (مثلاً ۶ تا در دفترچهٔ طبقه) — همیشه در عرض صفحه جا می‌شود؛
 * پس هیچ‌وقت به اسکرول افقی یا دکمهٔ فلش نیاز نیست.
 */
export function IconTabBar({ items, value, onChange }: IconTabBarProps) {
  return (
    <Box
      role="tablist"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.25,
        width: "100%",
        bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(17,19,24,0.045)"),
        borderRadius: 999,
        p: 0.5,
      }}
    >
      {items.map((item, index) => {
        const active = index === value;
        const iconEl = active && item.activeIcon ? item.activeIcon : item.icon;
        return (
          <Box
            key={index}
            component="button"
            role="tab"
            aria-selected={active}
            aria-label={item.label}
            onClick={() => onChange(index)}
            sx={{
              position: "relative",
              flex: active ? "2 1 0%" : "1 1 0%",
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.5,
              border: "none",
              background: "none",
              cursor: "pointer",
              borderRadius: 999,
              py: 0.85,
              px: 0.5,
              bgcolor: active ? "primary.main" : "transparent",
              color: active ? "primary.contrastText" : "text.secondary",
              transition: "background-color 180ms ease-out, color 180ms ease-out, flex-grow 220ms ease-out",
              "&:active": { transform: "scale(0.96)" },
              "& svg": { fontSize: 20, flexShrink: 0 },
            }}
          >
            {item.badgeContent ? (
              <Badge
                badgeContent={item.badgeContent}
                color={active ? "default" : "primary"}
                max={99}
                sx={{
                  "& .MuiBadge-badge": {
                    fontSize: "0.55rem",
                    minWidth: 14,
                    height: 14,
                    ...(active && { bgcolor: "primary.contrastText", color: "primary.main" }),
                  },
                }}
              >
                {iconEl}
              </Badge>
            ) : (
              iconEl
            )}
            <Box
              component="span"
              sx={{
                fontSize: "0.72rem",
                fontWeight: 700,
                lineHeight: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                display: "inline-block",
                maxWidth: active ? 200 : 0,
                opacity: active ? 1 : 0,
                transition: "max-width 220ms ease-out, opacity 160ms ease-out",
              }}
            >
              {item.label}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
