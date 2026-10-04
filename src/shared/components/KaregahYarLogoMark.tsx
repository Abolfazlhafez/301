/**
 * نشان (لوگو) برند «کارگاه‌یار» — یک کلاه ایمنی ساده و پرکنتراست.
 *
 * چرا یک svg واحد به‌جای دو svg شرطی جدا برای روشن/تاریک؟
 * نسخهٔ قبلی با `{isDark ? <...دارک/> : <...روشن/>}` کار می‌کرد؛ یعنی با
 * تغییر mode، React کل زیردرخت قبلی را unmount و زیردرخت جدید را mount
 * می‌کرد — که یک پرش رنگی ناگهانی است، نه یک ترنزیشن. در این نسخه، هر جزء
 * بصری (زمینه، گنبد، نوار تهویه، حلقهٔ برند) همیشه هر دو رنگ‌بندی
 * (روشن/تاریک) را هم‌زمان در DOM دارد و فقط opacity بین آن دو، با
 * `transition: opacity`، محو-به-محو (crossfade) عوض می‌شود؛ خودِ شکل‌ها
 * (path/rect/circle) یکی هستند و هرگز mount/unmount نمی‌شوند.
 *
 * چرا SVG اینلاین به‌جای import فایل‌های icon-source/*.svg؟
 * چون برای انیمیشن ورود لازم است تک‌تک اجزای لوگو (زمینه، گنبد کلاه،
 * نوار تهویه، لبه، و حلقهٔ برند) جدا از هم keyframe داشته باشند؛ این با
 * <img src=".../logo.svg" /> ممکن نیست چون محتوای SVG در سایه‌DOM جدا
 * بارگذاری می‌شود و قابل استایل‌دهی از بیرون نیست.
 */
export interface KaregahYarLogoMarkProps {
  /** حالت رنگی؛ باید با mode واقعی تم اپ هماهنگ باشد. */
  mode: "light" | "dark";
  /** ابعاد مربع لوگو به پیکسل. */
  size?: number;
  /** اگر true باشد، اجزای لوگو با تأخیر نسبت به هم وارد صحنه می‌شوند. */
  animated?: boolean;
}

// مدت محو-به-محوِ (crossfade) بین رنگ‌بندی روشن/تاریک، وقتی کاربر تم را
// در حین استفاده از اپ (نه در لحظهٔ انیمیشن ورود) عوض می‌کند.
const MODE_TRANSITION = "opacity 420ms ease-out";

