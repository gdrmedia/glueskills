import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, message } = await req.json();

  if (!type || !message?.trim()) {
    return NextResponse.json({ error: "Type and message are required" }, { status: 400 });
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const email = user.emailAddresses[0]?.emailAddress ?? "unknown";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || email;

  const subject = type === "bug" ? "Bug Report" : "Feature Request";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "GlueSkills <feedback@resend.dev>",
      to: "guillermo.rozenblat@glueiq.com",
      subject: `[GlueSkills] ${subject} from ${name}`,
      text: `Type: ${subject}\nFrom: ${name} (${email})\n\n${message}`,
    }),
  });

  if (!response.ok) {
    // Fallback: log it if email fails
    console.error("Failed to send feedback email:", await response.text());
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
