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
  expires_at: string | null
}

export type Quote = {
  id: string
  request_id: string
  supplier_name: string
  price: number
  condition: 'New' | 'Used' | 'Reconditioned'
  notes: string
  admin_notes: string
  status: 'pending' | 'selected' | 'rejected'
  created_at: string
}

export type Token = {
  id: string
  request_id: string
  token: string
  used: boolean
  created_at: string
}

export type Image = {
  id: string
  request_id: string | null
  quote_id: string | null
  storage_path: string
  uploaded_by: 'requester' | 'supplier'
  created_at: string
}
