import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">GlueSkills</h1>
        <p className="mt-2 text-muted-foreground">
          Fast, lean tools for creatives.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/sign-in">
          <Button variant="outline">Sign In</Button>
        </Link>
        <Link href="/sign-up">
          <Button>Get Started</Button>
        </Link>
      </div>
    </div>
  );
}
