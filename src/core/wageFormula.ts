/**
 * موتور فرمول دستمزد — قلب سیستم محاسبهٔ دستمزد سفارشی.
 *
 * چرا یک AST ساختاریافته به‌جای eval/Function روی یک رشتهٔ فرمول؟
 * ۱) امنیت: فرمول‌ها را کاربر تعریف می‌کند و در دیتابیس محلی ذخیره می‌شوند؛
 *    even در یک اپ کاملاً آفلاین، اجرای رشتهٔ دلخواه به‌عنوان کد جاوااسکریپت
 *    یک عادت بد است که بهتر است از همان اول رعایت نشود.
 * ۲) توضیح‌پذیری: نیاز واقعی «مشاهده نحوهٔ محاسبه» (دکمهٔ توضیح گام‌به‌گام)
 *    فقط با یک ساختار قابل پیمایش (نه یک رشتهٔ مبهم) به‌درستی قابل پیاده‌سازی
 *    است — هر گره از درخت می‌تواند مقدار میانی خودش را هم گزارش کند.
 * ۳) اعتبارسنجی: یک AST را می‌توان قبل از اجرا کامل بررسی کرد (مثلاً تقسیم
 *    بر صفر، متغیر تعریف‌نشده)، برخلاف یک رشته که فقط هنگام اجرا خطا می‌دهد.
 */

// --- گره‌های درخت فرمول ---

export type WageFormulaNode =
  | { kind: "variable"; variableKey: string }
  | { kind: "constant"; value: number }
  | { kind: "binary"; operator: "+" | "-" | "*" | "/"; left: WageFormulaNode; right: WageFormulaNode }
  /** کسر مستقیم یک مقدار از یک متغیر پایه — برای حالت‌های «منهای پرت/خرابی» که در UI به‌صورت جدا از فرمول اصلی وارد می‌شوند. */
  | { kind: "deduction"; base: WageFormulaNode; amount: WageFormulaNode };

export interface WageVariableDefinition {
  key: string;
  label: string;
  /** واحد نمایشی (مثلاً «متر»، «عدد»، «ساعت»)؛ فقط برای نمایش، در محاسبه اثر ندارد. */
  unit: string;
  /** مقدار پیش‌فرض وقتی کاربر چیزی وارد نکرده (معمولاً ۰). */
  defaultValue: number;
}

export interface WageFormulaDefinition {
  id: string;
  name: string;
  /** توضیح متنی ساده برای کاربر (نه فرمول ریاضی) — برای نمایش کنار دکمهٔ «مشاهده نحوه محاسبه». */
  description: string;
  variables: WageVariableDefinition[];
  root: WageFormulaNode;
}

// --- ارزیابی فرمول ---

export interface WageFormulaEvaluationStep {
  label: string;
  value: number;
}

export interface WageFormulaEvaluationResult {
  value: number;
  /** ردپای گام‌به‌گام محاسبه، به ترتیب اجرا — برای رندر مستقیم در «مشاهده نحوه محاسبه». */
  steps: WageFormulaEvaluationStep[];
  /** اگر خطایی رخ داد (مثلاً تقسیم بر صفر یا متغیر تعریف‌نشده)، این‌جا قرار می‌گیرد و value برابر ۰ خواهد بود. */
  error: string | null;
}

function formatOperand(node: WageFormulaNode, labels: Record<string, string>): string {
  if (node.kind === "constant") return String(node.value);
  if (node.kind === "variable") return labels[node.variableKey] ?? node.variableKey;
  return "(...)";
}

/**
 * ارزیابی یک گرهٔ فرمول با ردیابی گام‌به‌گام. چون فرمول‌ها می‌توانند تودرتو
 * باشند، این تابع بازگشتی (recursive) است؛ هر بار ارزیابی یک زیردرخت، یک
 * گام قابل‌فهم به لیست steps اضافه می‌کند تا کاربر بتواند دقیقاً دنبال کند
 * محاسبه چگونه پیش رفته، نه فقط عدد نهایی را ببیند.
 */
