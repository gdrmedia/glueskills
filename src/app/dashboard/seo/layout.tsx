import { BackLink } from "@/components/dashboard/back-link";

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackLink href="/dashboard/seo" label="SEO" />
      {children}
    </>
  );
}
