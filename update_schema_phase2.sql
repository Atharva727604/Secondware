-- Update Profiles role check
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'merchant'));

-- Create Merchant Applications table
CREATE TABLE IF NOT EXISTS merchant_applications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  store_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  gst_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add merchant_id to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES auth.users;

-- Add merchant_id and commission fields to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES auth.users;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0.10;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pg_fee_rate NUMERIC DEFAULT 0.03; -- Default 3%

-- Add payment_method to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card';

-- Enable RLS for merchant_applications
ALTER TABLE merchant_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all merchant applications" ON merchant_applications FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can insert their own merchant applications" ON merchant_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own merchant applications" ON merchant_applications FOR SELECT
  USING (auth.uid() = user_id);