function evaluateNode(
  node: WageFormulaNode,
  variables: Record<string, number>,
  variableLabels: Record<string, string>,
  steps: WageFormulaEvaluationStep[]
): number {
  switch (node.kind) {
    case "constant":
      return node.value;

    case "variable": {
      const value = variables[node.variableKey];
      if (value === undefined) {
        throw new Error(`متغیر «${node.variableKey}» مقداردهی نشده است.`);
      }
      return value;
    }

    case "binary": {
      const leftValue = evaluateNode(node.left, variables, variableLabels, steps);
      const rightValue = evaluateNode(node.right, variables, variableLabels, steps);
      let result: number;
      const opSymbol = { "+": "+", "-": "−", "*": "×", "/": "÷" }[node.operator];

      switch (node.operator) {
        case "+":
          result = leftValue + rightValue;
          break;
        case "-":
          result = leftValue - rightValue;
          break;
        case "*":
          result = leftValue * rightValue;
          break;
        case "/":
          if (rightValue === 0) {
            throw new Error("تقسیم بر صفر در فرمول رخ داده است.");
          }
          result = leftValue / rightValue;
          break;
      }

      const leftLabel = formatOperand(node.left, variableLabels);
      const rightLabel = formatOperand(node.right, variableLabels);
      steps.push({
        label: `${leftLabel} (${formatNumber(leftValue)}) ${opSymbol} ${rightLabel} (${formatNumber(rightValue)})`,
        value: result,
      });
      return result;
    }

    case "deduction": {
      const baseValue = evaluateNode(node.base, variables, variableLabels, steps);
      const amountValue = evaluateNode(node.amount, variables, variableLabels, steps);
      const result = Math.max(0, baseValue - amountValue);
      const baseLabel = formatOperand(node.base, variableLabels);
      const amountLabel = formatOperand(node.amount, variableLabels);
      steps.push({
        label: `${baseLabel} (${formatNumber(baseValue)}) منهای کسر ${amountLabel} (${formatNumber(amountValue)})`,
        value: result,
      });
      return result;
    }
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * ارزیابی کامل یک فرمول دستمزد با مقادیر واقعی متغیرها. هرگز throw نمی‌کند —
 * خطاها در فیلد error برگردانده می‌شوند تا UI بتواند بدون try/catch جداگانه
 * پیام مناسب نشان دهد (مهم است، چون این تابع معمولاً داخل رندر یا محاسبات
 * دسته‌جمعی گزارش‌ها صدا زده می‌شود، جایی که throw کردن باعث خراب شدن کل
 * رندر می‌شود).
 */
export function evaluateWageFormula(
  formula: WageFormulaDefinition,
  variableValues: Record<string, number>
): WageFormulaEvaluationResult {
  const steps: WageFormulaEvaluationStep[] = [];
  const variableLabels = Object.fromEntries(formula.variables.map((v) => [v.key, v.label]));

  // مقداردهی نهایی: برای متغیرهایی که کاربر مقداری وارد نکرده، از defaultValue
  // خودِ تعریف متغیر استفاده می‌شود (نه صفر ثابت)، چون هر متغیر می‌تواند
  // پیش‌فرض معناداری داشته باشد.
  const resolvedValues: Record<string, number> = {};
  for (const v of formula.variables) {
    resolvedValues[v.key] = variableValues[v.key] ?? v.defaultValue;
  }

  // مقادیر متغیرها (متراژ، تعداد، ساعت و مشابه) از نظر فیزیکی/کسب‌وکاری
  // هرگز نباید منفی باشند. بدون این بررسی، یک عدد منفی وارد‌شدهٔ اشتباه
  // (مثلاً فشردن ناخواستهٔ علامت منها روی کیبورد موبایل) بی‌سروصدا وارد
  // فرمول می‌شد و می‌توانست دستمزدی منفی یا نامعقول تولید و در تاریخچهٔ
  // محاسبات ثبت کند. این بررسی قبل از اجرای درخت فرمول انجام می‌شود تا هم
  // preview و هم calculateAndSave (که هر دو از همین تابع عبور می‌کنند)
  // یکسان محافظت شوند.
  for (const v of formula.variables) {
    if (resolvedValues[v.key] < 0) {
      return {
        value: 0,
        steps,
        error: `مقدار «${v.label}» نمی‌تواند منفی باشد.`,
      };
    }
  }

  try {
    const value = evaluateNode(formula.root, resolvedValues, variableLabels, steps);
    return { value: Math.round(value), steps, error: null };
  } catch (err) {
    return { value: 0, steps, error: err instanceof Error ? err.message : "خطای نامشخص در محاسبه فرمول." };
  }
}

/**
 * بررسی اعتبار یک فرمول قبل از ذخیره — گشتن در تمام درخت و اطمینان از این‌که
 * هر متغیر استفاده‌شده واقعاً در فهرست variables تعریف شده است. جلوی ذخیرهٔ
 * یک فرمول خراب را از همان لحظهٔ ساخت می‌گیرد، نه اولین بار که کسی سعی کند
 * حقوق را با آن محاسبه کند.
 */
export function validateWageFormula(formula: WageFormulaDefinition): string[] {
  const errors: string[] = [];
  const definedKeys = new Set(formula.variables.map((v) => v.key));

  function walk(node: WageFormulaNode) {
    if (node.kind === "variable") {
      if (!definedKeys.has(node.variableKey)) {
        errors.push(`متغیر «${node.variableKey}» در فرمول استفاده شده ولی تعریف نشده است.`);
      }
    } else if (node.kind === "binary") {
      walk(node.left);
      walk(node.right);
    } else if (node.kind === "deduction") {
      walk(node.base);
      walk(node.amount);
    }
  }

  walk(formula.root);

  if (formula.variables.length === 0) {
    errors.push("فرمول باید حداقل یک متغیر داشته باشد.");
  }
  if (!formula.name.trim()) {
    errors.push("نام روش محاسبه الزامی است.");
  }

  return errors;
}

/**
 * تبدیل درخت فرمول به یک رشتهٔ خوانا برای انسان (نه اجرا، فقط نمایش) — برای
 * نمایش «فرمول» در کنار توضیح متنی ساده. مثلاً «(طول − پرت) × نرخ».
 */
export function formatWageFormula(node: WageFormulaNode, variableLabels: Record<string, string>): string {
  switch (node.kind) {
    case "constant":
      return formatNumber(node.value);
    case "variable":
      return variableLabels[node.variableKey] ?? node.variableKey;
    case "binary": {
      const opSymbol = { "+": "+", "-": "−", "*": "×", "/": "÷" }[node.operator];
      const left = formatWageFormula(node.left, variableLabels);
      const right = formatWageFormula(node.right, variableLabels);
      // پرانتز فقط دور عملیات جمع/تفریق تودرتو گذاشته می‌شود تا خوانایی حفظ
      // شود، بدون این‌که فرمول‌های ساده با پرانتزهای غیرضروری شلوغ شوند.
      const needsParens = node.operator === "*" || node.operator === "/";
      const wrapIfBinary = (n: WageFormulaNode, s: string) =>
        needsParens && n.kind === "binary" && (n.operator === "+" || n.operator === "-") ? `(${s})` : s;
      return `${wrapIfBinary(node.left, left)} ${opSymbol} ${wrapIfBinary(node.right, right)}`;
    }
    case "deduction": {
      const base = formatWageFormula(node.base, variableLabels);
      const amount = formatWageFormula(node.amount, variableLabels);
      return `(${base} − ${amount})`;
    }
  }
}

// --- سازنده‌های کمکی برای ساخت سریع فرمول در کد (Seed دیتای ۵۰ شغل) ---

export const wf = {
  v: (key: string): WageFormulaNode => ({ kind: "variable", variableKey: key }),
  c: (value: number): WageFormulaNode => ({ kind: "constant", value }),
  add: (left: WageFormulaNode, right: WageFormulaNode): WageFormulaNode => ({ kind: "binary", operator: "+", left, right }),
  sub: (left: WageFormulaNode, right: WageFormulaNode): WageFormulaNode => ({ kind: "binary", operator: "-", left, right }),
  mul: (left: WageFormulaNode, right: WageFormulaNode): WageFormulaNode => ({ kind: "binary", operator: "*", left, right }),
  div: (left: WageFormulaNode, right: WageFormulaNode): WageFormulaNode => ({ kind: "binary", operator: "/", left, right }),
  deduct: (base: WageFormulaNode, amount: WageFormulaNode): WageFormulaNode => ({ kind: "deduction", base, amount }),
};
