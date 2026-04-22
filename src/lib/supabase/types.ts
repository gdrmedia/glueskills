export type Brief = {
  id: string;
  user_id: string;
  title: string;
  objective: string | null;
  audience: string | null;
  deliverables: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CopyItem = {
  id: string;
  user_id: string;
  brief_id: string | null;
  title: string;
  content: string | null;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Asset = {
  id: string;
  user_id: string;
  brief_id: string | null;
  name: string;
  url: string | null;
  type: string | null;
  dimensions: string | null;
  status: string;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  date: string;
  status: string;
  created_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
};

export type InspirationPreference = {
  id: string;
  user_id: string;
  enabled_sources: string[];
  created_at: string;
  updated_at: string;
};

export type BannerJob = {
  code: string;
  user_id: string;
  name: string;
  config: unknown;        // validated by zod at the boundary, kept loose here
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
};

// Brand row type — canonical shape lives in `@/lib/brands/schema`. Re-exported
// here so `import { Brand } from "@/lib/supabase/types"` keeps working alongside
// the other row types.
export type { BrandPack as Brand } from "@/lib/brands/schema";
