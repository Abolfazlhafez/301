import { SvgIcon, SvgIconProps } from "@mui/material";

/**
 * آیکون‌های اختصاصی برای ۵۰ شغل پیش‌فرض ساختمانی. هر آیکون یک SVG واقعی و
 * ساده است (نه فقط رنگ‌آمیزی مجدد یک آیکون عمومی)، با سبک خطی هماهنگ با
 * آیکون‌های Material که در بقیهٔ اپ استفاده می‌شوند (viewBox 24x24،
 * stroke-based، currentColor تا با رنگ تم هماهنگ باشد).
 *
 * این فایل عمداً همهٔ ۵۰ آیکون را در یک جا نگه می‌دارد (نه ۵۰ فایل جدا) تا
 * مدیریت، جستجو و افزودن آیکون جدید برای شغل‌های آینده ساده بماند.
 */

type JobIconRenderer = (props: SvgIconProps) => JSX.Element;

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function icon(paths: (props: SvgIconProps) => JSX.Element): JobIconRenderer {
  return (props: SvgIconProps) => (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {paths(props)}
    </SvgIcon>
  );
}

// --- بنایی و دیوارچینی ---

const trowelBrick = icon(() => (
  <>
    <rect x="3" y="12" width="6" height="4" rx="0.5" {...stroke} />
    <rect x="9.5" y="12" width="6" height="4" rx="0.5" {...stroke} />
    <path d="M15 8 L21 3 M17.5 5.5 L19.5 7.5" {...stroke} />
    <path d="M15 8 A2.2 2.2 0 0 1 18 8" {...stroke} />
  </>
));

const wallBrick = icon(() => (
  <>
    <rect x="3" y="4" width="18" height="16" {...stroke} />
    <path d="M3 8h9M12 8v4M12 12h9M3 12v4h9M12 16v4M12 16h9" {...stroke} strokeWidth={1.2} />
  </>
));

const concreteBlock = icon(() => (
  <>
    <rect x="3" y="9" width="8" height="6" rx="0.5" {...stroke} />
    <rect x="13" y="9" width="8" height="6" rx="0.5" {...stroke} />
    <circle cx="7" cy="12" r="1.2" {...stroke} />
    <circle cx="17" cy="12" r="1.2" {...stroke} />
  </>
));

const plasterTrowel = icon(() => (
  <>
    <rect x="3" y="3" width="12" height="10" rx="1" {...stroke} />
    <path d="M15 13 L21 19 M19 17 L21 19 L19 21" {...stroke} />
  </>
));

const cementMix = icon(() => (
  <>
    <circle cx="9" cy="9" r="6" {...stroke} />
    <path d="M9 5v4l3 2" {...stroke} />
    <path d="M15 15 L21 21" {...stroke} />
  </>
));

const paintRoller = icon(() => (
  <>
    <rect x="4" y="4" width="12" height="6" rx="1.5" {...stroke} />
    <path d="M10 10v3" {...stroke} />
    <path d="M8 13h4v6a2 2 0 0 1-2 2 2 2 0 0 1-2-2z" {...stroke} />
  </>
));

// --- کاشی/سرامیک/سنگ ---

const tileGrid = icon(() => (
  <>
    <rect x="3" y="3" width="8" height="8" rx="0.6" {...stroke} />
    <rect x="13" y="3" width="8" height="8" rx="0.6" {...stroke} />
    <rect x="3" y="13" width="8" height="8" rx="0.6" {...stroke} />
    <rect x="13" y="13" width="8" height="8" rx="0.6" {...stroke} />
  </>
));

const stoneSlab = icon(() => (
  <>
    <path d="M3 16 L6 6 L18 6 L21 16 Z" {...stroke} />
    <path d="M3 16h18" {...stroke} />
    <path d="M8 6l-2 10M16 6l2 10" {...stroke} strokeWidth={1} />
  </>
));

// --- سازه و اسکلت ---

const rebarBend = icon(() => (
  <>
    <path d="M4 20 V8 a4 4 0 0 1 4 -4 h10" {...stroke} />
    <path d="M15 2 l3 2 -3 2" {...stroke} />
    <path d="M4 20 h4" {...stroke} strokeWidth={1} />
  </>
));

