-- Create brand_size_charts table to store brand size chart data
-- This allows brands to be managed dynamically without app updates

CREATE TABLE IF NOT EXISTS public.brand_size_charts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('upper_body', 'lower_body', 'dresses')),
  size_label TEXT NOT NULL,
  measurements JSONB NOT NULL, -- Stores measurements like {chest: 34, waist: 28, length: 24, sleeve: 30, shoulder: 16}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_name, category, size_label)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_brand_size_charts_brand_category ON public.brand_size_charts(brand_name, category);

-- Enable RLS
ALTER TABLE public.brand_size_charts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read brand size charts (public data)
CREATE POLICY "Brand size charts are public" ON public.brand_size_charts
  FOR SELECT
  USING (true);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Only admins can manage brand size charts" ON public.brand_size_charts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'admin@stylit.ai'
    )
  );

-- Insert initial brand data from lib/brandSizeCharts.js
-- H&M
INSERT INTO public.brand_size_charts (brand_name, category, size_label, measurements) VALUES
  ('H&M', 'upper_body', 'XS', '{"chest": 34, "waist": 28, "length": 24, "sleeve": 30, "shoulder": 16}'),
  ('H&M', 'upper_body', 'S', '{"chest": 36, "waist": 30, "length": 25, "sleeve": 31, "shoulder": 16.5}'),
  ('H&M', 'upper_body', 'M', '{"chest": 40, "waist": 34, "length": 26, "sleeve": 32, "shoulder": 17.5}'),
  ('H&M', 'upper_body', 'L', '{"chest": 44, "waist": 38, "length": 27, "sleeve": 33, "shoulder": 18.5}'),
  ('H&M', 'upper_body', 'XL', '{"chest": 48, "waist": 42, "length": 28, "sleeve": 34, "shoulder": 19.5}'),
  ('H&M', 'upper_body', 'XXL', '{"chest": 52, "waist": 46, "length": 29, "sleeve": 35, "shoulder": 20.5}'),
  ('H&M', 'lower_body', 'XS', '{"waist": 28, "hips": 36, "inseam": 30, "rise": 9}'),
  ('H&M', 'lower_body', 'S', '{"waist": 30, "hips": 38, "inseam": 30, "rise": 9.5}'),
  ('H&M', 'lower_body', 'M', '{"waist": 34, "hips": 42, "inseam": 31, "rise": 10}'),
  ('H&M', 'lower_body', 'L', '{"waist": 38, "hips": 46, "inseam": 31, "rise": 10.5}'),
  ('H&M', 'lower_body', 'XL', '{"waist": 42, "hips": 50, "inseam": 32, "rise": 11}'),
  ('H&M', 'lower_body', 'XXL', '{"waist": 46, "hips": 54, "inseam": 32, "rise": 11.5}'),
  ('H&M', 'dresses', 'XS', '{"chest": 34, "waist": 28, "hips": 36, "length": 36}'),
  ('H&M', 'dresses', 'S', '{"chest": 36, "waist": 30, "hips": 38, "length": 37}'),
  ('H&M', 'dresses', 'M', '{"chest": 40, "waist": 34, "hips": 42, "length": 38}'),
  ('H&M', 'dresses', 'L', '{"chest": 44, "waist": 38, "hips": 46, "length": 39}'),
  ('H&M', 'dresses', 'XL', '{"chest": 48, "waist": 42, "hips": 50, "length": 40}'),
  ('H&M', 'dresses', 'XXL', '{"chest": 52, "waist": 46, "hips": 54, "length": 41}')
ON CONFLICT (brand_name, category, size_label) DO NOTHING;

