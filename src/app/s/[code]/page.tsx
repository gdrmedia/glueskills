import { notFound } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { SpecViewer } from "@/components/spec-sheet-reviewer/viewer/spec-viewer";
import type { EnrichedPlacement, Partner, Summary } from "@/lib/spec-sheets/enrich";

type SheetRow = {
  code: string;
  campaign: string;
  client: string | null;
  placements: EnrichedPlacement[];
  partners: Partner[];
  summary: Summary;
  createdAt: string;
};

async function fetchSheet(code: string): Promise<SheetRow | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("get_spec_sheet", { sheet_code: code });
  if (error) {
    console.error("get_spec_sheet failed:", error);
    return null;
  }
  return (data as SheetRow | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sheet = await fetchSheet(code);
  if (!sheet) return { title: "Spec Sheet Not Found" };
  return { title: `${sheet.campaign} — Spec Sheet` };
}

export default async function SharedViewerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sheet = await fetchSheet(code);
  if (!sheet) notFound();

  return (
    <SpecViewer
      placements={sheet.placements}
      partners={sheet.partners}
      summary={sheet.summary}
    />
  );
}
