-- Migration: Create siigo_invoices table for tracking Siigo e-invoicing
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.siigo_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  siigo_invoice_id TEXT,           -- ID returned by Siigo API
  siigo_invoice_number TEXT,       -- Invoice number (e.g., "FV-001")
  payment_method TEXT NOT NULL,    -- tarjeta, nequi, mixto
  request_payload JSONB,          -- What we sent to Siigo
  response_payload JSONB,         -- What Siigo returned
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by order
CREATE INDEX IF NOT EXISTS idx_siigo_invoices_order_id ON public.siigo_invoices(order_id);

-- Index for status filtering (e.g., find failed invoices to retry)
CREATE INDEX IF NOT EXISTS idx_siigo_invoices_status ON public.siigo_invoices(status);

-- Enable RLS
ALTER TABLE public.siigo_invoices ENABLE ROW LEVEL SECURITY;

-- Policy: admin can see all invoices
CREATE POLICY "Admins can manage siigo_invoices"
  ON public.siigo_invoices FOR ALL
  USING (public.auth_user_role() = 'admin');

-- Policy: service_role (Edge Functions) can insert
-- Note: Edge Functions use service_role key which bypasses RLS,
-- but we add this for completeness if you ever switch to anon key
CREATE POLICY "Service can insert siigo_invoices"
  ON public.siigo_invoices FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.siigo_invoices IS 'Tracks electronic invoices sent to Siigo API for card/transfer payments';
