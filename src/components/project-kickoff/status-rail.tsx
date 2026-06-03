"use client";
import type { SectionDef, Sections, SectionStatus } from "@/lib/project-kickoff/types";

const DOT: Record<SectionStatus, string> = {
  done: "bg-emerald-500",
  in_progress: "bg-amber-500",
  not_started: "bg-muted-foreground/30",
};

interface Props {
  sections: SectionDef[];
  data: Sections;
  activeId: number;
  onJump: (id: number) => void;
}

export function StatusRail({ sections, data, activeId, onJump }: Props) {
  return (
    <nav className="space-y-1">
      {sections.map((s) => {
        const sd = data[String(s.id)];
        const status = sd?.section_status ?? "not_started";
        return (
          <button key={s.id} type="button" onClick={() => onJump(s.id)}
            aria-current={activeId === s.id ? "true" : undefined}
            className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              activeId === s.id ? "bg-accent" : "hover:bg-accent/50"
            }`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[status]}`} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{s.id}. {s.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {status.replace("_", " ")}{sd?.owner ? ` · ${sd.owner}` : ""}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