const formwork = icon(() => (
  <>
    <rect x="4" y="4" width="16" height="16" {...stroke} />
    <path d="M4 9h16M4 14h16M9 4v16M14 4v16" {...stroke} strokeWidth={1.1} />
  </>
));

const concretePour = icon(() => (
  <>
    <path d="M5 3 L19 3 L17 10 L7 10 Z" {...stroke} />
    <path d="M9 10 L9 15 M15 10 L15 15" {...stroke} />
    <path d="M5 19 h14" {...stroke} />
    <path d="M9 15 q3 3 6 0" {...stroke} />
  </>
));

const weldingMask = icon(() => (
  <>
    <path d="M6 10 a6 6 0 0 1 12 0 v4 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 Z" {...stroke} />
    <rect x="8.5" y="10.5" width="7" height="3" rx="0.5" {...stroke} />
    <path d="M3 21 l3 -5 M21 21 l-3 -5" {...stroke} />
  </>
));

const steelFrame = icon(() => (
  <>
    <path d="M4 20 V4 h16 v16" {...stroke} />
    <path d="M4 4 L20 20 M20 4 L4 20" {...stroke} strokeWidth={1.1} />
  </>
));

// --- برق و تأسیسات ---

const electricBolt = icon(() => (
  <>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="M13 6 L8 13 h4 l-1 6 6 -8 h-4 z" {...stroke} strokeLinejoin="round" fill="none" />
  </>
));

const conduitPanel = icon(() => (
  <>
    <rect x="5" y="3" width="14" height="18" rx="1" {...stroke} />
    <path d="M8 7h8M8 11h8M8 15h5" {...stroke} strokeWidth={1.1} />
    <circle cx="17" cy="15" r="1" fill="currentColor" stroke="none" />
  </>
));

const pipeWrench = icon(() => (
  <>
    <path d="M4 4 h9 v6 h-9 z" {...stroke} />
    <path d="M13 7 h7" {...stroke} />
    <path d="M17 4 v6" {...stroke} strokeWidth={1} />
    <path d="M6 10 v10" {...stroke} />
    <path d="M4 20 h4" {...stroke} />
  </>
));

const gasFlame = icon(() => (
  <>
    <path d="M12 3 c-4 4 -6 7 -6 10 a6 6 0 0 0 12 0 c0 -2 -1 -4 -2.5 -5 c0.3 2 -0.5 3 -1.5 3 c-1.2 0 -1.5 -1.2 -1 -2.5 C13.8 6.5 12.8 4.7 12 3 Z" {...stroke} />
  </>
));

const drainPipe = icon(() => (
  <>
    <path d="M4 4 v9 a5 5 0 0 0 5 5 h11" {...stroke} />
    <path d="M17 15 l3 3 -3 3" {...stroke} />
    <circle cx="4" cy="4" r="1.3" fill="currentColor" stroke="none" />
  </>
));

const pipeFitting = icon(() => (
  <>
    <path d="M4 8 h7 v8 h-7 z" {...stroke} />
    <path d="M11 12 h9" {...stroke} />
    <path d="M17 9 l3 3 -3 3" {...stroke} />
  </>
));

// --- نجاری/در و پنجره/کابینت ---

const windowFrame = icon(() => (
  <>
    <rect x="4" y="4" width="16" height="16" rx="1" {...stroke} />
    <path d="M12 4v16M4 12h16" {...stroke} />
  </>
));

const doorInstall = icon(() => (
  <>
    <rect x="6" y="3" width="12" height="18" rx="0.6" {...stroke} />
    <circle cx="14.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
  </>
));

const cabinetBox = icon(() => (
  <>
    <rect x="4" y="3" width="16" height="18" rx="1" {...stroke} />
    <path d="M12 3v18" {...stroke} />
    <circle cx="9.5" cy="12" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="12" r="0.7" fill="currentColor" stroke="none" />
  </>
));

const sawBlade = icon(() => (
  <>
    <circle cx="12" cy="12" r="7" {...stroke} />
    <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.5 7.5l1.4 1.4M15.1 15.1l1.4 1.4M16.5 7.5l-1.4 1.4M8.9 15.1l-1.4 1.4" {...stroke} strokeWidth={1.2} />
  </>
));