export function KaregahYarLogoMark({ mode, size = 76, animated = false }: KaregahYarLogoMarkProps) {
  const isDark = mode === "dark";
  // وقتی animated=true (لحظهٔ ورود/اسپلش)، خودِ کیفریم‌های ورود کنترل
  // opacity گروه بیرونی را به عهده دارند؛ اگر همزمان یک transition دیگر
  // هم روی opacity زیرلایه‌های روشن/تاریک بگذاریم، دو منبع کنترل‌کنندهٔ
  // یک ویژگی با هم تداخل می‌کنند. پس crossfade فقط در حالت پایدار (غیر
  // ورودی) فعال است؛ در لحظهٔ ورود، لایهٔ درست همان لحظه (بدون تأخیر)
  // opacity کامل دارد — که چون mode معمولاً در طول یک انیمیشن ورودِ
  // چندصدمیلی‌ثانیه‌ای عوض نمی‌شود، مشکلی ایجاد نمی‌کند.
  const crossfadeTransition = animated ? undefined : MODE_TRANSITION;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="کارگاه‌یار"
      style={{ display: "block", overflow: "visible" }}
    >
      {animated && (
        <style>
          {`
            @keyframes kyBg { 0% { opacity: 0; transform: scale(0.82); } 100% { opacity: 1; transform: scale(1); } }
            @keyframes kyDome { 0% { opacity: 0; transform: translateY(-10px); } 70% { opacity: 1; } 100% { opacity: 1; transform: translateY(0); } }
            @keyframes kyVent { 0% { opacity: 0; transform: translateY(-8px); } 100% { opacity: 1; transform: translateY(0); } }
            @keyframes kyBrim { 0% { opacity: 0; transform: scaleX(0.4); } 100% { opacity: 1; transform: scaleX(1); } }
            @keyframes kyRing { 0% { stroke-dashoffset: 289; } 100% { stroke-dashoffset: 0; } }
            .ky-bg { transform-origin: 50px 50px; animation: kyBg 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
            .ky-dome { transform-origin: 50px 52px; animation: kyDome 360ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both; }
            .ky-vent { transform-origin: 50px 33px; animation: kyVent 300ms ease-out 180ms both; }
            .ky-brim { transform-origin: 50px 55.5px; animation: kyBrim 340ms cubic-bezier(0.22, 1, 0.36, 1) 280ms both; }
            .ky-ring { animation: kyRing 520ms ease-out 60ms both; }
          `}
        </style>
      )}
      <defs>
        {/* هر دو ست گرادینت (روشن و تاریک) همیشه با idهای ثابت تعریف
            می‌شوند — بر خلاف نسخهٔ قبلی که idها به mode وابسته بودند،
            چون حالا هر دو باید هم‌زمان در DOM باشند تا crossfade ممکن شود. */}
        <linearGradient id="kyBgLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF9142" />
          <stop offset="55%" stopColor="#FF7A00" />
          <stop offset="100%" stopColor="#E85F00" />
        </linearGradient>
        <linearGradient id="kyBgDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1C2430" />
          <stop offset="55%" stopColor="#131924" />
          <stop offset="100%" stopColor="#0B0F16" />
        </linearGradient>
        <linearGradient id="kyDomeLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#323F55" />
          <stop offset="100%" stopColor="#131924" />
        </linearGradient>
        <linearGradient id="kyDomeDark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3D4A63" />
          <stop offset="100%" stopColor="#1B2230" />
        </linearGradient>
        <linearGradient id="kyBrim" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#DEE4EC" />
        </linearGradient>
        <linearGradient id="kyAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFA85C" />
          <stop offset="100%" stopColor="#FF7A00" />
        </linearGradient>
        <radialGradient id="kySheenLight" cx="30%" cy="20%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="kySheenDark" cx="30%" cy="20%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* زمینه + درخشش: دو لایهٔ روشن/تاریک دقیقاً روی هم، فقط opacity
          بین ۰ و ۱ محو-به-محو می‌شود. */}
      <g className={animated ? "ky-bg" : undefined}>
        <g style={{ opacity: isDark ? 0 : 1, transition: crossfadeTransition }}>
          <rect width="100" height="100" rx="24" fill="url(#kyBgLight)" />
          <rect width="100" height="100" rx="24" fill="url(#kySheenLight)" />
        </g>
        <g style={{ opacity: isDark ? 1 : 0, transition: crossfadeTransition }}>
          <rect width="100" height="100" rx="24" fill="url(#kyBgDark)" />
          <rect width="100" height="100" rx="24" fill="url(#kySheenDark)" />
        </g>
      </g>

      {/* حلقهٔ برند: فقط در حالت تاریک دیده می‌شود؛ همیشه در DOM است و
          فقط opacity آن بین ۰ و ۰.۹ محو-به-محو می‌شود (نه mount/unmount). */}
      <circle
        className={animated ? "ky-ring" : undefined}
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="url(#kyAccent)"
        strokeWidth="2.4"
        strokeDasharray="289"
        style={{ opacity: isDark ? 0.9 : 0, transition: crossfadeTransition }}
      />

      <g className={animated ? "ky-dome" : undefined}>
        <path
          d="M 20 52.5 A 30 30 0 0 1 80 52.5 L 80 55.5 A 30.5 6.2 0 0 1 50 61.7 A 30.5 6.2 0 0 1 20 55.5 Z"
          fill="url(#kyDomeLight)"
          style={{ opacity: isDark ? 0 : 1, transition: crossfadeTransition }}
        />
        <path
          d="M 20 52.5 A 30 30 0 0 1 80 52.5 L 80 55.5 A 30.5 6.2 0 0 1 50 61.7 A 30.5 6.2 0 0 1 20 55.5 Z"
          fill="url(#kyDomeDark)"
          style={{ opacity: isDark ? 1 : 0, transition: crossfadeTransition }}
        />
      </g>

      <g className={animated ? "ky-vent" : undefined}>
        <rect
          x="45.5"
          y="25"
          width="9"
          height="17"
          rx="4.5"
          fill="url(#kyBgLight)"
          style={{ opacity: isDark ? 0 : 1, transition: crossfadeTransition }}
        />
        <rect
          x="45.5"
          y="25"
          width="9"
          height="17"
          rx="4.5"
          fill="url(#kyAccent)"
          style={{ opacity: isDark ? 1 : 0, transition: crossfadeTransition }}
        />
      </g>

      {/* لبهٔ کلاه (brim) در هر دو حالت دقیقاً یک رنگ‌بندی دارد، پس نیازی
          به دو لایه/crossfade ندارد. */}
      <ellipse
        className={animated ? "ky-brim" : undefined}
        cx="50"
        cy="55.5"
        rx="31.5"
        ry="6.4"
        fill="url(#kyBrim)"
      />
    </svg>
  );
}
