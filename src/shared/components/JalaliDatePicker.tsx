import { MenuItem, Stack, TextField, Typography } from "@mui/material";
import {
  getDate as getDateJalali,
  getDaysInMonth as getDaysInMonthJalali,
  getMonth as getMonthJalali,
  getYear as getYearJalali,
  setDate as setDateJalali,
  setMonth as setMonthJalali,
  setYear as setYearJalali,
} from "date-fns-jalali";
import { useMemo } from "react";
import i18n from "../i18n";
import { getCalendarLocale } from "../i18n/calendarLocales";

interface JalaliDatePickerProps {
  label?: string;
  value: string; // تاریخ میلادی به فرمت YYYY-MM-DD (فرمت ذخیره‌سازی)
  onChange: (isoDate: string) => void;
  size?: "small" | "medium";
}

const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

function isJalaliActive(): boolean {
  return (i18n.language ?? "fa") === "fa";
}

/** آبستراکسیون سبک روی توابع date-fns-jalali/میلادی بومی، تا این کامپوننت
 * بدون شاخه زدن مکرر if/else برای هر عملیات، بین دو تقویم سوییچ کند. */
function getDateParts(date: Date) {
  if (isJalaliActive()) {
    return { year: getYearJalali(date), month: getMonthJalali(date), day: getDateJalali(date), daysInMonth: getDaysInMonthJalali(date) };
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    daysInMonth: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
  };
}

function applyDateParts(base: Date, year: number, month: number, day: number): Date {
  if (isJalaliActive()) {
    let d = new Date(base);
    d = setYearJalali(d, year);
    d = setMonthJalali(d, month);
    const maxDay = getDaysInMonthJalali(d);
    d = setDateJalali(d, Math.min(day, maxDay));
    return d;
  }
  const maxDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, maxDay));
}

/** تبدیل Date به رشتهٔ YYYY-MM-DD بر اساس تاریخ **محلی** (نه UTC؛ toISOString همیشه UTC می‌دهد). */
function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * انتخابگر تاریخ شمسی (جلالی) سبک و کاملاً بومی، بدون وابستگی به کتابخانه‌های سنگین تقویم.
 * مقدار ورودی/خروجی همیشه تاریخ میلادی ISO (YYYY-MM-DD) است تا با بک‌اند سازگار بماند؛
 * تبدیل روز/ماه/سال شمسی <-> میلادی با date-fns-jalali انجام می‌شود.
 */
export function JalaliDatePicker({ label, value, onChange, size = "medium" }: JalaliDatePickerProps) {
  const currentDate = useMemo(() => {
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  }, [value]);

  const { year: jYear, month: jMonth, day: jDay, daysInMonth } = getDateParts(currentDate);
  const monthNames = isJalaliActive() ? JALALI_MONTH_NAMES : getCalendarLocale(i18n.language).months;

  const years = useMemo(() => {
    const base = jYear;
    const list: number[] = [];
    for (let y = base - 5; y <= base + 1; y++) list.push(y);
    return list;
  }, [jYear]);

  function emit(newYear: number, newMonth: number, newDay: number) {
    const d = applyDateParts(currentDate, newYear, newMonth, newDay);
    onChange(toLocalIso(d));
  }

  return (
    <Stack spacing={0.5}>
      {label && (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      )}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TextField
          select
          size={size}
          value={jDay}
          onChange={(e) => emit(jYear, jMonth, Number(e.target.value))}
          sx={{ minWidth: 72 }}
        >
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size={size}
          value={jMonth}
          onChange={(e) => emit(jYear, Number(e.target.value), jDay)}
          sx={{ minWidth: 110, flex: 1 }}
        >
          {monthNames.map((name, idx) => (
            <MenuItem key={name} value={idx}>
              {name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size={size}
          value={jYear}
          onChange={(e) => emit(Number(e.target.value), jMonth, jDay)}
          sx={{ minWidth: 90 }}
        >
          {years.map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </Stack>
  );
}
