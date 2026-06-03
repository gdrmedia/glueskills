import { describe, it, expect, vi, beforeEach } from "vitest";

// Clerk: getUser returns a per-id fixture
const mockGetUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({ users: { getUser: mockGetUser } })),
}));

import { notifyApproversOfSubmission } from "./notify";
import type { Kickoff } from "./types";

const kickoff = { id: "k1", title: "Acme Launch" } as Kickoff;

function makeUsers(): Record<string, unknown> {
  return {
    user_sub: { firstName: "Sam", lastName: "Submitter", emailAddresses: [{ emailAddress: "sam@x.com" }] },
    user_gui: { firstName: "Gui", lastName: "R", emailAddresses: [{ emailAddress: "gui@x.com" }] },
    user_mon: { firstName: "Monica", lastName: "P", emailAddresses: [{ emailAddress: "monica@x.com" }] },
  };
}
let USERS: Record<string, unknown>;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  USERS = makeUsers();
  process.env.KICKOFF_APPROVER_IDS = "user_gui,user_mon";
  process.env.RESEND_API_KEY = "re_test";
  mockGetUser.mockImplementation(async (id: string) => USERS[id]);
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("notifyApproversOfSubmission", () => {
  it("sends one email to BOTH approvers with subject, link and submitter name", async () => {
    await notifyApproversOfSubmission({ kickoff, submitterId: "user_sub", origin: "https://app.test" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.to).toEqual(["gui@x.com", "monica@x.com"]);
    expect(sent.subject).toBe('[GlueSkills] "Acme Launch" submitted for review');
    expect(sent.text).toContain("Sam Submitter");
    expect(sent.text).toContain("https://app.test/dashboard/strategist/project-kickoff/k1");
  });

  it("swallows a Resend failure (does not throw)", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(
      notifyApproversOfSubmission({ kickoff, submitterId: "user_sub", origin: "https://app.test" })
    ).resolves.toBeUndefined();
  });

  it("skips an approver with no email but still sends to the rest", async () => {
    USERS.user_mon = { firstName: "Monica", lastName: "P", emailAddresses: [] };
    await notifyApproversOfSubmission({ kickoff, submitterId: "user_sub", origin: "https://app.test" });
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.to).toEqual(["gui@x.com"]);
  });

  it("does not call Resend when no approver email resolves", async () => {
    USERS.user_gui = { emailAddresses: [] };
    USERS.user_mon = { emailAddresses: [] };
    await notifyApproversOfSubmission({ kickoff, submitterId: "user_sub", origin: "https://app.test" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to a generic name when the submitter lookup throws, and still sends", async () => {
    mockGetUser.mockImplementation(async (id: string) => {
      if (id === "user_sub") throw new Error("clerk unavailable");
      return USERS[id];
    });
    await notifyApproversOfSubmission({ kickoff, submitterId: "user_sub", origin: "https://app.test" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.text).toContain("A teammate");
    expect(sent.to).toEqual(["gui@x.com", "monica@x.com"]);
  });
});
