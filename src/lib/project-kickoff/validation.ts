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

/** A section is complete when all its required fields are filled (or, if it has
 *  no required fields, when all its fields are filled). Mirrors the editor's
 *  per-section ring so the list and editor agree on what "done" means. */
export function sectionComplete(section: SectionDef, sections: Sections): boolean {
  const answers = sections[String(section.id)]?.answers ?? {};
  const required = section.fields.filter((f) => f.required);
  const pool = required.length ? required : section.fields;
  return pool.every((f) => (answers[f.key] ?? "").trim().length > 0);
}

export function progressOf(deliverables: Deliverables, sections: Sections): { done: number; total: number } {
  const active = activeSections(deliverables);
  const done = active.filter((s) => sectionComplete(s, sections)).length;
  return { done, total: active.length };
}
