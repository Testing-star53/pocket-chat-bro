
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by all authed" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
  uname text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1), 'user'), '[^a-z0-9_]', '', 'g'));
  if length(base) < 3 then base := base || 'user'; end if;
  uname := base;
  while exists(select 1 from public.profiles where username = uname) loop
    n := n + 1;
    uname := base || n::text;
  end loop;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', uname), new.raw_user_meta_data->>'avatar_url');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- CONVERSATIONS
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_ai boolean not null default false,
  ai_owner uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
grant select, insert, update on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;

-- PARTICIPANTS
create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
grant select, insert, delete on public.conversation_participants to authenticated;
grant all on public.conversation_participants to service_role;
alter table public.conversation_participants enable row level security;

-- security-definer membership check (avoid recursive RLS)
create or replace function public.is_participant(_conv uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.conversation_participants where conversation_id = _conv and user_id = _user)
$$;

create policy "see own conversations" on public.conversations for select to authenticated
  using (public.is_participant(id, auth.uid()) or ai_owner = auth.uid());
create policy "create conversations" on public.conversations for insert to authenticated with check (true);
create policy "update own conversations" on public.conversations for update to authenticated
  using (public.is_participant(id, auth.uid()) or ai_owner = auth.uid());

create policy "see own memberships" on public.conversation_participants for select to authenticated
  using (user_id = auth.uid() or public.is_participant(conversation_id, auth.uid()));
create policy "join conversations" on public.conversation_participants for insert to authenticated with check (true);
create policy "leave conversations" on public.conversation_participants for delete to authenticated using (user_id = auth.uid());

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  message_text text not null,
  is_ai boolean not null default false,
  read_status boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.messages(conversation_id, created_at);
grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create policy "read messages in own convs" on public.messages for select to authenticated
  using (
    public.is_participant(conversation_id, auth.uid())
    or exists(select 1 from public.conversations c where c.id = conversation_id and c.ai_owner = auth.uid())
  );
create policy "send messages to own convs" on public.messages for insert to authenticated
  with check (
    (sender_id = auth.uid() or sender_id is null)
    and (
      public.is_participant(conversation_id, auth.uid())
      or exists(select 1 from public.conversations c where c.id = conversation_id and c.ai_owner = auth.uid())
    )
  );
create policy "update read status" on public.messages for update to authenticated
  using (
    public.is_participant(conversation_id, auth.uid())
    or exists(select 1 from public.conversations c where c.id = conversation_id and c.ai_owner = auth.uid())
  );

create or replace function public.bump_conversation_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end; $$;
create trigger trg_bump_conv_last after insert on public.messages for each row execute function public.bump_conversation_last_message();

-- TYPING
create table public.typing_status (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
grant select, insert, update, delete on public.typing_status to authenticated;
grant all on public.typing_status to service_role;
alter table public.typing_status enable row level security;
create policy "see typing in own convs" on public.typing_status for select to authenticated
  using (public.is_participant(conversation_id, auth.uid()));
create policy "write own typing" on public.typing_status for insert to authenticated with check (user_id = auth.uid());
create policy "update own typing" on public.typing_status for update to authenticated using (user_id = auth.uid());
create policy "delete own typing" on public.typing_status for delete to authenticated using (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.typing_status;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_participants;

-- helper: start or get a 1:1 conversation by username
create or replace function public.start_direct_conversation(_other_username text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  other uuid;
  conv uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select id into other from public.profiles where username = lower(_other_username);
  if other is null then raise exception 'user not found'; end if;
  if other = me then raise exception 'cannot chat with yourself'; end if;

  select cp1.conversation_id into conv
  from public.conversation_participants cp1
  join public.conversation_participants cp2 on cp1.conversation_id = cp2.conversation_id
  join public.conversations c on c.id = cp1.conversation_id
  where cp1.user_id = me and cp2.user_id = other and c.is_ai = false
  limit 1;

  if conv is null then
    insert into public.conversations (is_ai) values (false) returning id into conv;
    insert into public.conversation_participants (conversation_id, user_id) values (conv, me), (conv, other);
  end if;
  return conv;
end; $$;
grant execute on function public.start_direct_conversation(text) to authenticated;

create or replace function public.get_or_create_ai_conversation()
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); conv uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select id into conv from public.conversations where is_ai = true and ai_owner = me limit 1;
  if conv is null then
    insert into public.conversations (is_ai, ai_owner) values (true, me) returning id into conv;
  end if;
  return conv;
end; $$;
grant execute on function public.get_or_create_ai_conversation() to authenticated;
