create extension if not exists pgcrypto;

create type public.lobby_visibility as enum ('private', 'friends', 'public');
create type public.lobby_status as enum ('waiting', 'starting', 'in_match', 'closed');
create type public.member_status as enum ('joined', 'ready', 'disconnected', 'left');
create type public.match_status as enum ('pending', 'running', 'completed', 'abandoned', 'invalid');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Obrera anónima' check (char_length(display_name) between 2 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_request_distinct check (sender_id <> receiver_id),
  constraint friend_request_unique unique (sender_id, receiver_id)
);

create table public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint friendship_ordered check (user_a < user_b)
);

create table public.lobbies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  visibility public.lobby_visibility not null default 'private',
  status public.lobby_status not null default 'waiting',
  max_players smallint not null default 4 check (max_players between 1 and 4),
  seed bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);

create table public.lobby_members (
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  status public.member_status not null default 'joined',
  responsibility text check (responsibility in ('forage', 'brood', 'fungus', 'defense', 'routes')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (lobby_id, player_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid references public.lobbies(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  seed bigint not null,
  protocol_version integer not null default 1 check (protocol_version > 0),
  tick_rate smallint not null default 10 check (tick_rate between 5 and 30),
  status public.match_status not null default 'pending',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  faction text not null check (faction in ('acromyrmex', 'vespula', 'bombus', 'porotermes', 'spectator')),
  team smallint not null default 1 check (team between 1 and 4),
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  last_ack_tick bigint not null default 0 check (last_ack_tick >= 0),
  disconnected_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create table public.match_command_batches (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  sequence_from bigint not null check (sequence_from >= 0),
  sequence_to bigint not null check (sequence_to >= sequence_from),
  tick_from bigint not null check (tick_from >= 0),
  tick_to bigint not null check (tick_to >= tick_from),
  commands jsonb not null check (jsonb_typeof(commands) = 'array' and jsonb_array_length(commands) between 1 and 64),
  checksum_before text not null check (checksum_before ~ '^[0-9a-f]{8}$'),
  created_at timestamptz not null default now(),
  unique (match_id, player_id, sequence_from)
);

create table public.match_snapshots (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  tick bigint not null check (tick >= 0),
  checksum text not null check (checksum ~ '^[0-9a-f]{8}$'),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_by uuid references public.profiles(id) on delete set null,
  validated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, tick)
);

create table public.match_results (
  match_id uuid primary key references public.matches(id) on delete cascade,
  winning_team smallint check (winning_team between 1 and 4),
  reason text not null check (char_length(reason) between 1 and 160),
  final_tick bigint not null check (final_tick >= 0),
  final_checksum text not null check (final_checksum ~ '^[0-9a-f]{8}$'),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.progression (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  collective_knowledge integer not null default 0 check (collective_knowledge >= 0),
  matches_completed integer not null default 0 check (matches_completed >= 0),
  updated_at timestamptz not null default now()
);

create table public.species_unlocks (
  player_id uuid not null references public.profiles(id) on delete cascade,
  species_id text not null check (species_id in ('acromyrmex-lobicornis', 'vespula-germanica', 'bombus-dahlbomii', 'porotermes-quadricollis')),
  unlocked_at timestamptz not null default now(),
  primary key (player_id, species_id)
);

create table public.player_settings (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 16384),
  updated_at timestamptz not null default now()
);

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  category text not null check (category in ('gameplay', 'sync', 'performance', 'biology', 'accessibility', 'other')),
  summary text not null check (char_length(summary) between 8 and 120),
  details text not null check (char_length(details) between 1 and 4000),
  diagnostic jsonb not null default '{}'::jsonb check (jsonb_typeof(diagnostic) = 'object' and pg_column_size(diagnostic) < 65536),
  created_at timestamptz not null default now()
);

create index lobbies_owner_idx on public.lobbies(owner_id);
create index lobbies_expires_idx on public.lobbies(expires_at) where status = 'waiting';
create index lobby_members_player_idx on public.lobby_members(player_id, lobby_id);
create index match_players_player_idx on public.match_players(player_id, match_id);
create index command_batches_match_tick_idx on public.match_command_batches(match_id, tick_from, tick_to);
create index snapshots_match_tick_idx on public.match_snapshots(match_id, tick desc);
create index bug_reports_match_idx on public.bug_reports(match_id) where match_id is not null;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger lobbies_touch before update on public.lobbies for each row execute function public.touch_updated_at();
create trigger lobby_members_touch before update on public.lobby_members for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.player_settings for each row execute function public.touch_updated_at();

create or replace function public.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id) values (new.id);
  insert into public.progression(player_id) values (new.id);
  insert into public.species_unlocks(player_id, species_id) values (new.id, 'acromyrmex-lobicornis');
  return new;
end; $$;
create trigger auth_user_created after insert on auth.users for each row execute function public.on_auth_user_created();

create or replace function public.create_lobby(p_visibility public.lobby_visibility default 'private', p_max_players smallint default 4)
returns public.lobbies language plpgsql security definer set search_path = public as $$
declare created public.lobbies; generated_code text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_max_players not between 1 and 4 then raise exception 'invalid player limit'; end if;
  loop
    generated_code := upper(substr(encode(gen_random_bytes(6), 'base64'), 1, 6));
    generated_code := translate(generated_code, '01+/IO', '2345XY');
    exit when generated_code ~ '^[A-Z2-9]{6}$' and not exists(select 1 from public.lobbies where code = generated_code);
  end loop;
  insert into public.lobbies(code, owner_id, visibility, max_players, seed)
  values (generated_code, auth.uid(), p_visibility, p_max_players, floor(random() * 2147483647)::bigint)
  returning * into created;
  insert into public.lobby_members(lobby_id, player_id) values (created.id, auth.uid());
  return created;
end; $$;

create or replace function public.join_lobby(p_code text) returns public.lobby_members
language plpgsql security definer set search_path = public as $$
declare target public.lobbies; member public.lobby_members; active_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into target from public.lobbies where code = upper(p_code) and status = 'waiting' and expires_at > now() for update;
  if target.id is null then raise exception 'lobby unavailable'; end if;
  select count(*) into active_count from public.lobby_members where lobby_id = target.id and status <> 'left';
  if active_count >= target.max_players and not exists(select 1 from public.lobby_members where lobby_id = target.id and player_id = auth.uid()) then raise exception 'lobby full'; end if;
  insert into public.lobby_members(lobby_id, player_id) values (target.id, auth.uid())
  on conflict (lobby_id, player_id) do update set status = 'joined', updated_at = now()
  returning * into member;
  return member;
end; $$;

create or replace function public.cleanup_abandoned_lobbies() returns integer
language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  update public.lobbies set status = 'closed' where status = 'waiting' and expires_at < now();
  get diagnostics affected = row_count;
  return affected;
end; $$;

revoke all on function public.cleanup_abandoned_lobbies() from public, anon, authenticated;
grant execute on function public.create_lobby(public.lobby_visibility, smallint) to authenticated;
grant execute on function public.join_lobby(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.lobbies enable row level security;
alter table public.lobby_members enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_command_batches enable row level security;
alter table public.match_snapshots enable row level security;
alter table public.match_results enable row level security;
alter table public.progression enable row level security;
alter table public.species_unlocks enable row level security;
alter table public.player_settings enable row level security;
alter table public.bug_reports enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy requests_read_party on public.friend_requests for select to authenticated using (auth.uid() in (sender_id, receiver_id));
create policy requests_insert_self on public.friend_requests for insert to authenticated with check (sender_id = auth.uid());
create policy requests_update_receiver on public.friend_requests for update to authenticated using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());
create policy friendships_read_party on public.friendships for select to authenticated using (auth.uid() in (user_a, user_b));

create policy lobbies_read_member_or_public on public.lobbies for select to authenticated using (
  visibility = 'public' or owner_id = auth.uid() or exists(select 1 from public.lobby_members lm where lm.lobby_id = id and lm.player_id = auth.uid() and lm.status <> 'left')
);
create policy lobbies_update_owner on public.lobbies for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy lobby_members_read_members on public.lobby_members for select to authenticated using (
  exists(select 1 from public.lobby_members self where self.lobby_id = lobby_id and self.player_id = auth.uid() and self.status <> 'left')
);
create policy lobby_members_update_self on public.lobby_members for update to authenticated using (player_id = auth.uid()) with check (player_id = auth.uid());

create policy matches_read_participant on public.matches for select to authenticated using (exists(select 1 from public.match_players mp where mp.match_id = id and mp.player_id = auth.uid()));
create policy match_players_read_participant on public.match_players for select to authenticated using (exists(select 1 from public.match_players self where self.match_id = match_id and self.player_id = auth.uid()));
create policy match_players_update_self on public.match_players for update to authenticated using (player_id = auth.uid()) with check (player_id = auth.uid());
create policy commands_read_participant on public.match_command_batches for select to authenticated using (exists(select 1 from public.match_players mp where mp.match_id = match_id and mp.player_id = auth.uid()));
create policy commands_insert_self on public.match_command_batches for insert to authenticated with check (player_id = auth.uid() and exists(select 1 from public.match_players mp where mp.match_id = match_id and mp.player_id = auth.uid()));
create policy snapshots_read_participant on public.match_snapshots for select to authenticated using (exists(select 1 from public.match_players mp where mp.match_id = match_id and mp.player_id = auth.uid()));
create policy snapshots_insert_participant on public.match_snapshots for insert to authenticated with check (created_by = auth.uid() and exists(select 1 from public.match_players mp where mp.match_id = match_id and mp.player_id = auth.uid()));
create policy results_read_participant on public.match_results for select to authenticated using (exists(select 1 from public.match_players mp where mp.match_id = match_id and mp.player_id = auth.uid()));

create policy progression_self on public.progression for select to authenticated using (player_id = auth.uid());
create policy unlocks_self on public.species_unlocks for select to authenticated using (player_id = auth.uid());
create policy settings_self_read on public.player_settings for select to authenticated using (player_id = auth.uid());
create policy settings_self_insert on public.player_settings for insert to authenticated with check (player_id = auth.uid());
create policy settings_self_update on public.player_settings for update to authenticated using (player_id = auth.uid()) with check (player_id = auth.uid());
create policy bug_insert_self on public.bug_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy bug_read_self on public.bug_reports for select to authenticated using (reporter_id = auth.uid());

alter publication supabase_realtime add table public.lobbies, public.lobby_members, public.matches, public.match_players;
