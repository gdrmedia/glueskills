import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();
vi.mock("@/lib/project-kickoff/repository.supabase", () => ({
  makeSupabaseKickoffRepository: () => ({ get: mockGet, update: mockUpdate, softDelete: mockSoftDelete }),
}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseClient: () => ({}) }));

import { GET, PATCH, DELETE } from "./route";
import { auth } from "@clerk/nextjs/server";

const baseKickoff = {
  id: "id1", title: "Untitled brief", status: "draft", locked: false,
  deliverables: { case_study: false, social: false, award: false },
  sections: {}, created_by: "user_a",
  submitted_by: null, submitted_at: null, approved_by: null, approved_at: null,
  created_at: "t", updated_at: "t",
};

const params = { params: Promise.resolve({ id: "id1" }) };

function patchReq(body: unknown): NextRequest {
  return new Request("http://x/api/kickoffs/id1", {
    method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("jwt");
  vi.mocked(auth).mockResolvedValue({ userId: "user_a", getToken: mockGetToken } as never);
  mockGet.mockResolvedValue(baseKickoff);
  mockUpdate.mockResolvedValue({ ...baseKickoff, updated_at: "t2" });
});

describe("GET /api/kickoffs/[id]", () => {
  it("401 signed out", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await GET(new Request("http://x") as never, params)).status).toBe(401);
  });
  it("404 when missing", async () => {
    mockGet.mockResolvedValue(null);
    expect((await GET(new Request("http://x") as never, params)).status).toBe(404);
  });
  it("200 with the kickoff", async () => {
    const res = await GET(new Request("http://x") as never, params);
    expect((await res.json()).kickoff.id).toBe("id1");
  });
});

describe("PATCH /api/kickoffs/[id]", () => {
  it("merges a section answer slice and returns fresh updated_at", async () => {
    const res = await PATCH(patchReq({ section: 2, patch: { answers: { creative_idea: "x" } } }), params);
    expect(res.status).toBe(200);
    const arg = mockUpdate.mock.calls[0][1];
    expect(arg.sections["2"].answers.creative_idea).toBe("x");
    expect(arg.sections["2"].last_edited_by).toBe("user_a");
    expect((await res.json()).updated_at).toBe("t2");
  });
  it("mirrors campaign_name into title", async () => {
    await PATCH(patchReq({ section: 1, patch: { answers: { campaign_name: "Acme Spring" } } }), params);
    expect(mockUpdate.mock.calls[0][1].title).toBe("Acme Spring");
  });
  it("updates deliverables", async () => {
    await PATCH(patchReq({ deliverables: { case_study: true, social: false, award: false } }), params);
    expect(mockUpdate.mock.calls[0][1].deliverables.case_study).toBe(true);
  });
  it("403 when the brief is locked", async () => {
    mockGet.mockResolvedValue({ ...baseKickoff, locked: true });
    expect((await PATCH(patchReq({ section: 1, patch: { answers: { a: "b" } } }), params)).status).toBe(403);
  });
  it("400 on malformed body", async () => {
    expect((await PATCH(patchReq({ section: 99, patch: {} }), params)).status).toBe(400);
  });
  it("no-ops on an empty body (no DB write)", async () => {
    const res = await PATCH(patchReq({}), params);
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/kickoffs/[id]", () => {
  it("soft-deletes a draft", async () => {
    const res = await DELETE(new Request("http://x", { method: "DELETE" }) as never, params);
    expect(res.status).toBe(200);
    expect(mockSoftDelete).toHaveBeenCalledWith("id1");
  });
  it("409 when not a draft", async () => {
    mockGet.mockResolvedValue({ ...baseKickoff, status: "under_review" });
    expect((await DELETE(new Request("http://x", { method: "DELETE" }) as never, params)).status).toBe(409);
  });
});
