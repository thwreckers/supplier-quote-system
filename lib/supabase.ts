import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    _client = createClient(url, key)
  }
  return _client
}

export type Request = {
  id: string
  created_at: string
  title: string
  description: string
  status: 'open' | 'closed'
}

export type Quote = {
  id: string
  request_id: string
  supplier_name: string
  price: number
  condition: 'New' | 'Used' | 'Reconditioned'
  notes: string
  created_at: string
}
