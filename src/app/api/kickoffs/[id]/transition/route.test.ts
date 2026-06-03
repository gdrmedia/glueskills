import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockGet = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/project-kickoff/repository.supabase", () => ({
  makeSupabaseKickoffRepository: () => ({ get: mockGet, update: mockUpdate }),
}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseClient: () => ({}) }));

const mockNotify = vi.fn();
vi.mock("@/lib/project-kickoff/notify", () => ({
  notifyApproversOfSubmission: (...args: unknown[]) => mockNotify(...args),
}));

import { POST } from "./route";
import { auth } from "@clerk/nextjs/server";

const params = { params: Promise.resolve({ id: "id1" }) };

const filledSections = (() => {
  const s: Record<string, unknown> = {};
  const fill = { answers: { client_brand: "x", campaign_name: "x", industry: "x", campaign_summary: "x", business_problem: "x", creative_idea: "x", result_business: "x", result_audience: "x", approver_internal: "x", approver_client: "x" } };
  for (const id of [1, 2, 3, 7]) s[String(id)] = { ...fill, approval: null, approval_notes: "", owner: null, section_status: "done", last_edited_by: null, last_edited_at: null };
  return s;
})();

const draft = {
  id: "id1", title: "Acme", status: "draft", locked: false,
  deliverables: { case_study: false, social: false, award: false },
  sections: filledSections, created_by: "user_a",
  submitted_by: null, submitted_at: null, approved_by: null, approved_at: null,
  created_at: "t", updated_at: "t",
};

function body(action: string): NextRequest {
  return new Request("http://x", { method: "POST", body: JSON.stringify({ action }), headers: { "Content-Type": "application/json" } }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("jwt");
  vi.mocked(auth).mockResolvedValue({ userId: "user_a", getToken: mockGetToken } as never);
  process.env.KICKOFF_APPROVER_IDS = "user_approver";
  mockGet.mockResolvedValue(draft);
  mockUpdate.mockImplementation((_id, patch) => Promise.resolve({ ...draft, ...patch }));
});

describe("POST transition", () => {
  it("submit moves draft → under_review and locks", async () => {
    const res = await POST(body("submit"), params);
    expect(res.status).toBe(200);
    const patch = mockUpdate.mock.calls[0][1];
    expect(patch.status).toBe("under_review");
    expect(patch.locked).toBe(true);
    expect(patch.submitted_by).toBe("user_a");
  });

  it("submit blocked (422) when required fields missing", async () => {
    mockGet.mockResolvedValue({ ...draft, sections: {} });
    const res = await POST(body("submit"), params);
    expect(res.status).toBe(422);
    expect((await res.json()).missing.length).toBeGreaterThan(0);
  });

  it("approve forbidden (403) for non-approver", async () => {
    mockGet.mockResolvedValue({ ...draft, status: "under_review" });
    expect((await POST(body("approve"), params)).status).toBe(403);
  });

  it("approve succeeds for approver", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_approver", getToken: mockGetToken } as never);
    mockGet.mockResolvedValue({ ...draft, status: "under_review" });
    const res = await POST(body("approve"), params);
    expect(res.status).toBe(200);
    expect(mockUpdate.mock.calls[0][1].approved_by).toBe("user_approver");
  });

  it("reopen under_review → draft for any user", async () => {
    mockGet.mockResolvedValue({ ...draft, status: "under_review", locked: true });
    const res = await POST(body("reopen"), params);
    expect(res.status).toBe(200);
    expect(mockUpdate.mock.calls[0][1].status).toBe("draft");
    expect(mockUpdate.mock.calls[0][1].locked).toBe(false);
  });

  it("400 on unknown action", async () => {
    expect((await POST(body("frobnicate"), params)).status).toBe(400);
  });

  it("notifies both approvers on submit, with kickoff + submitter + origin", async () => {
    await POST(body("submit"), params);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    const arg = mockNotify.mock.calls[0][0];
    expect(arg.kickoff.status).toBe("under_review");
    expect(arg.kickoff.id).toBe("id1");
    expect(arg.submitterId).toBe("user_a");
    expect(arg.origin).toBe("http://x");
  });

  it("does NOT notify on approve", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_approver", getToken: mockGetToken } as never);
    mockGet.mockResolvedValue({ ...draft, status: "under_review" });
    await POST(body("approve"), params);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("does NOT notify on reopen", async () => {
    mockGet.mockResolvedValue({ ...draft, status: "under_review", locked: true });
    await POST(body("reopen"), params);
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
