import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

const mockRpc = vi.fn();
const mockUpdateEqEq = vi.fn();

const mockFrom = vi.fn(() => ({
  update: (_payload: unknown) => ({
    eq: (_col1: string, _val1: unknown) => ({
      eq: (_col2: string, _val2: unknown) => mockUpdateEqEq(),
    }),
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: mockFrom,
  }),
}));

import { GET, DELETE } from "./route";
import { auth } from "@clerk/nextjs/server";

function buildReq(method: "GET" | "DELETE", code: string): NextRequest {
  return new Request(`http://localhost/api/spec-sheets/${code}`, { method }) as unknown as NextRequest;
}

function ctx(code: string) {
  return { params: Promise.resolve({ code }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("fake.jwt.token");
  vi.mocked(auth).mockResolvedValue({ userId: "user_123", getToken: mockGetToken } as never);
  mockUpdateEqEq.mockResolvedValue({ error: null });
});

describe("GET /api/spec-sheets/[code]", () => {
  it("returns 200 with the sheet when RPC finds it", async () => {
    mockRpc.mockResolvedValue({
      data: { code: "ABC123", campaign: "C1", client: null, placements: [], partners: [], summary: {} },
      error: null,
    });
    const res = await GET(buildReq("GET", "ABC123"), ctx("ABC123"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toBe("ABC123");
    expect(mockRpc).toHaveBeenCalledWith("get_spec_sheet", { sheet_code: "ABC123" });
  });

  it("returns 404 when RPC returns null", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const res = await GET(buildReq("GET", "XXXXXX"), ctx("XXXXXX"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when RPC errors", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    const res = await GET(buildReq("GET", "ABC123"), ctx("ABC123"));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/spec-sheets/[code]", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await DELETE(buildReq("DELETE", "ABC123"), ctx("ABC123"));
    expect(res.status).toBe(401);
  });

  it("soft-deletes and returns 200 on success", async () => {
    const res = await DELETE(buildReq("DELETE", "ABC123"), ctx("ABC123"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("returns 500 if update errors", async () => {
    mockUpdateEqEq.mockResolvedValue({ error: { message: "db down" } });
    const res = await DELETE(buildReq("DELETE", "ABC123"), ctx("ABC123"));
    expect(res.status).toBe(500);
  });
});
