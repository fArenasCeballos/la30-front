-- Migration: Add siigo_invoice_id and siigo_invoice_number to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS siigo_invoice_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS siigo_invoice_number TEXT;

COMMENT ON COLUMN public.orders.siigo_invoice_id IS 'ID of the successful Siigo electronic invoice';
COMMENT ON COLUMN public.orders.siigo_invoice_number IS 'Official invoice number returned by Siigo (e.g. SETT-123)';
