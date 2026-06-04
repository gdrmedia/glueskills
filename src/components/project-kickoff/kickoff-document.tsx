"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useKickoffTransition } from "@/lib/project-kickoff/queries";
import { activeSections } from "@/lib/project-kickoff/validation";
import type { Kickoff } from "@/lib/project-kickoff/types";

const STATUS_LABEL: Record<Kickoff["status"], string> = {
  draft: "Draft",
  under_review: "Under review",
  approved: "Approved",
};

/** Format an ISO date string as "M/D/YYYY h:mmam/pm" — run client-side only. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  const mm = String(minutes).padStart(2, "0");
  return `${month}/${day}/${year} ${hours}:${mm}${ampm}`;
}

// ---------------------------------------------------------------------------
// Collapsible block
// ---------------------------------------------------------------------------

interface CollapsibleBlockProps {
  id: string;
  heading: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleBlock({ id, heading, children, defaultOpen = true }: CollapsibleBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="overflow-hidden rounded-2xl bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="font-headline text-lg font-bold">{heading}</h2>
        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Row inside a block: label + value
// ---------------------------------------------------------------------------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="w-full shrink-0 text-sm text-muted-foreground sm:w-48">{label}</dt>
      <dd className="flex-1 text-sm">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KickoffDocument({
  kickoff,
  editorNames,
  isApprover,
}: {
  kickoff: Kickoff;
  editorNames: Record<string, string>;
  isApprover: boolean;
}) {
  const router = useRouter();
  const transition = useKickoffTransition(kickoff.id);

  // Sections that have at least one displayable value
  const allSections = activeSections(kickoff.deliverables);
  const shownSections = allSections.filter((s) => {
    const data = kickoff.sections[String(s.id)];
    if (!data) return false;
    const hasAnswer = s.fields.some(
      (f) => (data.answers[f.key] ?? "").trim() !== ""
    );
    const hasApproval = data.approval !== null;
    const hasNotes = (data.approval_notes ?? "").trim() !== "";
    return hasAnswer || hasApproval || hasNotes;
  });

  // Nav items: deliverable + shown sections
  const navItems = [
    { id: "doc-deliverable", label: "Deliverable" },
    ...shownSections.map((s) => ({ id: `doc-section-${s.id}`, label: s.title })),
  ];

  // Scroll-spy: track which block is most visible at the top
  const [activeId, setActiveId] = useState<string>("doc-deliverable");
  const blockIds = navItems.map((n) => n.id);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const visible = new Map<string, number>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.intersectionRatio);
        }
        // Pick the topmost element that is (at least partly) visible
        let best: string | null = null;
        let bestTop = Infinity;
        for (const id of blockIds) {
          if ((visible.get(id) ?? 0) > 0) {
            const el = document.getElementById(id);
            if (el) {
              const top = el.getBoundingClientRect().top;
              if (top < bestTop) {
                bestTop = top;
                best = id;
              }
            }
          }
        }
        if (best) setActiveId(best);
      },
      { threshold: [0, 0.1, 0.5, 1.0] }
    );

    for (const id of blockIds) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownSections.map((s) => s.id).join(",")]);

  // Transition handler
  async function doTransition(action: "approve" | "reopen") {
    try {
      await transition.mutateAsync(action);
      toast.success(action === "approve" ? "Approved" : "Reopened for editing");
      router.refresh();
    } catch (e) {
      const err = e as { status?: number };
      if (err.status === 403) {
        toast.error("You don't have permission for that");
      } else {
        toast.error("Something went wrong");
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-2xl font-extrabold tracking-tight">
            {kickoff.title}
          </h1>
          <Badge variant="secondary">{STATUS_LABEL[kickoff.status]}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {kickoff.status === "under_review" && (
            <Button
              variant="outline"
              onClick={() => doTransition("reopen")}
              disabled={transition.isPending}
            >
              Reopen / unlock
            </Button>
          )}
          {kickoff.status === "under_review" && isApprover && (
            <Button
              onClick={() => doTransition("approve")}
              disabled={transition.isPending}
            >
              Approve
            </Button>
          )}
          {kickoff.status === "approved" && isApprover && (
            <Button
              variant="outline"
              onClick={() => doTransition("reopen")}
              disabled={transition.isPending}
            >
              Reopen
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/strategist/project-kickoff")}
          >
            Back to list
          </Button>
        </div>
      </div>

      {/* Anchor nav — sticky so sections stay reachable while scrolling.
          Full-bleed (-mx cancels main's px) with the items re-inset via the inner
          px, so the solid white bar spans the full width and hides content scrolling
          beneath it. No negative top-margin (that shifted the pinned position and
          overlapped the title); a plain `top-0` pins it flush below the header. */}
      <nav className="sticky top-0 z-20 -mx-6 border-b bg-card md:-mx-8 before:absolute before:inset-x-0 before:bottom-full before:h-8 before:bg-card before:content-['']">
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-6 py-3 md:px-8">
          {navItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  document
                    .getElementById(item.id)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className={[
                  "relative pb-2 text-sm transition-colors",
                  isActive
                    ? "font-semibold text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Blocks */}
      <div className="space-y-6">
        {/* Deliverable block */}
        <CollapsibleBlock id="doc-deliverable" heading="Deliverable">
          <dl className="space-y-3">
            <Row label="Submission Date">
              {kickoff.submitted_at ? (
                <span suppressHydrationWarning>{formatDate(kickoff.submitted_at)}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Row>

            {kickoff.submitted_by && (
              <Row label="Submitted by">
                {editorNames[kickoff.submitted_by] ?? kickoff.submitted_by}
              </Row>
            )}

            {kickoff.status === "approved" && kickoff.approved_at && (
              <Row label="Approved Date">
                <span suppressHydrationWarning>{formatDate(kickoff.approved_at)}</span>
              </Row>
            )}

            {kickoff.status === "approved" && kickoff.approved_by && (
              <Row label="Approved by">
                {editorNames[kickoff.approved_by] ?? kickoff.approved_by}
              </Row>
            )}

            <Row label="Case Study">
              {kickoff.deliverables.case_study ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Row>

            <Row label="Social Posts">
              {kickoff.deliverables.social ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Row>

            <Row label="Award Submission">
              {kickoff.deliverables.award ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Row>
          </dl>
        </CollapsibleBlock>

        {/* Section blocks */}
        {shownSections.map((section) => {
          const data = kickoff.sections[String(section.id)]!;
          return (
            <CollapsibleBlock
              key={section.id}
              id={`doc-section-${section.id}`}
              heading={section.title}
            >
              <dl className="space-y-3">
                {section.fields
                  .filter((f) => (data.answers[f.key] ?? "").trim() !== "")
                  .map((f) => (
                    <Row key={f.key} label={f.label}>
                      <span className="whitespace-pre-wrap">{data.answers[f.key]}</span>
                    </Row>
                  ))}

                {data.approval !== null && (
                  <Row label="Approval">
                    <Badge variant="secondary">
                      {data.approval.charAt(0).toUpperCase() + data.approval.slice(1)}
                    </Badge>
                  </Row>
                )}

                {(data.approval_notes ?? "").trim() !== "" && (
                  <Row label="Approval notes">
                    <span className="whitespace-pre-wrap">{data.approval_notes}</span>
                  </Row>
                )}
              </dl>
            </CollapsibleBlock>
          );
        })}
      </div>
    </div>
  );
}
