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

export type Customer = {
  id: string
  name: string
  company: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

export type Supplier = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  notes: string | null
  rating: number | null
  created_at: string
  updated_at: string
}

export type CustomField = {
  id: string
  name: string
  type: 'text' | 'number' | 'select' | 'textarea'
  required: boolean
  options?: string[]
}

export type QuoteField = {
  field_id: string
  value: string
}

export type SelectedSupplier = {
  part_index: number
  quote_id: string
  price: number
}

export type Request = {
  id: string
  created_at: string
  title: string
  description: string
  status: 'open' | 'closed' | 'awarded' | 'completed' | 'archived'
  expires_at: string | null
  customer_details: string | null
  customer_id: string | null
  group_id: string | null
  custom_fields: CustomField[] | null
  parts: string[] | null
  quantities: number[] | null
  selected_suppliers: SelectedSupplier[] | null
}

export type Quote = {
  id: string
  request_id: string
  supplier_name: string
  supplier_id: string | null
  price: number
  condition: 'New' | 'Used' | 'Reconditioned'
  notes: string
  admin_notes: string
  status: 'pending' | 'selected' | 'rejected'
  created_at: string
  quote_fields: QuoteField[] | null
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
