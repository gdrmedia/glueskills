import { BackLink } from "@/components/dashboard/back-link";

export default function CopywriterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackLink href="/dashboard/copywriter" label="Copywriter" />
      {children}
    </>
  );
}
