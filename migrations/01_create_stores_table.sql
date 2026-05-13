-- ============================================================
-- SCRIPT 1: Crear tabla stores + semilla de 3 tiendas
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- Este script es idempotente (se puede ejecutar varias veces sin problema)
-- ============================================================

-- 1. Crear tabla de tiendas
CREATE TABLE IF NOT EXISTS stores (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL UNIQUE,      -- 'Restaurante', 'Carrito Móvil', 'Domicilios'
  slug       TEXT        NOT NULL UNIQUE,       -- 'restaurante', 'carrito', 'domicilios'
  icon       TEXT,                              -- emoji para UI
  color      TEXT,                              -- color de acento hex para la tienda
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  stores      IS 'Tiendas/puntos de venta del negocio. Cada una opera como un ecosistema independiente.';
COMMENT ON COLUMN stores.slug IS 'Identificador URL-safe para persistencia en localStorage y rutas.';

-- 2. Insertar las 3 tiendas
INSERT INTO stores (name, slug, icon, color, is_active) VALUES
  ('Restaurante',   'restaurante', '🏪', '#F97316', TRUE),   -- naranja (tema actual)
  ('Carrito Móvil', 'carrito',     '🛒', '#3B82F6', TRUE),   -- azul
  ('Domicilios',    'domicilios',  '🏍️', '#8B5CF6', FALSE)   -- morado, inactivo = próximamente
ON CONFLICT (slug) DO NOTHING;

-- 3. Verificar
SELECT id, name, slug, icon, color, is_active FROM stores ORDER BY created_at;
