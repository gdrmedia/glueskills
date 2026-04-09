import { BackLink } from "@/components/dashboard/back-link";

export default function DesignerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackLink href="/dashboard/designer" label="Designer" />
      {children}
    </>
  );
}
