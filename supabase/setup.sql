-- ============================================================
-- Phone Phoebe — Email Nurture Setup
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the nurture tracking table
CREATE TABLE IF NOT EXISTS public.email_nurture (
  id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid         UNIQUE,
  email         text         NOT NULL,
  first_name    text         DEFAULT 'there',
  confirmed_at  timestamptz  NOT NULL DEFAULT now(),
  emails_sent   int[]        DEFAULT '{}',
  trial_converted boolean    DEFAULT false,
  created_at    timestamptz  DEFAULT now()
);

ALTER TABLE public.email_nurture ENABLE ROW LEVEL SECURITY;

-- 3. Trigger function: fires when a user confirms their email
--    Calls the on-signup Edge Function via pg_net HTTP POST
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    PERFORM net.http_post(
      url     := 'https://lrxuflxfnyiqzjqzjcsa.supabase.co/functions/v1/on-signup',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyeHVmbHhmbnlpcXpqcXpqY3NhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg1Mzg4NSwiZXhwIjoyMDk3NDI5ODg1fQ.oZGsH9vCSGjpb1U6IF_krU3LWw1wEVsvk-hYpVsir9k'
      ),
      body    := jsonb_build_object(
        'user_id',    NEW.id::text,
        'email',      NEW.email,
        'first_name', COALESCE(NEW.raw_user_meta_data->>'full_name', 'there')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;
CREATE TRIGGER on_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_confirmed();

-- 5. Schedule send-nurture to run every hour
--    (removes the old job if it exists, then creates fresh)
SELECT cron.unschedule('send-nurture-emails') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-nurture-emails'
);

SELECT cron.schedule(
  'send-nurture-emails',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://lrxuflxfnyiqzjqzjcsa.supabase.co/functions/v1/send-nurture',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyeHVmbHhmbnlpcXpqcXpqY3NhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg1Mzg4NSwiZXhwIjoyMDk3NDI5ODg1fQ.oZGsH9vCSGjpb1U6IF_krU3LWw1wEVsvk-hYpVsir9k'
    ),
    body    := '{}'::jsonb
  );
  $$
);
