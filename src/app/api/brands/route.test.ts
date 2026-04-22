import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockInsert = vi.fn();
const mockCount = vi.fn();
const mockList = vi.fn();

const mockFrom = vi.fn(() => ({
  insert: (...args: unknown[]) => mockInsert(...args),
  select: (..._args: unknown[]) => ({
    gte: () => mockCount(),
    order: () => mockList(),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => ({ from: mockFrom }),
}));

import { POST, GET } from "./route";
import { auth } from "@clerk/nextjs/server";

const validInput = {
  slug: "acme",
  name: "ACME",
  palette: { primary: "#ff0000", secondary: "#00ff00" },
  font: {
    family: "Inter",
    fallback: "Arial",
    weights: { bold: "Bold", semi: "Semi Bold", regular: "Regular" },
  },
  logo_primary_url: "https://x/p.png",
  logo_alt_url: null,
  images: null,
};

function buildPost(body: unknown): NextRequest {
  return new Request("http://localhost/api/brands", {
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
  mockList.mockResolvedValue({ data: [], error: null });
});

describe("POST /api/brands", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await POST(buildPost(validInput));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    const res = await POST(buildPost({ ...validInput, slug: "ACME" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const bad = new Request("http://localhost/api/brands", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    }) as unknown as NextRequest;
    expect((await POST(bad as NextRequest)).status).toBe(400);
  });

  it("returns 429 at 30+ inserts in the last hour", async () => {
    mockCount.mockResolvedValue({ count: 30, error: null });
    expect((await POST(buildPost(validInput))).status).toBe(429);
  });

  it("inserts the row and returns 200 with slug", async () => {
    const res = await POST(buildPost(validInput));
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.slug).toBe("acme");
    expect(row.name).toBe("ACME");
    const json = await res.json();
    expect(json.slug).toBe("acme");
  });

  it("returns 500 if insert fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db down" } });
    expect((await POST(buildPost(validInput))).status).toBe(500);
  });
});

describe("GET /api/brands", () => {
  it("returns 200 with a sorted summary list — no auth required", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    mockList.mockResolvedValue({
      data: [
        { slug: "acme", name: "ACME", logo_primary_url: "https://x/p.png" },
        { slug: "beta", name: "Beta", logo_primary_url: "https://x/q.png" },
      ],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.brands).toHaveLength(2);
    expect(json.brands[0]).toEqual({
      slug: "acme",
      name: "ACME",
      logo_primary_url: "https://x/p.png",
    });
  });

  it("returns 500 if list fails", async () => {
    mockList.mockResolvedValue({ data: null, error: { message: "down" } });
    expect((await GET()).status).toBe(500);
  });
});
