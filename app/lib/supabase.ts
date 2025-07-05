import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Debug logging for production issues
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Missing')
  console.log('Supabase Key:', supabaseAnonKey ? 'Set' : 'Missing')
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

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