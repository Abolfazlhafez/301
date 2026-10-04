import { ReactNode, TouchEvent, useRef, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { haptics } from "../utils/haptics";

const TRIGGER_DISTANCE = 64;
const MAX_PULL = 100;

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<unknown>;
}

/**
 * حرکت «بکش تا رفرش شود» روی صفحات لیستی. چون اسکرول واقعیِ صفحه در
 * Box اسکرول‌شوندهٔ AppLayout اتفاق می‌افتد (نه روی window)، کشیدن را فقط
 * وقتی فعال می‌کنیم که آن جدترین جد قابل‌اسکرول همین الان scrollTop=0 باشد؛
 * در غیر این‌صورت این ژست با اسکرول عادی لیست تداخل پیدا می‌کند.
 */
export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hapticFiredRef = useRef(false);

  function findScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
    let node = el?.parentElement ?? null;
    while (node) {
      const style = getComputedStyle(node);
      if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function handleTouchStart(e: TouchEvent) {
    if (refreshing) return;
    const scrollAncestor = findScrollableAncestor(wrapperRef.current);
    // فقط وقتی از بالای لیست شروع شده باشد اجازهٔ کشیدن می‌دهیم.
    if (scrollAncestor && scrollAncestor.scrollTop > 2) {
      pullingRef.current = false;
      return;
    }
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
    hapticFiredRef.current = false;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!pullingRef.current || refreshing) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy <= 0) {
      setPullDistance(0);
      return;
    }
    // مقاومت فنری: هرچه بیشتر بکشی، سخت‌تر حرکت می‌کند — حس طبیعی‌تر pull-to-refresh.
    const damped = Math.min(MAX_PULL, dy * 0.5);
    setPullDistance(damped);

    if (!hapticFiredRef.current && damped >= TRIGGER_DISTANCE) {
      hapticFiredRef.current = true;
      haptics.light();
    } else if (hapticFiredRef.current && damped < TRIGGER_DISTANCE) {
      hapticFiredRef.current = false;
    }
  }

  async function handleTouchEnd() {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    if (pullDistance >= TRIGGER_DISTANCE) {
      setRefreshing(true);
      setPullDistance(TRIGGER_DISTANCE);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }

  return (
    <Box
      ref={wrapperRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{ position: "relative" }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: pullDistance,
          overflow: "hidden",
          transition: pullingRef.current ? "none" : "height 200ms ease-out",
          color: "text.secondary",
        }}
      >
        {refreshing ? (
          <CircularProgress size={22} />
        ) : (
          <RefreshIcon
            fontSize="small"
            sx={{
              transform: `rotate(${Math.min(180, (pullDistance / TRIGGER_DISTANCE) * 180)}deg)`,
              transition: "transform 80ms linear",
              opacity: Math.min(1, pullDistance / TRIGGER_DISTANCE),
            }}
          />
        )}
      </Box>
      {children}
    </Box>
  );
}