// --- کناف و سقف کاذب ---

const drywallPanel = icon(() => (
  <>
    <rect x="4" y="4" width="16" height="16" rx="1" {...stroke} />
    <path d="M4 9h16M4 14h16" {...stroke} strokeWidth={1} />
    <path d="M9 4v16" {...stroke} strokeWidth={1} />
  </>
));

const ceilingGrid = icon(() => (
  <>
    <rect x="3" y="3" width="18" height="14" rx="1" {...stroke} />
    <path d="M3 8h18M3 13h18M9 3v14M15 3v14" {...stroke} strokeWidth={0.9} />
    <path d="M12 17v4" {...stroke} />
  </>
));

// --- نما و ایزوگام ---

const facadePanel = icon(() => (
  <>
    <path d="M4 20 V6 l8 -3 8 3 v14" {...stroke} />
    <path d="M4 20h16" {...stroke} />
    <path d="M8 20V9M12 20V7.5M16 20V9" {...stroke} strokeWidth={1} />
  </>
));

const bitumenRoll = icon(() => (
  <>
    <circle cx="7" cy="8" r="4" {...stroke} />
    <path d="M11 8 H20 V19 H6 v-4" {...stroke} />
    <path d="M6 15 q2 -2 4 0" {...stroke} strokeWidth={1} />
  </>
));

const asphaltRoad = icon(() => (
  <>
    <path d="M3 17 L9 6 h6 l6 11 Z" {...stroke} />
    <path d="M11 12h2M9.5 15h5" {...stroke} strokeWidth={1.3} />
  </>
));

// --- کف‌سازی ---

const floorTile = icon(() => (
  <>
    <path d="M3 12 L12 5 L21 12 L12 19 Z" {...stroke} />
    <path d="M3 12h18M12 5v14" {...stroke} strokeWidth={1} />
  </>
));

const parquetPlank = icon(() => (
  <>
    <rect x="3" y="6" width="8" height="4" rx="0.4" {...stroke} />
    <rect x="13" y="6" width="8" height="4" rx="0.4" {...stroke} />
    <rect x="7" y="14" width="8" height="4" rx="0.4" {...stroke} />
    <rect x="3" y="14" width="2" height="4" rx="0.2" {...stroke} />
    <rect x="17" y="14" width="4" height="4" rx="0.4" {...stroke} />
  </>
));

// --- عمومی کارگاه ---

const scaffold = icon(() => (
  <>
    <path d="M5 21V3M19 21V3" {...stroke} />
    <path d="M5 7h14M5 14h14" {...stroke} />
    <path d="M5 3l14 18M19 3L5 21" {...stroke} strokeWidth={1} />
  </>
));

const demolitionHammer = icon(() => (
  <>
    <path d="M14 3 l7 7 -3 3 -7 -7 z" {...stroke} />
    <path d="M11 9 L4 16 l4 4 7 -7" {...stroke} />
  </>
));

const excavator = icon(() => (
  <>
    <path d="M3 20h10" {...stroke} />
    <rect x="5" y="14" width="6" height="4" rx="0.6" {...stroke} />
    <path d="M11 15 L18 9" {...stroke} />
    <path d="M18 9 L21 11 L17 15 L15 13 Z" {...stroke} />
  </>
));

const wheelbarrow = icon(() => (
  <>
    <circle cx="7" cy="19" r="2" {...stroke} />
    <path d="M9 18 H19 L16 9 H10 Z" {...stroke} />
    <path d="M5 19 H3 L6 11 H9" {...stroke} />
  </>
));

const craneHook = icon(() => (
  <>
    <path d="M4 4 h16" {...stroke} />
    <path d="M8 4 v9" {...stroke} />
    <path d="M16 4 v5" {...stroke} />
    <path d="M8 13 a3 3 0 0 0 6 0" {...stroke} />
  </>
));

const guardShield = icon(() => (
  <>
    <path d="M12 3 l7 3 v6 c0 5 -3 8 -7 9 -4 -1 -7 -4 -7 -9 V6 Z" {...stroke} />
    <path d="M9 12 l2 2 4 -4" {...stroke} />
  </>
));

