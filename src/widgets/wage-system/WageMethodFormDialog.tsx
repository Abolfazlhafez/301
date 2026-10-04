import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { wageMethodApi } from "../../shared/api/wageMethodApi";
import { randomUUID } from "../../core/utils/uuid";
import type { WageFormulaNode, WageVariableDefinition } from "../../core/wageFormula";
import type { WageMethod } from "../../entities/JobType";
import { useToast } from "../../shared/components/ToastProvider";
import { extractErrorMessage } from "../../shared/api/client";
import { FormulaBuilder } from "./FormulaBuilder";

interface WageMethodFormDialogProps {
  open: boolean;
  existing?: WageMethod | null;
  onClose: () => void;
}

/**
 * دیالوگ ساخت/ویرایش یک روش محاسبهٔ دستمزد کامل: نام، توضیح، فهرست متغیرها
 * (که کاربر خودش می‌سازد — طبق نیاز «امکان تعریف متغیر سفارشی»)، و
 * سازندهٔ فرمول برای ترکیب آن متغیرها.
 */
export function WageMethodFormDialog({ open, existing, onClose }: WageMethodFormDialogProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [variables, setVariables] = useState<WageVariableDefinition[]>([]);
  const [root, setRoot] = useState<WageFormulaNode>({ kind: "constant", value: 0 });
  const [formulaValid, setFormulaValid] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(existing?.formula.name ?? "");
    setDescription(existing?.formula.description ?? "");
    setVariables(existing?.formula.variables ?? [{ key: "value", label: "مقدار", unit: "", defaultValue: 0 }]);
  }, [open, existing]);

  function addVariable() {
    setVariables((prev) => [...prev, { key: `var${prev.length + 1}`, label: "", unit: "", defaultValue: 0 }]);
  }

  function removeVariable(index: number) {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVariable(index: number, patch: Partial<WageVariableDefinition>) {
    setVariables((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  const mutation = useMutation({
    mutationFn: () => {
      const formula = {
        id: existing?.formula.id ?? randomUUID(),
        name: name.trim(),
        description: description.trim(),
        variables,
        root,
      };
      return existing ? wageMethodApi.update(existing.id, { formula }) : wageMethodApi.create({ formula });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wage-methods"] });
      showToast(existing ? "روش محاسبه به‌روزرسانی شد." : "روش محاسبهٔ جدید ثبت شد.", "success");
      onClose();
    },
    onError: (err) => showToast(extractErrorMessage(err), "error"),
  });

  const variablesValid = variables.length > 0 && variables.every((v) => v.key.trim() && v.label.trim());
  const canSubmit = !!name.trim() && variablesValid && formulaValid;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" fontWeight={700}>
          {existing ? "ویرایش روش محاسبه" : "افزودن روش محاسبهٔ جدید"}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="بستن">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} mt={0.5}>
          <TextField label="نام روش" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: متراژ منهای پرت" />
          <TextField
            label="توضیح"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
            placeholder="توضیح ساده دربارهٔ این‌که این روش چطور دستمزد را حساب می‌کند."
          />

          <Divider />

          <Box>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>
              متغیرها
            </Typography>
            <Stack spacing={1}>
              {variables.map((v, index) => (
                <Stack key={index} direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    label="نام متغیر"
                    value={v.label}
                    onChange={(e) => updateVariable(index, { label: e.target.value })}
                    sx={{ flex: 2 }}
                  />
                  <TextField
                    size="small"
                    label="واحد"
                    value={v.unit}
                    onChange={(e) => updateVariable(index, { unit: e.target.value })}
                    placeholder="متر، عدد..."
                    sx={{ flex: 1 }}
                  />
                  <IconButton size="small" onClick={() => removeVariable(index)} disabled={variables.length <= 1}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            <Button size="small" startIcon={<AddIcon />} onClick={addVariable} sx={{ mt: 1 }}>
              افزودن متغیر
            </Button>
          </Box>

          <Divider />

          {variablesValid ? (
            <FormulaBuilder
              variables={variables.map((v, i) => ({ ...v, key: v.key || `var${i}` }))}
              initialRoot={existing?.formula.root}
              onChange={(newRoot, isValid) => {
                setRoot(newRoot);
                setFormulaValid(isValid);
              }}
            />
          ) : (
            <Typography variant="caption" color="text.secondary">
              ابتدا برای همهٔ متغیرها نام وارد کنید تا بتوانید فرمول بسازید.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          انصراف
        </Button>
        <Button onClick={() => mutation.mutate()} variant="contained" disabled={mutation.isPending || !canSubmit}>
          {mutation.isPending ? "در حال ذخیره..." : "ذخیره"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
