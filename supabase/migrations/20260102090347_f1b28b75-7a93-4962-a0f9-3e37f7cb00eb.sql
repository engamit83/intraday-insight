-- Create scripcodes table for storing Sharekhan scrip master data
CREATE TABLE public.scripcodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  scrip_code INTEGER NOT NULL,
  exchange TEXT NOT NULL DEFAULT 'NC',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scripcodes ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read scripcodes (public reference data)
CREATE POLICY "Scripcodes are viewable by everyone" 
ON public.scripcodes 
FOR SELECT 
USING (true);

-- Allow service role to manage scripcodes
CREATE POLICY "Service role can manage scripcodes" 
ON public.scripcodes 
FOR ALL 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_scripcodes_symbol ON public.scripcodes(symbol);
CREATE INDEX idx_scripcodes_scrip_code ON public.scripcodes(scrip_code);