import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockGet = vi.fn();
vi.mock("@/lib/project-kickoff/repository.supabase", () => ({
  makeSupabaseKickoffRepository: () => ({ get: mockGet }),
}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseClient: () => ({}) }));

const mockNotify = vi.fn();
vi.mock("@/lib/project-kickoff/notify", () => ({
  notifySectionOwner: (...args: unknown[]) => Promise.resolve(mockNotify(...args)),
}));

import { POST } from "./route";
import { auth } from "@clerk/nextjs/server";

const params = { params: Promise.resolve({ id: "id1" }) };

function section(owner: string | null) {
  return { answers: {}, approval: null, approval_notes: "", owner, section_status: "not_started", last_edited_by: null, last_edited_at: null };
}

const draft = {
  id: "id1", title: "Acme", status: "draft", locked: false,
  deliverables: { case_study: true, social: false, award: false },
  sections: { "4": section("user_owner"), "5": section(null) },
  created_by: "user_a",
  submitted_by: null, submitted_at: null, approved_by: null, approved_at: null,
  created_at: "t", updated_at: "t",
};

function body(payload: unknown): NextRequest {
  return new Request("http://x", { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("jwt");
  vi.mocked(auth).mockResolvedValue({ userId: "user_a", getToken: mockGetToken } as never);
  mockGet.mockResolvedValue(draft);
});

describe("POST nudge", () => {
  it("notifies the section owner with kickoff + sectionId + origin", async () => {
    const res = await POST(body({ sectionId: 4 }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockNotify).toHaveBeenCalledTimes(1);
    const arg = mockNotify.mock.calls[0][0];
    expect(arg.kickoff.id).toBe("id1");
    expect(arg.sectionId).toBe(4);
    expect(arg.ownerId).toBe("user_owner");
    expect(arg.origin).toBe("http://x");
  });

  it("forwards an optional message to the notifier", async () => {
    const res = await POST(body({ sectionId: 4, message: "by Friday please" }), params);
    expect(res.status).toBe(200);
    expect(mockNotify.mock.calls[0][0].message).toBe("by Friday please");
  });

  it("400 when the section has no owner", async () => {
    const res = await POST(body({ sectionId: 5 }), params);
    expect(res.status).toBe(400);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("400 on an out-of-range sectionId", async () => {
    expect((await POST(body({ sectionId: 99 }), params)).status).toBe(400);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("404 when the kickoff does not exist", async () => {
    mockGet.mockResolvedValue(null);
    const res = await POST(body({ sectionId: 4 }), params);
    expect(res.status).toBe(404);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("401 when signed out", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null, getToken: mockGetToken } as never);
    expect((await POST(body({ sectionId: 4 }), params)).status).toBe(401);
  });
});
