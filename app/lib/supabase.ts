import { createClient } from "@/utils/supabase/client";

// Export the client creation function
export const supabase = createClient();

export type Post = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  content: string;
  type: "music" | "climb" | "note";
  media_url?: string;
  tags: string[];
  accent_color: string;
  is_draft: boolean;
  view_count: number;
};

export type User = {
  id: string;
  email: string;
  created_at: string;
};
