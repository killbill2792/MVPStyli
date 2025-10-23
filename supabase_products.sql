-- Create products table for storing detected products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT,
  price DECIMAL(10,2),
  original_price DECIMAL(10,2),
  rating DECIMAL(3,2) DEFAULT 4.0,
  image TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('upper', 'lower', 'dress', 'shoes', 'accessories')),
  garment_des TEXT,
  buy_url TEXT,
  brand TEXT,
  tags TEXT[],
  sizes TEXT[],
  colors TEXT[],
  material TEXT,
  discount INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read products
CREATE POLICY "Allow all users to read products" ON products
  FOR SELECT USING (true);

-- Create policy to allow authenticated users to insert products
CREATE POLICY "Allow authenticated users to insert products" ON products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create policy to allow users to update their own products
CREATE POLICY "Allow users to update their own products" ON products
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Create policy to allow users to delete their own products
CREATE POLICY "Allow users to delete their own products" ON products
  FOR DELETE USING (auth.role() = 'authenticated');
