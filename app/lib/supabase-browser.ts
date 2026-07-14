import { createClient } from "@/utils/supabase/client";

// The browser Supabase client, split out of ./supabase so importing the shared
// Post types and pure helpers doesn't pull @supabase/supabase-js into a page's
// first-load bundle. Import this only where the client is actually used.
export const supabase = createClient();
