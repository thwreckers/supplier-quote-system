-- SQL Migrations for Dynamic Fields & Customer Management

-- 1. Create customers table
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  contact_person text,
  email text,
  phone text,
  notes text,
  created_at timestamp DEFAULT now()
);

-- 2. Add columns to requests table
ALTER TABLE requests ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE requests ADD COLUMN custom_fields jsonb DEFAULT NULL;

-- 3. Add column to quotes table
ALTER TABLE quotes ADD COLUMN quote_fields jsonb DEFAULT NULL;

-- 4. Disable RLS on customers table (if it exists) so your app can read it
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- Indexes for better performance
CREATE INDEX idx_requests_customer_id ON requests(customer_id);
CREATE INDEX idx_quotes_request_id ON quotes(request_id);
