
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any prior schedule with same name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-delete-messages-6h') THEN
    PERFORM cron.unschedule('auto-delete-messages-6h');
  END IF;
END$$;

-- Schedule auto-delete of messages older than 6 hours, runs every 15 minutes
SELECT cron.schedule(
  'auto-delete-messages-6h',
  '*/15 * * * *',
  $$ DELETE FROM public.messages WHERE created_at < now() - interval '6 hours' $$
);