-- Nike
INSERT INTO public.brand_size_charts (brand_name, category, size_label, measurements) VALUES
  ('Nike', 'upper_body', 'XS', '{"chest": 35, "waist": 29, "length": 25, "sleeve": 31, "shoulder": 16}'),
  ('Nike', 'upper_body', 'S', '{"chest": 37, "waist": 31, "length": 26, "sleeve": 32, "shoulder": 16.5}'),
  ('Nike', 'upper_body', 'M', '{"chest": 41, "waist": 35, "length": 27, "sleeve": 33, "shoulder": 17.5}'),
  ('Nike', 'upper_body', 'L', '{"chest": 45, "waist": 39, "length": 28, "sleeve": 34, "shoulder": 18.5}'),
  ('Nike', 'upper_body', 'XL', '{"chest": 49, "waist": 43, "length": 29, "sleeve": 35, "shoulder": 19.5}'),
  ('Nike', 'upper_body', 'XXL', '{"chest": 53, "waist": 47, "length": 30, "sleeve": 36, "shoulder": 20.5}'),
  ('Nike', 'lower_body', 'XS', '{"waist": 29, "hips": 37, "inseam": 30, "rise": 9}'),
  ('Nike', 'lower_body', 'S', '{"waist": 31, "hips": 39, "inseam": 30, "rise": 9.5}'),
  ('Nike', 'lower_body', 'M', '{"waist": 35, "hips": 43, "inseam": 31, "rise": 10}'),
  ('Nike', 'lower_body', 'L', '{"waist": 39, "hips": 47, "inseam": 31, "rise": 10.5}'),
  ('Nike', 'lower_body', 'XL', '{"waist": 43, "hips": 51, "inseam": 32, "rise": 11}'),
  ('Nike', 'lower_body', 'XXL', '{"waist": 47, "hips": 55, "inseam": 32, "rise": 11.5}'),
  ('Nike', 'dresses', 'XS', '{"chest": 35, "waist": 29, "hips": 37, "length": 36}'),
  ('Nike', 'dresses', 'S', '{"chest": 37, "waist": 31, "hips": 39, "length": 37}'),
  ('Nike', 'dresses', 'M', '{"chest": 41, "waist": 35, "hips": 43, "length": 38}'),
  ('Nike', 'dresses', 'L', '{"chest": 45, "waist": 39, "hips": 47, "length": 39}'),
  ('Nike', 'dresses', 'XL', '{"chest": 49, "waist": 43, "hips": 51, "length": 40}'),
  ('Nike', 'dresses', 'XXL', '{"chest": 53, "waist": 47, "hips": 55, "length": 41}')
ON CONFLICT (brand_name, category, size_label) DO NOTHING;

-- Adidas
INSERT INTO public.brand_size_charts (brand_name, category, size_label, measurements) VALUES
  ('Adidas', 'upper_body', 'XS', '{"chest": 34, "waist": 28, "length": 24, "sleeve": 30, "shoulder": 15.5}'),
  ('Adidas', 'upper_body', 'S', '{"chest": 36, "waist": 30, "length": 25, "sleeve": 31, "shoulder": 16}'),
  ('Adidas', 'upper_body', 'M', '{"chest": 40, "waist": 34, "length": 26, "sleeve": 32, "shoulder": 17}'),
  ('Adidas', 'upper_body', 'L', '{"chest": 44, "waist": 38, "length": 27, "sleeve": 33, "shoulder": 18}'),
  ('Adidas', 'upper_body', 'XL', '{"chest": 48, "waist": 42, "length": 28, "sleeve": 34, "shoulder": 19}'),
  ('Adidas', 'upper_body', 'XXL', '{"chest": 52, "waist": 46, "length": 29, "sleeve": 35, "shoulder": 20}'),
  ('Adidas', 'lower_body', 'XS', '{"waist": 28, "hips": 36, "inseam": 30, "rise": 9}'),
  ('Adidas', 'lower_body', 'S', '{"waist": 30, "hips": 38, "inseam": 30, "rise": 9.5}'),
  ('Adidas', 'lower_body', 'M', '{"waist": 34, "hips": 42, "inseam": 31, "rise": 10}'),
  ('Adidas', 'lower_body', 'L', '{"waist": 38, "hips": 46, "inseam": 31, "rise": 10.5}'),
  ('Adidas', 'lower_body', 'XL', '{"waist": 42, "hips": 50, "inseam": 32, "rise": 11}'),
  ('Adidas', 'lower_body', 'XXL', '{"waist": 46, "hips": 54, "inseam": 32, "rise": 11.5}'),
  ('Adidas', 'dresses', 'XS', '{"chest": 34, "waist": 28, "hips": 36, "length": 36}'),
  ('Adidas', 'dresses', 'S', '{"chest": 36, "waist": 30, "hips": 38, "length": 37}'),
  ('Adidas', 'dresses', 'M', '{"chest": 40, "waist": 34, "hips": 42, "length": 38}'),
  ('Adidas', 'dresses', 'L', '{"chest": 44, "waist": 38, "hips": 46, "length": 39}'),
  ('Adidas', 'dresses', 'XL', '{"chest": 48, "waist": 42, "hips": 50, "length": 40}'),
  ('Adidas', 'dresses', 'XXL', '{"chest": 52, "waist": 46, "hips": 54, "length": 41}')
ON CONFLICT (brand_name, category, size_label) DO NOTHING;

