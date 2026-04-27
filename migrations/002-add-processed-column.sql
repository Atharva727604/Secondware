-- Add processed column to orders table for admin workflow tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;
