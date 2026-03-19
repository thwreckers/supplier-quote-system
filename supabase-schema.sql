-- Supplier Quote System - Supabase Schema
-- Run this in your Supabase SQL Editor

-- Requests table
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'closed'))
);

-- Quotes table
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  request_id uuid not null references requests(id) on delete cascade,
  supplier_name text not null,
  price numeric(10, 2) not null,
  condition text not null check (condition in ('New', 'Used', 'Reconditioned')),
  notes text
);

-- Enable Row Level Security
alter table requests enable row level security;
alter table quotes enable row level security;

-- Allow all operations via anon key (internal tool - no public auth needed)
create policy "Allow all on requests" on requests for all using (true) with check (true);
create policy "Allow all on quotes" on quotes for all using (true) with check (true);
