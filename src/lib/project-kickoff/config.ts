// The ONLY core module that reads process.env. Approver rule lives here (not in RLS)
// so it ports with the rest of the core; back it with a roles table later if needed.
// Read per call (not cached) on purpose: cheap, not on a hot path, and lets tests and runtime config changes take effect without a restart.
export function approverIds(): string[] {
  return (process.env.KICKOFF_APPROVER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function canApprove(userId: string | null): boolean {
  if (!userId) return false;
  return approverIds().includes(userId);
}
