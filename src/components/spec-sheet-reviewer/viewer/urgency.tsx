import type React from "react";
import { urgencyOf } from "./helpers";

type UrgencyProps = {
  placement: { dueTBD: boolean; creativeDue: Date | null };
  today?: Date;
};

export function Urgency({ placement, today = new Date() }: UrgencyProps): React.ReactElement {
  if (placement.dueTBD) return <span className="bsd-urg bsd-urg-tbd">TBD</span>;
  const u = urgencyOf(placement.creativeDue, today);
  const cls = `bsd-urg bsd-urg-${u.key}`;
  return (
    <span className={cls}>
      {u.key === "overdue" ? `${Math.abs(u.days)}d overdue` : u.label}
    </span>
  );
}