-- Uniqlo
INSERT INTO public.brand_size_charts (brand_name, category, size_label, measurements) VALUES
  ('Uniqlo', 'upper_body', 'XS', '{"chest": 35, "waist": 29, "length": 24, "sleeve": 30, "shoulder": 16}'),
  ('Uniqlo', 'upper_body', 'S', '{"chest": 37, "waist": 31, "length": 25, "sleeve": 31, "shoulder": 16.5}'),
  ('Uniqlo', 'upper_body', 'M', '{"chest": 41, "waist": 35, "length": 26, "sleeve": 32, "shoulder": 17.5}'),
  ('Uniqlo', 'upper_body', 'L', '{"chest": 45, "waist": 39, "length": 27, "sleeve": 33, "shoulder": 18.5}'),
  ('Uniqlo', 'upper_body', 'XL', '{"chest": 49, "waist": 43, "length": 28, "sleeve": 34, "shoulder": 19.5}'),
  ('Uniqlo', 'upper_body', 'XXL', '{"chest": 53, "waist": 47, "length": 29, "sleeve": 35, "shoulder": 20.5}'),
  ('Uniqlo', 'lower_body', 'XS', '{"waist": 29, "hips": 37, "inseam": 30, "rise": 9}'),
  ('Uniqlo', 'lower_body', 'S', '{"waist": 31, "hips": 39, "inseam": 30, "rise": 9.5}'),
  ('Uniqlo', 'lower_body', 'M', '{"waist": 35, "hips": 43, "inseam": 31, "rise": 10}'),
  ('Uniqlo', 'lower_body', 'L', '{"waist": 39, "hips": 47, "inseam": 31, "rise": 10.5}'),
  ('Uniqlo', 'lower_body', 'XL', '{"waist": 43, "hips": 51, "inseam": 32, "rise": 11}'),
  ('Uniqlo', 'lower_body', 'XXL', '{"waist": 47, "hips": 55, "inseam": 32, "rise": 11.5}'),
  ('Uniqlo', 'dresses', 'XS', '{"chest": 35, "waist": 29, "hips": 37, "length": 36}'),
  ('Uniqlo', 'dresses', 'S', '{"chest": 37, "waist": 31, "hips": 39, "length": 37}'),
  ('Uniqlo', 'dresses', 'M', '{"chest": 41, "waist": 35, "hips": 43, "length": 38}'),
  ('Uniqlo', 'dresses', 'L', '{"chest": 45, "waist": 39, "hips": 47, "length": 39}'),
  ('Uniqlo', 'dresses', 'XL', '{"chest": 49, "waist": 43, "hips": 51, "length": 40}'),
  ('Uniqlo', 'dresses', 'XXL', '{"chest": 53, "waist": 47, "hips": 55, "length": 41}')
ON CONFLICT (brand_name, category, size_label) DO NOTHING;

-- Zara
INSERT INTO public.brand_size_charts (brand_name, category, size_label, measurements) VALUES
  ('Zara', 'upper_body', 'XS', '{"chest": 33, "waist": 27, "length": 23, "sleeve": 29, "shoulder": 15.5}'),
  ('Zara', 'upper_body', 'S', '{"chest": 35, "waist": 29, "length": 24, "sleeve": 30, "shoulder": 16}'),
  ('Zara', 'upper_body', 'M', '{"chest": 39, "waist": 33, "length": 25, "sleeve": 31, "shoulder": 17}'),
  ('Zara', 'upper_body', 'L', '{"chest": 43, "waist": 37, "length": 26, "sleeve": 32, "shoulder": 18}'),
  ('Zara', 'upper_body', 'XL', '{"chest": 47, "waist": 41, "length": 27, "sleeve": 33, "shoulder": 19}'),
  ('Zara', 'lower_body', 'XS', '{"waist": 27, "hips": 35, "inseam": 30, "rise": 8.5}'),
  ('Zara', 'lower_body', 'S', '{"waist": 29, "hips": 37, "inseam": 30, "rise": 9}'),
  ('Zara', 'lower_body', 'M', '{"waist": 33, "hips": 41, "inseam": 31, "rise": 9.5}'),
  ('Zara', 'lower_body', 'L', '{"waist": 37, "hips": 45, "inseam": 31, "rise": 10}'),
  ('Zara', 'lower_body', 'XL', '{"waist": 41, "hips": 49, "inseam": 32, "rise": 10.5}'),
  ('Zara', 'dresses', 'XS', '{"chest": 33, "waist": 27, "hips": 35, "length": 35}'),
  ('Zara', 'dresses', 'S', '{"chest": 35, "waist": 29, "hips": 37, "length": 36}'),
  ('Zara', 'dresses', 'M', '{"chest": 39, "waist": 33, "hips": 41, "length": 37}'),
  ('Zara', 'dresses', 'L', '{"chest": 43, "waist": 37, "hips": 45, "length": 38}'),
  ('Zara', 'dresses', 'XL', '{"chest": 47, "waist": 41, "hips": 49, "length": 39}')
ON CONFLICT (brand_name, category, size_label) DO NOTHING;
