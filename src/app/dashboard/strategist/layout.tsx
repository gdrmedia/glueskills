import { BackLink } from "@/components/dashboard/back-link";

export default function StrategistLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackLink href="/dashboard/strategist" label="Strategist" />
      {children}
    </>
  );
}
