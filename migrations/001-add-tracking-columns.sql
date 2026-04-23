-- Migration: add tracking and webhook id columns to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS porter_shipment_id TEXT,
  ADD COLUMN IF NOT EXISTS carrier TEXT,
  ADD COLUMN IF NOT EXISTS last_porter_event_id TEXT;

-- Optionally index tracker columns for faster lookup
CREATE INDEX IF NOT EXISTS idx_orders_porter_shipment_id ON orders (porter_shipment_id);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders (tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_last_porter_event_id ON orders (last_porter_event_id);
