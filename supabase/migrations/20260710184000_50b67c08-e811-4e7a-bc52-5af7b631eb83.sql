
-- Drop existing chat tables to rebuild cleanly
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.typing_status CASCADE;
DROP TABLE IF EXISTS public.reactions CASCADE;

-- Drop old helper functions
DROP FUNCTION IF EXISTS public.get_or_create_ai_conversation() CASCADE;
DROP FUNCTION IF EXISTS public.is_participant(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.start_direct_conversation(text) CASCADE;
DROP FUNCTION IF EXISTS public.bump_conversation_last_message() CASCADE;

-- Extend profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_base64 text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();

-- Messages (shared room)
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  type text NOT NULL DEFAULT 'text',
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  is_edited boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_for uuid[] NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_created_at_idx ON public.messages (created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authed read messages" ON public.messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed send own messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "authed update messages" ON public.messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authed delete own messages" ON public.messages
  FOR DELETE TO authenticated USING (sender_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Reactions
CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authed read reactions" ON public.reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed insert own reactions" ON public.reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "authed delete own reactions" ON public.reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;

-- Typing status
CREATE TABLE public.typing_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.typing_status TO authenticated;
GRANT ALL ON public.typing_status TO service_role;

ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authed read typing" ON public.typing_status
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed upsert own typing" ON public.typing_status
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "authed update own typing" ON public.typing_status
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "authed delete own typing" ON public.typing_status
  FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_status;

-- Auto-delete: messages older than 6 hours
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-delete-messages-6h') THEN
    PERFORM cron.unschedule('auto-delete-messages-6h');
  END IF;
END$$;

SELECT cron.schedule(
  'auto-delete-messages-6h',
  '*/15 * * * *',
  $$ DELETE FROM public.messages WHERE created_at < now() - interval '6 hours' $$
);
