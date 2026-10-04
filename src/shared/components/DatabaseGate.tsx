import { useEffect, useState, type ReactNode } from "react";
import { db } from "../../core/db";
import { StartupErrorScreen } from "./StartupErrorScreen";

type GateState = { status: "loading" } | { status: "ready" } | { status: "error"; error: unknown };

/**
 * تا وقتی دیتابیس با موفقیت باز نشده، هیچ بخشی از برنامه (و هیچ کار پس‌زمینه‌ای
 * مثل بکاپ خودکار) اجرا نمی‌شود. اگر باز شدن شکست بخورد، به‌جای صفحهٔ سفید
 * صفحهٔ خطا با راهنمای بازیابی نشان داده می‌شود.
 *
 * مهم: بکاپ خودکار روی دیتابیس خالیِ بعد از شکست مهاجرت نباید اجرا شود، چون
 * هرس بکاپ‌های قدیمی می‌تواند همان نسخه‌هایی را که لازم داریم پاک کند.
 */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    db.open().then(
      () => !cancelled && setState({ status: "ready" }),
      (error: unknown) => !cancelled && setState({ status: "error", error })
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "error") return <StartupErrorScreen error={state.error} />;
  if (state.status === "loading") return null;
  return <>{children}</>;
}
