import { KICKOFF_FORM } from "./form-schema";
import type { Deliverables, DeliverableKey, SectionDef } from "./types";

export type DeliverableSection = Extract<SectionDef, { always: false }>;

function isDeliverableSection(s: SectionDef): s is DeliverableSection {
  return !s.always;
}

export interface NavRow {
  section: SectionDef;
  number: number;
}

export interface NavDeliverable {
  section: DeliverableSection;
  key: DeliverableKey;
  active: boolean;
  number: number | null;
}

export interface NavLayout {
  lead: NavRow[];
  deliverables: NavDeliverable[];
  tail: NavRow[];
  activeOn: number;    // count of active deliverables
  total: number;       // total deliverables (3)
  activeTotal: number; // count of all active sections (for "Section n / N")
}

/**
 * Structural layout for the editor's section nav: the always-sections that lead
 * the brief, the three deliverable sections (active or not), and the always-
 * sections that trail it. Numbers are 1-based across *active* sections in
 * document order; inactive deliverables carry `number: null` (they render the
 * "+" add affordance). Purely structural — knows nothing about answers/progress.
 */
export function navLayout(deliverables: Deliverables): NavLayout {
  const firstDelIdx = KICKOFF_FORM.findIndex(isDeliverableSection);
  const leadSecs = KICKOFF_FORM.slice(0, firstDelIdx);
  const tailSecs = KICKOFF_FORM.slice(firstDelIdx).filter((s) => s.always);
  const delSecs = KICKOFF_FORM.filter(isDeliverableSection);

  let n = 0;
  const lead: NavRow[] = leadSecs.map((section) => ({ section, number: ++n }));
  const deliverablesOut: NavDeliverable[] = delSecs.map((section) => {
    const active = !!deliverables[section.deliverable];
    return { section, key: section.deliverable, active, number: active ? ++n : null };
  });
  const tail: NavRow[] = tailSecs.map((section) => ({ section, number: ++n }));

  const activeOn = deliverablesOut.filter((d) => d.active).length;
  return {
    lead,
    deliverables: deliverablesOut,
    tail,
    activeOn,
    total: delSecs.length,
    activeTotal: lead.length + activeOn + tail.length,
  };
}
