-- PROFILES
create table if not exists public.profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  avatar_base64 text,
  display_name text,
  last_seen timestamptz,
  is_online boolean default false,
  created_at timestamptz not null default now()
);

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "profiles readable by all authed" on public.profiles
  for select to authenticated using (true);

create policy "users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
  uname text;
  n int := 0;
begin
  base := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'user'),
    '[^a-z0-9_]', '', 'g'
  ));
  if length(base) < 3 then base := base || 'user'; end if;
  uname := base;
  while exists(select 1 from public.profiles where username = uname) loop
    n := n + 1;
    uname := base || n::text;
  end loop;
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'full_name', uname));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row
  execute function public.handle_new_user();

-- MESSAGES
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references profiles(id) not null,
  content text,
  type text default 'text' check (type in ('text', 'image', 'audio')),
  reply_to uuid references messages(id),
  is_edited boolean default false,
  is_deleted boolean default false,
  deleted_for uuid[] default '{}',
  is_read boolean default false,
  created_at timestamptz default now()
);

create index on public.messages(created_at);

grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;

alter table public.messages enable row level security;

create policy "messages readable by all authed" on public.messages
  for select to authenticated using (true);

create policy "messages insert own" on public.messages
  for insert to authenticated with check (sender_id = auth.uid());

create policy "messages update own" on public.messages
  for update to authenticated using (sender_id = auth.uid() or is_read = true);

-- REACTIONS
create table if not exists public.reactions (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references messages(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  emoji text not null,
  created_at timestamptz default now()
);

grant select, insert, delete on public.reactions to authenticated;
grant all on public.reactions to service_role;

alter table public.reactions enable row level security;

create policy "reactions readable by all authed" on public.reactions
  for select to authenticated using (true);

create policy "reactions insert own" on public.reactions
  for insert to authenticated with check (user_id = auth.uid());

create policy "reactions delete own" on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- TYPING STATUS
create table if not exists public.typing_status (
  user_id uuid references profiles(id) primary key,
  is_typing boolean default false,
  updated_at timestamptz default now()
);

grant select, insert, update on public.typing_status to authenticated;
grant all on public.typing_status to service_role;

alter table public.typing_status enable row level security;

create policy "typing readable by all authed" on public.typing_status
  for select to authenticated using (true);

create policy "typing upsert own" on public.typing_status
  for insert to authenticated with check (user_id = auth.uid());

create policy "typing update own" on public.typing_status
  for update to authenticated using (user_id = auth.uid());

-- FUNCTION: Check if max 2 users
create or replace function public.can_register()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  cnt int;
begin
  select count(*) into cnt from public.profiles;
  return cnt < 2;
end; $$;

grant execute on function public.can_register() to anon, authenticated;

-- ENABLE REALTIME
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.typing_status;
alter publication supabase_realtime add table public.profiles;
