import { Children, ReactNode } from "react";
import { Box, Collapse } from "@mui/material";
import { TransitionGroup } from "react-transition-group";

interface AnimatedListProps {
  children: ReactNode;
  /** فاصله عمودی بین آیتم‌ها (واحد spacing تم، پیش‌فرض ۱.۲۵ مثل بیشتر لیست‌های اپ). */
  spacing?: number;
}

// حداکثر تعداد آیتمی که تأخیر پلکانی برایش حساب می‌شود و فاصلهٔ هر پله —
// بدون این سقف، یک لیست بلند (مثلاً ۴۰ نیرو) باعث می‌شد آیتم‌های پایینی
// صدها میلی‌ثانیه بعد از بقیه ظاهر شوند؛ بعد از ۸ آیتم همه با همان
// تأخیر آخر وارد می‌شوند، چون تفاوت آن دیگر برای چشم قابل‌تشخیص نیست.
const STAGGER_MAX_ITEMS = 8;
const STAGGER_STEP_MS = 30;

/**
 * پوششی سبک دور TransitionGroup+Collapse مخصوص MUI: هر فرزند باید یک `key`
 * یکتا و پایدار داشته باشد (مثلاً id رکورد). با این پوشش، اضافه/حذف‌شدن یک
 * آیتم از لیست (نه کل لیست) به‌آرامی انیمیشن می‌گیرد، به‌جای پریدن ناگهانی
 * محتوا. مناسب لیست‌های نیرو، تراکنش‌های دفتر حساب، فعالیت‌ها و مشابه.
 *
 * `appear` روی TransitionGroup یعنی همان دسته‌ی اول آیتم‌ها (لحظه‌ای که
 * صفحه/تب باز می‌شود) هم انیمیشن ورود می‌گیرند، نه فقط آیتم‌هایی که بعداً
 * اضافه می‌شوند؛ به‌علاوه با `transitionDelay` پلکانی روی هر آیتم، کل لیست
 * یک‌دفعه ظاهر نمی‌شود بلکه ردیف‌به‌ردیف از بالا می‌آید — مشابه رفتار
 * اپ‌های بومی اندروید. چون جعبهٔ صفحه در AppLayout با `key={pathname}`
 * به‌ازای هر مسیر دوباره mount می‌شود، این ورود پلکانی هر بار که کاربر
 * دوباره به آن تب سر می‌زند تکرار می‌شود، نه فقط یک‌بار در کل عمر اپ.
 */
export function AnimatedList({ children, spacing = 1.25 }: AnimatedListProps) {
  const items = Children.toArray(children);
  return (
    <TransitionGroup component={null} appear>
      {items.map((child, i) => (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Collapse
          key={(child as any).key ?? i}
          timeout={220}
          style={{ transitionDelay: `${Math.min(i, STAGGER_MAX_ITEMS) * STAGGER_STEP_MS}ms` }}
        >
          <Box sx={{ pb: i < items.length - 1 ? spacing : 0 }}>{child}</Box>
        </Collapse>
      ))}
    </TransitionGroup>
  );
}