const generalWorker = icon(() => (
  <>
    <circle cx="12" cy="7" r="3" {...stroke} />
    <path d="M5 21 c0 -5 3 -8 7 -8 s7 3 7 8" {...stroke} />
  </>
));

const elevatorCar = icon(() => (
  <>
    <rect x="6" y="3" width="12" height="18" rx="1" {...stroke} />
    <path d="M12 8v8M9 11l3 -3 3 3M9 13l3 3 3 -3" {...stroke} strokeWidth={1.2} />
  </>
));

const stairSteps = icon(() => (
  <>
    <path d="M3 20 h4 v-4 h4 v-4 h4 v-4 h4 v-4" {...stroke} />
    <path d="M3 20 V16 h4" {...stroke} strokeWidth={1} />
  </>
));

const upvcFrame = icon(() => (
  <>
    <rect x="4" y="4" width="16" height="16" rx="1.2" {...stroke} />
    <rect x="7" y="7" width="10" height="10" rx="0.8" {...stroke} strokeWidth={1.1} />
  </>
));

const floorCoveringRoll = icon(() => (
  <>
    <rect x="3" y="3" width="6" height="18" rx="3" {...stroke} />
    <path d="M9 6 H21 V18 H9" {...stroke} strokeWidth={1.1} />
    <path d="M9 10h12M9 14h12" {...stroke} strokeWidth={0.9} />
  </>
));

const pipeInstall = icon(() => (
  <>
    <path d="M3 6 h8 a4 4 0 0 1 4 4 v8" {...stroke} />
    <circle cx="15" cy="18" r="2" {...stroke} />
    <circle cx="3" cy="6" r="1.3" fill="currentColor" stroke="none" />
  </>
));

const diggingShovel = icon(() => (
  <>
    <path d="M17 3 L21 7 L11 17 L7 21 L7 17 L11 13 Z" {...stroke} />
    <path d="M7 17 L3 21" {...stroke} />
  </>
));

const materialCarry = icon(() => (
  <>
    <rect x="3" y="5" width="8" height="6" rx="0.6" {...stroke} />
    <rect x="13" y="5" width="8" height="6" rx="0.6" {...stroke} />
    <path d="M7 11v3M17 11v3" {...stroke} strokeWidth={1} />
    <path d="M4 20 h16" {...stroke} />
    <path d="M7 14 l-3 6M17 14 l3 6" {...stroke} strokeWidth={1} />
  </>
));

const JOB_ICON_REGISTRY: Record<string, JobIconRenderer> = {
  trowelBrick,
  wallBrick,
  concreteBlock,
  plasterTrowel,
  cementMix,
  paintRoller,
  tileGrid,
  stoneSlab,
  rebarBend,
  formwork,
  concretePour,
  weldingMask,
  steelFrame,
  electricBolt,
  conduitPanel,
  pipeWrench,
  gasFlame,
  drainPipe,
  pipeFitting,
  windowFrame,
  doorInstall,
  cabinetBox,
  sawBlade,
  drywallPanel,
  ceilingGrid,
  facadePanel,
  bitumenRoll,
  asphaltRoad,
  floorTile,
  parquetPlank,
  scaffold,
  demolitionHammer,
  excavator,
  wheelbarrow,
  craneHook,
  guardShield,
  generalWorker,
  elevatorCar,
  stairSteps,
  upvcFrame,
  floorCoveringRoll,
  pipeInstall,
  diggingShovel,
  materialCarry,
};

interface JobTypeIconProps extends SvgIconProps {
  iconKey: string;
}

/**
 * رندر آیکون یک شغل بر اساس iconKey. اگر کلید در رجیستری پیدا نشود (مثلاً
 * برای یک تیپ سفارشی که کاربر آیکون خاصی برایش تعریف نکرده)، به یک آیکون
 * عمومی «کارگر» برمی‌گردد تا هرگز رندر خالی/شکسته رخ ندهد.
 */
export function JobTypeIcon({ iconKey, ...props }: JobTypeIconProps) {
  const Renderer = JOB_ICON_REGISTRY[iconKey] ?? generalWorker;
  return <Renderer {...props} />;
}
