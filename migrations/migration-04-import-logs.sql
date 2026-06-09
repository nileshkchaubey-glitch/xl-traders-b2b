-- Migration 04: Import Logs table
-- Run manually against your Supabase project SQL editor

CREATE TABLE IF NOT EXISTS public.import_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  source      TEXT,
  rows_total  INTEGER,
  inserted    INTEGER DEFAULT 0,
  updated     INTEGER DEFAULT 0,
  skipped     INTEGER DEFAULT 0,
  errors      JSONB DEFAULT '[]'
);

-- RLS: enable — only authenticated users can read/write
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can manage import logs"
  ON public.import_logs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
