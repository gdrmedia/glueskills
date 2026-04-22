import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const mockFrom = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle: () => mockSingle() }) }),
  update: (payload: unknown) => ({
    eq: (col: string, val: unknown) => ({ select: () => mockUpdate(payload, col, val) }),
  }),
  delete: () => ({
    eq: (col: string, val: unknown) => ({ select: () => mockDelete(col, val) }),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => ({ from: mockFrom }),
}));

import { GET, PATCH, DELETE } from "./route";
import { auth } from "@clerk/nextjs/server";

function ctx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("fake.jwt.token");
  vi.mocked(auth).mockResolvedValue({ userId: "user_1", getToken: mockGetToken } as never);
  mockUpdate.mockResolvedValue({ data: [{ slug: "acme" }], error: null });
  mockDelete.mockResolvedValue({ data: [{ slug: "acme" }], error: null });
});

describe("GET /api/brands/[slug]", () => {
  it("returns 404 when brand not found", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    const res = await GET({} as NextRequest, ctx("acme"));
    expect(res.status).toBe(404);
  });

  it("returns the brand row on success — no auth required", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    mockSingle.mockResolvedValue({
      data: {
        id: "uuid", slug: "acme", name: "ACME",
        palette: { primary: "#f00", secondary: "#0f0" },
        font: { family: "Inter", fallback: "Arial", weights: { bold: "Bold", semi: "Semi Bold", regular: "Regular" } },
        logo_primary_url: "https://x/p.png",
        logo_alt_url: null,
        images: null,
        created_at: "2026-04-21T00:00:00Z",
        updated_at: "2026-04-21T00:00:00Z",
      },
      error: null,
    });
    const res = await GET({} as NextRequest, ctx("acme"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.slug).toBe("acme");
  });
});

describe("PATCH /api/brands/[slug]", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const req = new Request("http://x", { method: "PATCH", body: "{}" }) as unknown as NextRequest;
    expect((await PATCH(req, ctx("acme"))).status).toBe(401);
  });

  it("returns 400 on invalid body", async () => {
    const req = new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "" }) }) as unknown as NextRequest;
    expect((await PATCH(req, ctx("acme"))).status).toBe(400);
  });

  it("updates and returns 200 on success", async () => {
    const req = new Request("http://x", {
      method: "PATCH",
      body: JSON.stringify({ name: "ACME Updated" }),
    }) as unknown as NextRequest;
    const res = await PATCH(req, ctx("acme"));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ name: "ACME Updated" }, "slug", "acme");
  });

  it("returns 400 on empty patch body {}", async () => {
    const req = new Request("http://x", { method: "PATCH", body: "{}" }) as unknown as NextRequest;
    expect((await PATCH(req, ctx("acme"))).status).toBe(400);
  });

  it("returns 404 when the slug does not exist", async () => {
    mockUpdate.mockResolvedValue({ data: [], error: null });
    const req = new Request("http://x", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
    }) as unknown as NextRequest;
    expect((await PATCH(req, ctx("nope"))).status).toBe(404);
  });

  it("returns 500 when the update fails", async () => {
    mockUpdate.mockResolvedValue({ data: null, error: { message: "db down" } });
    const req = new Request("http://x", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
    }) as unknown as NextRequest;
    expect((await PATCH(req, ctx("acme"))).status).toBe(500);
  });
});

describe("DELETE /api/brands/[slug]", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await DELETE({} as NextRequest, ctx("acme"))).status).toBe(401);
  });

  it("deletes and returns 200 on success", async () => {
    const res = await DELETE({} as NextRequest, ctx("acme"));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith("slug", "acme");
  });

  it("returns 404 when the slug does not exist", async () => {
    mockDelete.mockResolvedValue({ data: [], error: null });
    expect((await DELETE({} as NextRequest, ctx("nope"))).status).toBe(404);
  });

  it("returns 500 when the delete fails", async () => {
    mockDelete.mockResolvedValue({ data: null, error: { message: "db down" } });
    expect((await DELETE({} as NextRequest, ctx("acme"))).status).toBe(500);
  });
});
