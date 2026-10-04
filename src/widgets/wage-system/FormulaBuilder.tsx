import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { WageFormulaNode, WageVariableDefinition } from "../../core/wageFormula";
import { formatWageFormula, wf } from "../../core/wageFormula";

/**
 * یک گام در زنجیرهٔ فرمول: یک عملوند (متغیر یا عدد ثابت) به‌همراه عملگری که
 * آن را به گام بعدی وصل می‌کند. گام اول عملگر ندارد (چون چیزی قبلش نیست).
 * این نمایش «زنجیره‌ای» (نه یک درخت تودرتوی دلخواه) عمداً انتخاب شده چون:
 * ۱) تقریباً همهٔ مثال‌های واقعی کاربر (طول×ارتفاع×نرخ، متراژ×نرخ×ضریب) از
 *    چپ‌به‌راست بدون پرانتزبندی پیچیده هستند.
 * ۲) UI یک زنجیره برای کاربر غیرفنی به‌مراتب قابل‌فهم‌تر از یک سازندهٔ درخت
 *    دلخواه با پرانتز تودرتوست، بدون این‌که قدرت واقعی را از دست بدهد —
 *    چون عملگرهای ضرب/تقسیم و جمع/تفریق با اولویت ریاضی معمول (نه فقط
 *    چپ‌به‌راست خام) به درخت تبدیل می‌شوند.
 */
interface FormulaStep {
  id: string;
  operandType: "variable" | "constant";
  variableKey: string;
  constantValue: string;
  operator: "+" | "-" | "*" | "/" | null; // null فقط برای اولین گام
}

interface DeductionConfig {
  enabled: boolean;
  baseVariableKey: string;
  amountVariableKey: string;
}

interface FormulaBuilderProps {
  variables: WageVariableDefinition[];
  initialRoot?: WageFormulaNode | null;
  onChange: (root: WageFormulaNode, isValid: boolean) => void;
}

let stepIdCounter = 0;
function newStepId() {
  stepIdCounter += 1;
  return `step-${stepIdCounter}`;
}

const OPERATOR_LABELS: Record<"+" | "-" | "*" | "/", string> = { "+": "+ جمع", "-": "− تفریق", "*": "× ضرب", "/": "÷ تقسیم" };

/**
 * تبدیل زنجیرهٔ گام‌ها به درخت WageFormulaNode، با رعایت اولویت معمول
 * ریاضی (ضرب/تقسیم قبل از جمع/تفریق) — نه فقط ارزیابی خام چپ‌به‌راست. این
 * یعنی «طول + عرض × نرخ» طبق قوانین معمول ریاضی محاسبه می‌شود، نه به‌ترتیب
 * نوشتن.
 */
function stepsToTree(steps: FormulaStep[]): WageFormulaNode | null {
  if (steps.length === 0) return null;

  function operandNode(step: FormulaStep): WageFormulaNode {
    return step.operandType === "variable" ? wf.v(step.variableKey) : wf.c(Number(step.constantValue) || 0);
  }

  // پاس اول: گروه‌بندی ضرب/تقسیم (اولویت بالاتر) به زیردرخت‌های محلی.
  const groups: { node: WageFormulaNode; operatorBefore: "+" | "-" | null }[] = [];
  let currentNode = operandNode(steps[0]);
  let pendingOperatorBefore: "+" | "-" | null = null;

  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    const op = step.operator;
    if (op === "*" || op === "/") {
      currentNode = op === "*" ? wf.mul(currentNode, operandNode(step)) : wf.div(currentNode, operandNode(step));
    } else {
      groups.push({ node: currentNode, operatorBefore: pendingOperatorBefore });
      currentNode = operandNode(step);
      pendingOperatorBefore = op;
    }
  }
  groups.push({ node: currentNode, operatorBefore: pendingOperatorBefore });

  // پاس دوم: ترکیب گروه‌ها با جمع/تفریق، به ترتیب چپ‌به‌راست.
  let result = groups[0].node;
  for (let i = 1; i < groups.length; i++) {
    const g = groups[i];
    result = g.operatorBefore === "-" ? wf.sub(result, g.node) : wf.add(result, g.node);
  }
  return result;
}

