export type DeliverableKey = "case_study" | "social" | "award";
export type Deliverables = Record<DeliverableKey, boolean>;

export type KickoffStatus = "draft" | "under_review" | "approved";
export type SectionStatus = "not_started" | "in_progress" | "done";
export type ApprovalValue = "yes" | "no" | "partial" | null;

export type FieldType = "text" | "textarea";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
}

export interface SectionDef {
  id: number; // 1..7
  title: string;
  always: boolean; // §1,2,3,7
  deliverable?: DeliverableKey; // §4,5,6
  fields: FieldDef[];
}

export interface SectionData {
  answers: Record<string, string>;
  approval: ApprovalValue;
  approval_notes: string;
  owner: string | null;
  section_status: SectionStatus;
  last_edited_by: string | null;
  last_edited_at: string | null;
}

export type Sections = Record<string, SectionData>; // keys "1".."7"

export interface Kickoff {
  id: string;
  title: string;
  status: KickoffStatus;
  locked: boolean;
  deliverables: Deliverables;
  sections: Sections;
  created_by: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KickoffSummary {
  id: string;
  title: string;
  status: KickoffStatus;
  deliverables: Deliverables;
  progress: { done: number; total: number };
  updated_at: string;
}
