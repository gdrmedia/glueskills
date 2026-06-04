"use client";
// ===========================================================================
// Momentum kickoff editor — presentational parts (exploration branch).
// Faithful port of the exported "Momentum" concept: progress rings, pink/orange
// palette, Baloo 2 numerals, soft transitions. Tokens come from the scoped
// `.momentum-kickoff` block in globals.css. Pure UI — all data/handlers stay in
// kickoff-editor.tsx.
// ===========================================================================
import type {
  DeliverableKey,
  FieldDef,
  KickoffUser,
  SectionDef,
} from "@/lib/project-kickoff/types";
import type { NavLayout } from "@/lib/project-kickoff/nav-layout";

/* ----------------------------------------------------------------- icons */
export function Check({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

export function Arrow({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Close({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function Plus({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/* ----------------------------------------------------------------- progress ring */
export function Ring({
  pct, size = 38, stroke = 4, color = "var(--glue-primary)", track = "var(--glue-ink-100)",
}: { pct: number; size?: number; stroke?: number; color?: string; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))}
        style={{ transition: "stroke-dashoffset .5s var(--ease-out)" }} />
    </svg>
  );
}

/* ----------------------------------------------------------------- owner chip */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return ini || "?";
}

export function OwnerControl({
  ownerId, users, editorNames, disabled, onChange,
}: {
  ownerId: string | null;
  users: KickoffUser[];
  editorNames: Record<string, string>;
  disabled: boolean;
  onChange: (v: string | null) => void;
}) {
  const id = ownerId ?? "";
  const inRoster = id === "" || users.some((u) => u.id === id);
  const name = id ? (users.find((u) => u.id === id)?.name ?? editorNames[id] ?? id) : "";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 9, background: "var(--glue-surface-alt)",
      borderRadius: 10, height: 44, padding: "0 14px 0 10px", boxSizing: "border-box",
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        background: id ? "var(--glue-primary)" : "var(--glue-ink-300)", color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
      }}>{id ? initials(name) : "?"}</span>
      <select className="m-select-bare" value={id} disabled={disabled} aria-label="Section owner"
        onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Unassigned</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        {!inRoster && <option value={id}>{editorNames[id] ?? id}</option>}
      </select>
    </div>
  );
}

/* ----------------------------------------------------------------- field */
function CheckBadge({ color = "var(--glue-primary)" }: { color?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20,
      borderRadius: "50%", background: color, color: "#fff", animation: "gs-pop .35s var(--ease-out)",
    }}>
      <Check size={12} />
    </span>
  );
}

export function MField({
  field, value, readOnly, missing, onChange,
}: {
  field: FieldDef;
  value: string;
  readOnly: boolean;
  missing: boolean;
  onChange: (v: string) => void;
}) {
  const filled = (value ?? "").trim().length > 0;
  const id = `ck-${field.key}`;
  const cls = `m-input${missing ? " is-missing" : ""}`;
  return (
    <div style={{ animation: "gs-fade-up .3s var(--ease-out) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <label htmlFor={id} style={{ fontSize: 16, fontWeight: 600, color: "var(--glue-ink)" }}>
          {field.label}
          {field.required && <span style={{ color: "var(--glue-primary)", marginLeft: 4 }}>*</span>}
        </label>
        {field.required && filled && <CheckBadge />}
      </div>
      {field.type === "textarea" ? (
        <textarea id={id} className={cls} value={value} disabled={readOnly} rows={4}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className={cls} value={value} disabled={readOnly}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- section nav */
export type NavProgress = { done: number; total: number; pct: number };

function NavItem({
  number, title, progress, active, onSelect, onRemove,
}: {
  number: number;
  title: string;
  progress: NavProgress;
  active: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const done = progress.pct >= 1;
  return (
    <div
      className={`m-navitem${active ? " is-active" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); }
      }}
    >
      <div style={{ position: "relative", width: 38, height: 38, display: "grid", placeItems: "center" }}>
        <Ring pct={progress.pct} color={done ? "var(--glue-green)" : "var(--glue-primary)"} />
        <span className="m-num" style={{ position: "absolute", fontSize: 12, fontWeight: 700, color: done ? "var(--glue-green)" : "var(--glue-ink)" }}>
          {done ? <Check size={14} /> : number}
        </span>
      </div>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: active ? "var(--glue-ink)" : "var(--glue-ink-700)" }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--glue-ink-500)" }}>{progress.done}/{progress.total} done</div>
      </span>
      {onRemove && (
        <button type="button" className="m-navx" aria-label={`Remove ${title}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Close size={16} />
        </button>
      )}
    </div>
  );
}

function AddItem({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <button type="button" className="m-navadd" onClick={onAdd}>
      <span className="m-navadd-circle"><Plus /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--glue-ink-500)" }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--glue-ink-400)" }}>Not in this brief</div>
      </span>
      <span className="m-navadd-cta">Add</span>
    </button>
  );
}

function DeliverablesHeader({ activeOn, total }: { activeOn: number; total: number }) {
  return (
    <div style={{ padding: "0 14px", marginTop: 14, marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: "var(--glue-ink-400)" }}>
          Deliverables
        </span>
        <span style={{ fontSize: 13, color: "var(--glue-ink-400)", fontWeight: 600 }}>{activeOn} of {total} on</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--glue-ink-400)", marginTop: 2 }}>
        What this brief will produce — click to add.
      </div>
    </div>
  );
}

export function SectionNav({
  layout, activeId, progressFor, readOnly, onSelect, onAdd, onRemove,
}: {
  layout: NavLayout;
  activeId: number;
  progressFor: (section: SectionDef) => NavProgress;
  readOnly: boolean;
  onSelect: (id: number) => void;
  onAdd: (key: DeliverableKey, id: number) => void;
  onRemove: (key: DeliverableKey) => void;
}) {
  const showGroup = !readOnly || layout.activeOn > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {layout.lead.map((r) => (
        <NavItem key={r.section.id} number={r.number} title={r.section.title}
          progress={progressFor(r.section)} active={r.section.id === activeId}
          onSelect={() => onSelect(r.section.id)} />
      ))}

      {showGroup && <DeliverablesHeader activeOn={layout.activeOn} total={layout.total} />}

      {layout.deliverables.map((d) => {
        if (d.active) {
          // active deliverables always carry a number in navLayout; ?? 0 only satisfies the type
          return (
            <NavItem key={d.section.id} number={d.number ?? 0} title={d.section.title}
              progress={progressFor(d.section)} active={d.section.id === activeId}
              onSelect={() => onSelect(d.section.id)}
              onRemove={readOnly ? undefined : () => onRemove(d.key)} />
          );
        }
        if (readOnly) return null;
        return (
          <AddItem key={d.section.id} title={d.section.title}
            onAdd={() => onAdd(d.key, d.section.id)} />
        );
      })}

      {layout.tail.map((r) => (
        <NavItem key={r.section.id} number={r.number} title={r.section.title}
          progress={progressFor(r.section)} active={r.section.id === activeId}
          onSelect={() => onSelect(r.section.id)} />
      ))}
    </div>
  );
}
