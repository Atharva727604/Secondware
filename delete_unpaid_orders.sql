-- SQL Query to Delete Unpaid Orders
-- Run this in Supabase SQL Editor to remove all pending/unpaid orders and their items

-- Step 1: Delete all order items for pending orders
DELETE FROM order_items
WHERE order_id IN (
  SELECT id FROM orders WHERE status = 'pending'
);

-- Step 2: Delete all pending orders
DELETE FROM orders
WHERE status = 'pending';

-- Display confirmation: Show remaining orders (should only be paid/delivered/cancelled)
SELECT id, status, customer_name, customer_email, total_amount, created_at
FROM orders
ORDER BY created_at DESC;
