import { Manrope } from "next/font/google";
import type { ReactNode } from "react";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export default function SharedViewerLayout({ children }: { children: ReactNode }) {
  return <div className={manrope.variable}>{children}</div>;
}
