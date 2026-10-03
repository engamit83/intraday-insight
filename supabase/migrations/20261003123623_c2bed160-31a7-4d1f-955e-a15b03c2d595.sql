CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE TABLE public.internal_job_tokens (name text PRIMARY KEY, token text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.internal_job_tokens TO service_role;
REVOKE ALL ON public.internal_job_tokens FROM anon, authenticated;
ALTER TABLE public.internal_job_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages job tokens" ON public.internal_job_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);