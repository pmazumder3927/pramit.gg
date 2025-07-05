import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Post = {
  id: string
  created_at: string
  updated_at: string
  title: string
  content: string
  type: 'music' | 'climb' | 'note'
  media_url?: string
  tags: string[]
  accent_color: string
  is_draft: boolean
  view_count: number
}

export type User = {
  id: string
  email: string
  created_at: string
} 