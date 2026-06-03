import { describe, it, expect, vi } from "vitest";
import { makeSupabaseKickoffRepository } from "./repository.supabase";

function fakeRow(over: Record<string, unknown> = {}) {
  return {
    id: "id1", title: "Acme", status: "draft", locked: false,
    deliverables: { case_study: true, social: false, award: false },
    sections: { "1": { answers: {}, approval: null, approval_notes: "", owner: null, section_status: "done", last_edited_by: null, last_edited_at: null } },
    created_by: "user_a", submitted_by: null, submitted_at: null,
    approved_by: null, approved_at: null,
    created_at: "t", updated_at: "t", ...over,
  };
}

describe("supabase adapter", () => {
  it("get() maps a row to a Kickoff", async () => {
    const single = vi.fn().mockResolvedValue({ data: fakeRow(), error: null });
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ is: () => ({ single }) }) }) }),
    };
    const repo = makeSupabaseKickoffRepository(client as never);
    const k = await repo.get("id1");
    expect(k?.id).toBe("id1");
    expect(k?.deliverables.case_study).toBe(true);
  });

  it("list() returns summaries with computed progress", async () => {
    const order = vi.fn().mockResolvedValue({ data: [fakeRow()], error: null });
    const client = {
      from: () => ({ select: () => ({ in: () => ({ is: () => ({ order }) }) }) }),
    };
    const repo = makeSupabaseKickoffRepository(client as never);
    const rows = await repo.list("active");
    expect(rows[0].progress).toEqual({ done: 1, total: 5 }); // §1,2,3,4,7 active; §1 done
  });

  it("create() inserts and returns the new id", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "newid" }, error: null });
    const client = { from: () => ({ insert: () => ({ select: () => ({ single }) }) }) };
    const repo = makeSupabaseKickoffRepository(client as never);
    expect(await repo.create("user_a")).toBe("newid");
  });

  it("get() returns null on not-found error", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const client = { from: () => ({ select: () => ({ eq: () => ({ is: () => ({ single }) }) }) }) };
    const repo = makeSupabaseKickoffRepository(client as never);
    expect(await repo.get("missing")).toBeNull();
  });

  it("update() returns the mapped fresh row", async () => {
    const single = vi.fn().mockResolvedValue({ data: fakeRow({ status: "under_review" }), error: null });
    const client = { from: () => ({ update: () => ({ eq: () => ({ select: () => ({ single }) }) }) }) };
    const repo = makeSupabaseKickoffRepository(client as never);
    const k = await repo.update("id1", { status: "under_review" });
    expect(k.id).toBe("id1");
    expect(k.status).toBe("under_review");
  });

  it("update() throws on error", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const client = { from: () => ({ update: () => ({ eq: () => ({ select: () => ({ single }) }) }) }) };
    const repo = makeSupabaseKickoffRepository(client as never);
    await expect(repo.update("id1", { status: "approved" })).rejects.toBeTruthy();
  });

  it("softDelete() issues an update with deleted_at and resolves", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const client = { from: () => ({ update }) };
    const repo = makeSupabaseKickoffRepository(client as never);
    await expect(repo.softDelete("id1")).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }));
  });

  it("softDelete() throws on error", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const client = { from: () => ({ update: () => ({ eq }) }) };
    const repo = makeSupabaseKickoffRepository(client as never);
    await expect(repo.softDelete("id1")).rejects.toBeTruthy();
  });
});
