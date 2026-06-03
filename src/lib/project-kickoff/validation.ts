import { KICKOFF_FORM } from "./form-schema";
import type { Deliverables, Sections, SectionDef } from "./types";

export interface MissingField { section: number; key: string; label: string; }

export function activeSections(deliverables: Deliverables): SectionDef[] {
  return KICKOFF_FORM.filter(
    (s) => s.always || (s.deliverable ? deliverables[s.deliverable] : false)
  );
}

export function missingRequired(deliverables: Deliverables, sections: Sections): MissingField[] {
  const out: MissingField[] = [];
  for (const sec of activeSections(deliverables)) {
    const data = sections[String(sec.id)];
    for (const f of sec.fields) {
      if (!f.required) continue;
      const val = (data?.answers?.[f.key] ?? "").trim();
      if (!val) out.push({ section: sec.id, key: f.key, label: f.label });
    }
  }
  return out;
}

export function isSubmittable(deliverables: Deliverables, sections: Sections): boolean {
  return missingRequired(deliverables, sections).length === 0;
}

export function progressOf(deliverables: Deliverables, sections: Sections): { done: number; total: number } {
  const active = activeSections(deliverables);
  const done = active.filter((s) => sections[String(s.id)]?.section_status === "done").length;
  return { done, total: active.length };
}
