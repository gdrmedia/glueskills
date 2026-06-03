import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockList = vi.fn();
const mockCreate = vi.fn();
vi.mock("@/lib/project-kickoff/repository.supabase", () => ({
  makeSupabaseKickoffRepository: () => ({ list: mockList, create: mockCreate }),
}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseClient: () => ({}) }));

import { GET, POST } from "./route";
import { auth } from "@clerk/nextjs/server";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("jwt");
  vi.mocked(auth).mockResolvedValue({ userId: "user_a", getToken: mockGetToken } as never);
  mockList.mockResolvedValue([]);
  mockCreate.mockResolvedValue("newid");
});

function req(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

describe("GET /api/kickoffs", () => {
  it("401 when signed out", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await GET(req("http://x/api/kickoffs?tab=active"))).status).toBe(401);
  });
  it("returns list for the requested tab", async () => {
    mockList.mockResolvedValue([{ id: "a" }]);
    const res = await GET(req("http://x/api/kickoffs?tab=approved"));
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith("approved");
    expect((await res.json()).kickoffs).toHaveLength(1);
  });
  it("defaults to active for an unknown tab", async () => {
    await GET(req("http://x/api/kickoffs?tab=garbage"));
    expect(mockList).toHaveBeenCalledWith("active");
  });
});

describe("POST /api/kickoffs", () => {
  it("401 when signed out", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await POST()).status).toBe(401);
  });
  it("creates a draft and returns the id", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith("user_a");
    expect((await res.json()).id).toBe("newid");
  });
});
