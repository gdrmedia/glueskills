"use client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { FieldDef } from "@/lib/project-kickoff/types";

interface Props {
  field: FieldDef;
  value: string;
  readOnly: boolean;
  missing?: boolean;
  onChange: (value: string) => void;
}

export function FieldInput({ field, value, readOnly, missing, onChange }: Props) {
  const id = `ck-${field.key}`;
  const ring = missing ? "ring-2 ring-rose-400" : "";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {field.label}{field.required && <span className="ml-1 text-rose-500">*</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea id={id} value={value} disabled={readOnly} className={ring}
          onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <Input id={id} value={value} disabled={readOnly} className={ring}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
