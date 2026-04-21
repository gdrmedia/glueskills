import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

const mockInsert = vi.fn();
const mockCount = vi.fn();
const mockListData = vi.fn();

const mockFrom = vi.fn(() => ({
  insert: (...args: unknown[]) => mockInsert(...args),
  select: (..._args: unknown[]) => ({
    eq: (_col: string, _val: unknown) => ({
      gte: () => mockCount(),
      is: () => ({
        order: () => mockListData(),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => ({ from: mockFrom }),
}));

import { POST, GET } from "./route";
import { auth } from "@clerk/nextjs/server";

const validPayload = {
  campaign: "Campaign A",
  client: "ACME",
  placements: [{ id: "meta-0", partner: "meta", partnerName: "Meta", name: "Reels", otherFields: {} }],
  partners: [{ id: "meta", name: "Meta", color: "#0866FF", iconId: "meta" }],
  summary: { templateName: "Campaign A", client: "ACME", totalPlacements: 1, earliestDue: null, period: "" },
};

function buildPost(body: unknown): NextRequest {
  return new Request("http://localhost/api/spec-sheets", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("fake.jwt.token");
  vi.mocked(auth).mockResolvedValue({ userId: "user_123", getToken: mockGetToken } as never);
  mockCount.mockResolvedValue({ count: 0, error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockListData.mockResolvedValue({ data: [], error: null });
});

describe("POST /api/spec-sheets", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await POST(buildPost(validPayload));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid payload (empty campaign)", async () => {
    const res = await POST(buildPost({ ...validPayload, campaign: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    const bad = new Request("http://localhost/api/spec-sheets", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    }) as unknown as NextRequest;
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });

  it("returns 429 when user already has 10 sheets in the last hour", async () => {
    mockCount.mockResolvedValue({ count: 10, error: null });
    const res = await POST(buildPost(validPayload));
    expect(res.status).toBe(429);
  });

  it("returns 200 with a generated code on success", async () => {
    const res = await POST(buildPost(validPayload));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("inserts the row with user's Clerk ID and payload fields", async () => {
    await POST(buildPost(validPayload));
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.user_id).toBe("user_123");
    expect(inserted.campaign).toBe("Campaign A");
    expect(inserted.client).toBe("ACME");
    expect(inserted.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(Array.isArray(inserted.placements)).toBe(true);
    expect(Array.isArray(inserted.partners)).toBe(true);
  });

  it("returns 500 if Supabase insert fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db down" } });
    const res = await POST(buildPost(validPayload));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/spec-sheets", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the user's sheets", async () => {
    mockListData.mockResolvedValue({
      data: [
        { code: "ABC123", campaign: "X", client: "Y", created_at: "2026-04-21T00:00:00Z" },
      ],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sheets).toHaveLength(1);
    expect(json.sheets[0]).toEqual({ code: "ABC123", campaign: "X", client: "Y", createdAt: "2026-04-21T00:00:00Z" });
  });
});
