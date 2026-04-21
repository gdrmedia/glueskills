import type { Partner } from "@/lib/spec-sheets/enrich";

export function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

export function primary<T>(v: T | T[] | null | undefined): T | null | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function partnerById(id: string, partners: Partner[]): Partner | undefined {
  return partners.find((p) => p.id === id);
}

export function daysUntil(
  date: Date | null | undefined,
  today: Date = new Date(),
): number | null {
  if (!date) return null;
  const ms = date.getTime() - today.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export type UrgencyKey = "overdue" | "urgent" | "soon" | "safe";

export function urgencyOf(
  date: Date | null | undefined,
  today: Date = new Date(),
): { key: UrgencyKey; label: string; days: number } {
  const d = daysUntil(date, today);
  if (d == null) return { key: "safe", label: "", days: 0 };
  if (d < 0) return { key: "overdue", label: "Overdue", days: d };
  if (d <= 7) return { key: "urgent", label: `${d}d left`, days: d };
  if (d <= 21) return { key: "soon", label: `${d}d left`, days: d };
  return { key: "safe", label: `${d}d left`, days: d };
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type DueLike = {
  creativeDue: Date | null;
  creativeDueRaw: string | number | Date | null;
};

export function dueDisplay(p: DueLike): string {
  if (p.creativeDue) return formatDate(p.creativeDue);
  if (p.creativeDueRaw) return String(p.creativeDueRaw);
  return "TBD";
}

export function dueShortDisplay(p: DueLike): string {
  if (p.creativeDue) return formatShortDate(p.creativeDue);
  if (p.creativeDueRaw) return String(p.creativeDueRaw);
  return "TBD";
}
