// src/lib/banner-jobs/iab-sizes.ts
export type IabGroup = "desktop" | "mobile" | "square";

export type IabSize = {
  width: number;
  height: number;
  label: string;
  group: IabGroup;
};

export const IAB_GROUPS: Record<IabGroup, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  square: "Square",
};

export const IAB_SIZES: IabSize[] = [
  // Desktop (8)
  { width: 300, height: 250, label: "Medium Rectangle", group: "desktop" },
  { width: 336, height: 280, label: "Large Rectangle", group: "desktop" },
  { width: 728, height: 90, label: "Leaderboard", group: "desktop" },
  { width: 970, height: 90, label: "Large Leaderboard", group: "desktop" },
  { width: 970, height: 250, label: "Billboard", group: "desktop" },
  { width: 300, height: 600, label: "Half Page", group: "desktop" },
  { width: 160, height: 600, label: "Wide Skyscraper", group: "desktop" },
  { width: 120, height: 600, label: "Skyscraper", group: "desktop" },
  // Mobile (4)
  { width: 320, height: 50, label: "Mobile Banner", group: "mobile" },
  { width: 320, height: 100, label: "Large Mobile Banner", group: "mobile" },
  { width: 300, height: 50, label: "Mobile Leaderboard", group: "mobile" },
  { width: 468, height: 60, label: "Banner", group: "mobile" },
  // Square (2)
  { width: 250, height: 250, label: "Square", group: "square" },
  { width: 200, height: 200, label: "Small Square", group: "square" },
];