export function FormulaBuilder({ variables, initialRoot, onChange }: FormulaBuilderProps) {
  const [steps, setSteps] = useState<FormulaStep[]>([
    { id: newStepId(), operandType: "variable", variableKey: variables[0]?.key ?? "", constantValue: "0", operator: null },
  ]);
  const [deduction, setDeduction] = useState<DeductionConfig>({
    enabled: false,
    baseVariableKey: variables[0]?.key ?? "",
    amountVariableKey: variables[1]?.key ?? variables[0]?.key ?? "",
  });

  // بازسازی گام‌ها از یک درخت موجود، فقط در بار اول (وقتی initialRoot از
  // بیرون داده شده، مثلاً ویرایش یک روش محاسبهٔ موجود). چون خودِ این سازنده
  // فقط زنجیره‌های ساده (با اولویت معمول ضرب/تقسیم قبل از جمع/تفریق، با یا
  // بدون یک کسر پیشرو) تولید می‌کند، پیمایش معکوس هم فقط همین شکل‌ها را
  // می‌شناسد — این یعنی هر فرمولی که از طریق همین سازنده یا داده‌های
  // seed برنامه ساخته شده، دقیقاً بازسازی می‌شود. اگر درختی کاملاً خارج از
  // این الگو باشد (که در عمل فقط برای فرمول‌های دستی/برنامه‌نویسی‌شده رخ
  // می‌دهد)، کاربر با یک زنجیرهٔ خالی شروع می‌کند و خودش دوباره می‌سازد —
  // ترجیح داده شد به این‌که با یک بازسازی نادرست/گمراه‌کننده کاربر را
  // اشتباه بیندازد.
  useEffect(() => {
    if (!initialRoot) return;

    let workingRoot = initialRoot;
    let detectedDeduction: DeductionConfig | null = null;

    if (workingRoot.kind === "deduction" && workingRoot.base.kind === "variable" && workingRoot.amount.kind === "variable") {
      detectedDeduction = { enabled: true, baseVariableKey: workingRoot.base.variableKey, amountVariableKey: workingRoot.amount.variableKey };
      // فرمول اصلی، خودِ گرهٔ کسر است (بدون ادامهٔ زنجیره)؛ برای بازسازی
      // زنجیره، جای کسر را با متغیر پایه‌اش پر می‌کنیم تا پیمایش زیر عادی ادامه یابد.
      workingRoot = { kind: "variable", variableKey: workingRoot.base.variableKey };
    } else {
      // دنبال یک کسر در عمیق‌ترین شاخهٔ چپ می‌گردیم (شکل رایج «(پایه−کسر) × نرخ»).
      const findDeductionInLeftSpine = (node: WageFormulaNode): WageFormulaNode => {
        if (node.kind === "binary" && node.left.kind === "deduction") {
          const d = node.left;
          if (d.base.kind === "variable" && d.amount.kind === "variable") {
            detectedDeduction = { enabled: true, baseVariableKey: d.base.variableKey, amountVariableKey: d.amount.variableKey };
            return { ...node, left: { kind: "variable", variableKey: d.base.variableKey } };
          }
        }
        if (node.kind === "binary") {
          return { ...node, left: findDeductionInLeftSpine(node.left) };
        }
        return node;
      };
      workingRoot = findDeductionInLeftSpine(workingRoot);
    }

    // پیمایش یک زنجیرهٔ خالص binary (بدون deduction باقی‌مانده) به لیست گام‌ها.
    const collected: { operand: WageFormulaNode; operator: "+" | "-" | "*" | "/" }[] = [];
    let cursor = workingRoot;
    let isChain = true;
    while (cursor.kind === "binary") {
      collected.unshift({ operand: cursor.right, operator: cursor.operator });
      cursor = cursor.left;
    }
    if (cursor.kind !== "variable" && cursor.kind !== "constant") {
      isChain = false;
    }

    if (isChain) {
      const firstStep: FormulaStep = {
        id: newStepId(),
        operandType: cursor.kind === "variable" ? "variable" : "constant",
        variableKey: cursor.kind === "variable" ? cursor.variableKey : "",
        constantValue: cursor.kind === "constant" ? String(cursor.value) : "0",
        operator: null,
      };
      const restSteps: FormulaStep[] = collected.map(({ operand, operator }) => ({
        id: newStepId(),
        operandType: operand.kind === "variable" ? "variable" : "constant",
        variableKey: operand.kind === "variable" ? operand.variableKey : "",
        constantValue: operand.kind === "constant" ? String(operand.value) : "0",
        operator,
      }));
      // اگر یک عملوند خودش binary/deduction باقی‌ماند (یعنی خارج از الگوهای
      // شناخته‌شده بود)، به یک گام قابل‌فهم برنمی‌گردد — در این حالت کل
      // بازسازی را کنار می‌گذاریم.
      const anyUnrecognized = restSteps.some((s) => !s.variableKey && s.operandType === "variable");
      if (!anyUnrecognized) {
        setSteps([firstStep, ...restSteps]);
      }
    }

    if (detectedDeduction) {
      setDeduction(detectedDeduction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let root = stepsToTree(steps);
    if (!root) {
      onChange(wf.c(0), false);
      return;
    }
    if (deduction.enabled && deduction.baseVariableKey && deduction.amountVariableKey) {
      // کسر همیشه به‌عنوان اولین عملیات روی کل زنجیره اعمال می‌شود:
      // (پایه − کسر) سپس نتیجهٔ زنجیره در آن ضرب می‌شود. اگر زنجیره فقط
      // شامل خودِ متغیر پایه بود (رایج‌ترین حالت)، مستقیم جایگزین می‌شود.
      const deductionNode = wf.deduct(wf.v(deduction.baseVariableKey), wf.v(deduction.amountVariableKey));
      root = replaceFirstVariableOccurrence(root, deduction.baseVariableKey, deductionNode);
    }
    const isValid = steps.every((s) => s.operandType === "constant" || !!s.variableKey);
    onChange(root, isValid && variables.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, deduction]);

  function replaceFirstVariableOccurrence(node: WageFormulaNode, key: string, replacement: WageFormulaNode): WageFormulaNode {
    if (node.kind === "variable" && node.variableKey === key) return replacement;
    if (node.kind === "binary") {
      return { ...node, left: replaceFirstVariableOccurrence(node.left, key, replacement), right: node.right };
    }
    return node;
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { id: newStepId(), operandType: "variable", variableKey: variables[0]?.key ?? "", constantValue: "0", operator: "*" },
    ]);
  }

  function removeStep(id: string) {
    setSteps((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length > 0) next[0] = { ...next[0], operator: null };
      return next;
    });
  }

  function updateStep(id: string, patch: Partial<FormulaStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  const variableLabels = Object.fromEntries(variables.map((v) => [v.key, v.label]));
  const previewTree = stepsToTree(steps);
  const previewText = previewTree ? formatWageFormula(previewTree, variableLabels) : "";

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle2" fontWeight={700} mb={1}>
          کسر از مقدار پایه (اختیاری)
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant={deduction.enabled ? "contained" : "outlined"}
            onClick={() => setDeduction((prev) => ({ ...prev, enabled: !prev.enabled }))}
          >
            {deduction.enabled ? "کسر فعال است" : "افزودن کسر"}
          </Button>
          {deduction.enabled && (
            <>
              <Select
                size="small"
                value={deduction.baseVariableKey}
                onChange={(e) => setDeduction((prev) => ({ ...prev, baseVariableKey: e.target.value }))}
                sx={{ minWidth: 130 }}
              >
                {variables.map((v) => (
                  <MenuItem key={v.key} value={v.key}>
                    {v.label}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="body2" color="text.secondary">
                منهای
              </Typography>
              <Select
                size="small"
                value={deduction.amountVariableKey}
                onChange={(e) => setDeduction((prev) => ({ ...prev, amountVariableKey: e.target.value }))}
                sx={{ minWidth: 130 }}
              >
                {variables.map((v) => (
                  <MenuItem key={v.key} value={v.key}>
                    {v.label}
                  </MenuItem>
                ))}
              </Select>
            </>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          مثلاً «طول منهای پرت» یا «تعداد منهای خرابی» — نتیجهٔ این کسر جایگزین اولین استفاده از متغیر پایه در زنجیرهٔ زیر می‌شود.
        </Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2" fontWeight={700} mb={1}>
          زنجیرهٔ محاسبه
        </Typography>
        <Stack spacing={1}>
          {steps.map((step, index) => (
            <Stack key={step.id} direction="row" spacing={1} alignItems="center">
              {index > 0 && step.operator && (
                <Select
                  size="small"
                  value={step.operator}
                  onChange={(e) => updateStep(step.id, { operator: e.target.value as FormulaStep["operator"] })}
                  sx={{ minWidth: 90 }}
                >
                  {(["+", "-", "*", "/"] as const).map((op) => (
                    <MenuItem key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </MenuItem>
                  ))}
                </Select>
              )}
              <Select
                size="small"
                value={step.operandType}
                onChange={(e) => updateStep(step.id, { operandType: e.target.value as "variable" | "constant" })}
                sx={{ minWidth: 90 }}
              >
                <MenuItem value="variable">متغیر</MenuItem>
                <MenuItem value="constant">عدد ثابت</MenuItem>
              </Select>
              {step.operandType === "variable" ? (
                <Select
                  size="small"
                  value={step.variableKey}
                  onChange={(e) => updateStep(step.id, { variableKey: e.target.value })}
                  displayEmpty
                  sx={{ minWidth: 140, flex: 1 }}
                >
                  {variables.length === 0 && (
                    <MenuItem value="" disabled>
                      ابتدا یک متغیر تعریف کنید
                    </MenuItem>
                  )}
                  {variables.map((v) => (
                    <MenuItem key={v.key} value={v.key}>
                      {v.label}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <TextField
                  size="small"
                  type="number"
                  value={step.constantValue}
                  onChange={(e) => updateStep(step.id, { constantValue: e.target.value })}
                  sx={{ minWidth: 100, flex: 1 }}
                />
              )}
              {steps.length > 1 && (
                <IconButton size="small" onClick={() => removeStep(step.id)} aria-label="حذف این گام">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          ))}
        </Stack>
        <Button size="small" startIcon={<AddIcon />} onClick={addStep} sx={{ mt: 1 }} disabled={variables.length === 0}>
          افزودن گام
        </Button>
      </Box>

      {previewText && (
        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            پیش‌نمایش فرمول
          </Typography>
          <Chip label={previewText} sx={{ fontFamily: "monospace", fontSize: "0.85rem" }} />
        </Box>
      )}
    </Stack>
  );
}
