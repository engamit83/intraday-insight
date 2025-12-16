-- Add Sharekhan OAuth token columns to user_settings (if not already present)
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS sharekhan_access_token TEXT,
ADD COLUMN IF NOT EXISTS sharekhan_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS sharekhan_token_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sharekhan_token_expiry TIMESTAMPTZ;