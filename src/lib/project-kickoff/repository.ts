import type { Kickoff, KickoffSummary } from "./types";

export type ListTab = "drafts" | "under_review" | "approved";

/** Persistence seam. Reimplement this one file to move platforms. */
export interface KickoffRepository {
  list(tab: ListTab): Promise<KickoffSummary[]>;
  get(id: string): Promise<Kickoff | null>;
  create(createdBy: string): Promise<string>; // returns new id
  /** Partial update of the persisted columns. Returns the fresh row. */
  update(id: string, patch: KickoffUpdate): Promise<Kickoff>;
  softDelete(id: string): Promise<void>;
}

export interface KickoffUpdate {
  title?: string;
  status?: Kickoff["status"];
  locked?: boolean;
  deliverables?: Kickoff["deliverables"];
  sections?: Kickoff["sections"];
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
}
