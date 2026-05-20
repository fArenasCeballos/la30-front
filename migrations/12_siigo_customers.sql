-- Migration: Create siigo_customers table for persisting client data for e-invoicing
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.siigo_customers (
  identification VARCHAR(50) PRIMARY KEY,
  id_type VARCHAR(10) NOT NULL DEFAULT '13',
  person_type VARCHAR(20) NOT NULL DEFAULT 'Person',
  name JSONB NOT NULL DEFAULT '["Consumidor Final"]'::jsonb,
  address JSONB NOT NULL DEFAULT '{"address":"Calle 0 # 0-0","city":{"country_code":"Co","state_code":"11","city_code":"11001"}}'::jsonb,
  phones JSONB NOT NULL DEFAULT '[{"number":"0000000"}]'::jsonb,
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by identification (PK already indexed)
CREATE INDEX IF NOT EXISTS idx_siigo_customers_updated ON public.siigo_customers(updated_at DESC);

-- Enable RLS
ALTER TABLE public.siigo_customers ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read customers (for autocomplete in caja)
CREATE POLICY "Authenticated users can read siigo_customers"
  ON public.siigo_customers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: authenticated users can insert/update customers
CREATE POLICY "Authenticated users can upsert siigo_customers"
  ON public.siigo_customers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update siigo_customers"
  ON public.siigo_customers FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Service role bypass (Edge Functions) already has full access

COMMENT ON TABLE public.siigo_customers IS 'Persists customer data for Siigo e-invoicing autocomplete';
