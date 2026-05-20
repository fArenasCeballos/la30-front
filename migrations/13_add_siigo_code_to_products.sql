-- Migration: Add siigo_code column to products table for electronic invoicing mapping
-- Run this in Supabase SQL Editor

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS siigo_code VARCHAR(50) DEFAULT NULL;

COMMENT ON COLUMN public.products.siigo_code IS 'Product identifier code in Siigo system for electronic invoicing mapping';
