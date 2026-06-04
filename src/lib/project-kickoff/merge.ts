import type { Sections, SectionData, ApprovalValue, SectionStatus } from "./types";

export interface SectionPatch {
  answers?: Record<string, string>;
  approval?: ApprovalValue;
  approval_notes?: string;
  owner?: string | null;
  section_status?: SectionStatus;
}

export function emptySectionData(): SectionData {
  return {
    answers: {},
    approval: null,
    approval_notes: "",
    owner: null,
    section_status: "not_started",
    last_edited_by: null,
    last_edited_at: null,
  };
}

export function allEmptySections(): Sections {
  const s: Sections = {};
  for (const id of [1, 2, 3, 4, 5, 6, 7]) s[String(id)] = emptySectionData();
  return s;
}

export function mergeSection(
  sections: Sections,
  sectionId: number,
  patch: SectionPatch,
  editor: string,
  nowIso: string
): Sections {
  const key = String(sectionId);
  const prev = sections[key] ?? emptySectionData();
  const next: SectionData = {
    ...prev,
    ...(patch.approval !== undefined ? { approval: patch.approval } : {}),
    ...(patch.approval_notes !== undefined ? { approval_notes: patch.approval_notes } : {}),
    ...(patch.owner !== undefined ? { owner: patch.owner } : {}),
    ...(patch.section_status !== undefined ? { section_status: patch.section_status } : {}),
    answers: patch.answers ? { ...prev.answers, ...patch.answers } : prev.answers,
    last_edited_by: editor,
    last_edited_at: nowIso,
  };
  return { ...sections, [key]: next };
}
