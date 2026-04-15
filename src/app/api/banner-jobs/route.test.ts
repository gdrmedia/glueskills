// src/app/api/banner-jobs/route.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Mock Clerk auth
const mockGetToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Mock Supabase
const mockInsert = vi.fn();
const mockCount = vi.fn();
const mockFrom = vi.fn(() => ({
  insert: (...args: unknown[]) => mockInsert(...args),
  select: () => ({
    eq: () => ({
      gte: () => mockCount(),
    }),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => ({ from: mockFrom }),
}));

import { POST } from "./route";
import { auth } from "@clerk/nextjs/server";

const validBody = {
  name: "Test Campaign",
  config: {
    version: 1,
    targets: [{ width: 300, height: 250, label: "Medium Rectangle", isCustom: false }],
    options: { placeOnNewPage: true, namingPattern: "size-job" },
  },
};

function buildRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/banner-jobs", {
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
});

describe("POST /api/banner-jobs", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid config", async () => {
    const res = await POST(buildRequest({ name: "Test", config: { version: 1, targets: [], options: {} } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid name", async () => {
    const res = await POST(buildRequest({ ...validBody, name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when user has 10+ jobs in the last hour", async () => {
    mockCount.mockResolvedValue({ count: 10, error: null });
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("returns 200 with a code on success", async () => {
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(json.expiresAt).toBeTypeOf("string");
  });

  it("inserts the row with the user's Clerk ID", async () => {
    await POST(buildRequest(validBody));
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.user_id).toBe("user_123");
    expect(inserted.name).toBe("Test Campaign");
    expect(inserted.config).toEqual(validBody.config);
    expect(inserted.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("returns 500 if Supabase insert fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db down" } });
    const res = await POST(buildRequest(validBody));
    expect(res.status).toBe(500);
  });
});
