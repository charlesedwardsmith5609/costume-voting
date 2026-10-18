-- Costume contest: schema, RLS, grants, storage bucket, and the Postgres functions that own every
-- multi-step write. Run once in the Supabase SQL editor (production and test projects).
--
-- Ownership: Postgres owns all shared state. Route handlers call these functions with the
-- service role; anon/authenticated/public get no table access and no function execute.
-- The projects have "Automatically expose new tables" disabled, so service_role gets explicit
-- grants below.
-- Business outcomes (closed, rate limited, invalid) are returned as a status, not raised, so
-- the rate-limit increment for a rejected request is kept.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.settings (
  id int primary key default 1 check (id = 1),
  voting_opens_at timestamptz,
  voting_closes_at timestamptz
);
insert into public.settings (id) values (1);

-- One row per costume. Both names are optional (null when blank); a photo-only nominee is
-- labeled "Mystery guest" by the app.
create table public.nominees (
  id uuid primary key default gen_random_uuid(),
  person_name text check (person_name is null or char_length(person_name) between 1 and 60),
  costume_name text check (costume_name is null or char_length(costume_name) between 1 and 60),
  photo_path text not null,
  created_by_device uuid not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
-- Backs up the freshness check in photo_is_fresh against two requests claiming the same upload.
create unique index nominees_photo_path_key on public.nominees (photo_path);

-- A nominee appears in every category it has a row for.
create table public.nominee_categories (
  nominee_id uuid not null references public.nominees(id) on delete cascade,
  category text not null check (category in
    ('most_elaborate','most_unique','funniest','best_couples')),
  added_at timestamptz not null default now(),
  primary key (nominee_id, category)
);
create index nominee_categories_category_added_idx on public.nominee_categories (category, added_at);

-- The composite foreign key means a vote can only point at a nominee in that category, and
-- removing a nominee from a category deletes exactly that category's votes for it.
create table public.votes (
  device_id uuid not null,
  category text not null,
  nominee_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (device_id, category),
  foreign key (nominee_id, category)
    references public.nominee_categories (nominee_id, category) on delete cascade
);
create index votes_nominee_category_idx on public.votes (nominee_id, category);

-- Every edit (guest or host, including category changes and undos). device_id is null for the
-- host. Replaced photos are never deleted, so any edit can be undone.
create table public.nominee_edits (
  id bigint generated always as identity primary key,
  nominee_id uuid not null references public.nominees(id) on delete cascade,
  device_id uuid,
  old_person_name text,
  new_person_name text,
  old_costume_name text,
  new_costume_name text,
  old_photo_path text not null,
  new_photo_path text not null,
  added_categories text[] not null default '{}',
  removed_categories text[] not null default '{}',
  undoes_edit_id bigint references public.nominee_edits(id) on delete set null,
  created_at timestamptz not null default now()
);
create index nominee_edits_nominee_idx on public.nominee_edits (nominee_id, id);

-- Fixed 10-minute windows per device and action ('vote', 'nominate', 'edit', 'upload').
create table public.rate_limits (
  device_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (device_id, action, window_start)
);

alter table public.settings enable row level security;
alter table public.nominees enable row level security;
alter table public.nominee_categories enable row level security;
alter table public.votes enable row level security;
alter table public.nominee_edits enable row level security;
alter table public.rate_limits enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Storage: public-read photos, JPEG only (the client always re-encodes to JPEG), 5 MB max.
-- No storage.objects policies, so the bucket cannot be listed or written with the anon key.
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nominee-photos', 'nominee-photos', true, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

create function public.voting_is_open()
returns boolean
language sql stable
set search_path = ''
as $$
  select s.voting_opens_at is not null
     and s.voting_closes_at is not null
     and now() >= s.voting_opens_at
     and now() < s.voting_closes_at
  from public.settings s where s.id = 1;
$$;

-- Counts one request and returns true while the device is within p_max for this window.
-- Also used directly by the upload-URL route.
create function public.check_rate_limit(p_device uuid, p_action text, p_max int)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
  v_count int;
begin
  delete from public.rate_limits
   where device_id = p_device and window_start < v_window - interval '1 hour';

  insert into public.rate_limits as r (device_id, action, window_start, count)
  values (p_device, p_action, v_window, 1)
  on conflict (device_id, action, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  return v_count <= p_max;
end;
$$;

-- True when every element is a known category slug and there are no nulls.
create function public.valid_categories(p_categories text[])
returns boolean
language sql immutable
set search_path = ''
as $$
  select p_categories is not null and not exists (
    select 1 from unnest(p_categories) c
     where c is null or c not in ('most_elaborate','most_unique','funniest','best_couples'));
$$;

-- Trims a name and turns blank into null.
create function public.clean_name(p_name text)
returns text
language sql immutable
set search_path = ''
as $$
  select nullif(btrim(p_name), '');
$$;

-- Validates a cleaned name: null (blank) is fine; otherwise 1-60 characters, no control characters.
create function public.valid_name(p_name text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select p_name is null or (char_length(p_name) between 1 and 60 and p_name !~ '[[:cntrl:]]');
$$;

-- A photo path is usable when it is <prefix>/<uuid>.jpg, the object was uploaded to the photos
-- bucket, and no nominee or edit has ever used it. The prefix is the device ID for guests and
-- 'host' for the admin.
create function public.photo_is_fresh(p_prefix text, p_path text)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_path is not null
     and p_path ~ ('^' || p_prefix || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
     and exists (
       select 1 from storage.objects o
        where o.bucket_id = 'nominee-photos' and o.name = p_path)
     and not exists (select 1 from public.nominees n where n.photo_path = p_path)
     and not exists (
       select 1 from public.nominee_edits e
        where e.old_photo_path = p_path or e.new_photo_path = p_path);
$$;

-- Shared core for every nominee edit. Callers validate their inputs first. Sets both names
-- (already cleaned) and the photo (null keeps the current one), adds and removes categories,
-- and logs one nominee_edits row. Returns {"status": "ok", "edit_id": bigint} or
-- {"status": 'not_found' | 'no_change' | 'last_category'}.
-- p_guest: hidden nominees are not found.
create function public.apply_nominee_edit(
  p_nominee uuid, p_device uuid, p_guest boolean,
  p_person_name text, p_costume_name text, p_photo_path text,
  p_add text[], p_remove text[], p_undoes bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  n public.nominees;
  v_photo text;
  v_add text[];
  v_remove text[];
  v_count int;
  v_edit bigint;
begin
  select * into n from public.nominees where id = p_nominee for update;
  if n.id is null or (p_guest and n.hidden) then
    return jsonb_build_object('status', 'not_found');
  end if;
  v_photo := coalesce(p_photo_path, n.photo_path);

  select coalesce(array_agg(distinct c order by c), '{}') into v_add
    from unnest(coalesce(p_add, '{}')) c
   where not exists (
     select 1 from public.nominee_categories nc where nc.nominee_id = p_nominee and nc.category = c);
  select coalesce(array_agg(distinct c order by c), '{}') into v_remove
    from unnest(coalesce(p_remove, '{}')) c
   where c <> all (v_add) and exists (
     select 1 from public.nominee_categories nc where nc.nominee_id = p_nominee and nc.category = c);

  select count(*) into v_count from public.nominee_categories where nominee_id = p_nominee;
  if v_count + cardinality(v_add) - cardinality(v_remove) < 1 then
    return jsonb_build_object('status', 'last_category');
  end if;

  if n.person_name is not distinct from p_person_name
     and n.costume_name is not distinct from p_costume_name
     and n.photo_path = v_photo
     and cardinality(v_add) = 0 and cardinality(v_remove) = 0 then
    return jsonb_build_object('status', 'no_change');
  end if;

  update public.nominees
     set person_name = p_person_name, costume_name = p_costume_name, photo_path = v_photo
   where id = p_nominee;
  insert into public.nominee_categories (nominee_id, category)
  select p_nominee, c from unnest(v_add) c
  on conflict do nothing;
  -- Cascades to that category's votes for this nominee only.
  delete from public.nominee_categories
   where nominee_id = p_nominee and category = any (v_remove);

  insert into public.nominee_edits (
    nominee_id, device_id,
    old_person_name, new_person_name, old_costume_name, new_costume_name,
    old_photo_path, new_photo_path, added_categories, removed_categories, undoes_edit_id)
  values (
    p_nominee, p_device,
    n.person_name, p_person_name, n.costume_name, p_costume_name,
    n.photo_path, v_photo, v_add, v_remove, p_undoes)
  returning id into v_edit;

  return jsonb_build_object('status', 'ok', 'edit_id', v_edit);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Guest writes: rate limit, then voting window, then validation.
-- ---------------------------------------------------------------------------------------------

-- Returns 'ok' | 'rate_limited' | 'closed' | 'invalid_nominee'.
create function public.cast_vote(p_device uuid, p_category text, p_nominee uuid)
returns text
language plpgsql
set search_path = ''
as $$
begin
  if not public.check_rate_limit(p_device, 'vote', 60) then
    return 'rate_limited';
  end if;
  if not public.voting_is_open() then
    return 'closed';
  end if;
  -- Share-lock the nominee so a concurrent merge, category removal, or hide finishes first
  -- (each holds the nominee row lock while it changes categories or votes). Without this, a vote
  -- committed mid-merge could return 'ok' and then be deleted by the cascade. The category check
  -- runs as a separate statement so it sees the committed result of whatever we waited for.
  perform 1 from public.nominees n where n.id = p_nominee and not n.hidden for share;
  if not found or not exists (
    select 1 from public.nominee_categories nc
     where nc.nominee_id = p_nominee and nc.category = p_category
  ) then
    return 'invalid_nominee';
  end if;

  insert into public.votes (device_id, category, nominee_id)
  values (p_device, p_category, p_nominee)
  on conflict (device_id, category)
  do update set nominee_id = excluded.nominee_id, updated_at = now();
  return 'ok';
end;
$$;

-- Returns {"status": "ok", "id": uuid} or {"status": 'rate_limited' | 'closed' |
-- 'invalid_category' | 'invalid_name' | 'invalid_photo'}.
-- Needs at least one category. The photo must be fresh under this device's prefix.
create function public.create_nominee(
  p_device uuid, p_categories text[], p_person_name text, p_costume_name text, p_photo_path text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_person text := public.clean_name(p_person_name);
  v_costume text := public.clean_name(p_costume_name);
  v_id uuid;
begin
  if not public.check_rate_limit(p_device, 'nominate', 10) then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if not public.voting_is_open() then
    return jsonb_build_object('status', 'closed');
  end if;
  if not public.valid_categories(p_categories) or cardinality(p_categories) = 0 then
    return jsonb_build_object('status', 'invalid_category');
  end if;
  if not public.valid_name(v_person) or not public.valid_name(v_costume) then
    return jsonb_build_object('status', 'invalid_name');
  end if;
  if not public.photo_is_fresh(p_device::text, p_photo_path) then
    return jsonb_build_object('status', 'invalid_photo');
  end if;

  insert into public.nominees (person_name, costume_name, photo_path, created_by_device)
  values (v_person, v_costume, p_photo_path, p_device)
  returning id into v_id;
  insert into public.nominee_categories (nominee_id, category)
  select distinct v_id, c from unnest(p_categories) c;
  return jsonb_build_object('status', 'ok', 'id', v_id);
end;
$$;

-- Adds an existing nominee to one more category (from "Already nominated?"), so nobody
-- re-uploads a photo. Shares the 'edit' rate limit.
-- Returns {"status": "ok", "edit_id": bigint} or {"status": 'rate_limited' | 'closed' |
-- 'invalid_category' | 'not_found' | 'already_in_category'}.
create function public.add_nominee_to_category(p_device uuid, p_nominee uuid, p_category text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  n public.nominees;
  v_res jsonb;
begin
  if not public.check_rate_limit(p_device, 'edit', 10) then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if not public.voting_is_open() then
    return jsonb_build_object('status', 'closed');
  end if;
  if not public.valid_categories(array[p_category]) then
    return jsonb_build_object('status', 'invalid_category');
  end if;
  select * into n from public.nominees where id = p_nominee for update;
  if n.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_res := public.apply_nominee_edit(
    p_nominee, p_device, true, n.person_name, n.costume_name, null,
    array[p_category], '{}', null);
  if v_res->>'status' = 'no_change' then
    return jsonb_build_object('status', 'already_in_category');
  end if;
  return v_res;
end;
$$;

-- Guest edit: sets both names, optionally replaces the photo (null keeps it), and adds
-- categories. Guests cannot remove categories.
-- Returns {"status": "ok", "edit_id": bigint} or {"status": 'rate_limited' | 'closed' |
-- 'invalid_category' | 'invalid_name' | 'invalid_photo' | 'not_found' | 'no_change'}.
create function public.edit_nominee(
  p_device uuid, p_nominee uuid, p_person_name text, p_costume_name text,
  p_photo_path text default null, p_add_categories text[] default '{}')
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_person text := public.clean_name(p_person_name);
  v_costume text := public.clean_name(p_costume_name);
begin
  if not public.check_rate_limit(p_device, 'edit', 10) then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if not public.voting_is_open() then
    return jsonb_build_object('status', 'closed');
  end if;
  if not public.valid_categories(coalesce(p_add_categories, '{}')) then
    return jsonb_build_object('status', 'invalid_category');
  end if;
  if not public.valid_name(v_person) or not public.valid_name(v_costume) then
    return jsonb_build_object('status', 'invalid_name');
  end if;
  if p_photo_path is not null and not public.photo_is_fresh(p_device::text, p_photo_path) then
    return jsonb_build_object('status', 'invalid_photo');
  end if;

  return public.apply_nominee_edit(
    p_nominee, p_device, true, v_person, v_costume, p_photo_path,
    coalesce(p_add_categories, '{}'), '{}', null);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin writes: no voting window or rate limit. Hiding is a plain update of nominees.hidden.
-- ---------------------------------------------------------------------------------------------

-- p_action: 'start' (also used to reopen) opens now for p_minutes; 'extend' sets
-- close = greatest(now, close) + p_minutes, which reopens immediately if already closed;
-- 'end' closes now. Returns the settings row as jsonb, or {"status": "not_started"} /
-- {"status": "invalid"}.
create function public.set_timer(p_action text, p_minutes int default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.settings;
begin
  select * into s from public.settings where id = 1 for update;

  if p_action = 'start' then
    if p_minutes is null or p_minutes not between 1 and 600 then
      return jsonb_build_object('status', 'invalid');
    end if;
    update public.settings
       set voting_opens_at = now(), voting_closes_at = now() + make_interval(mins => p_minutes)
     where id = 1 returning * into s;
  elsif p_action = 'extend' then
    if p_minutes is null or p_minutes not between 1 and 600 then
      return jsonb_build_object('status', 'invalid');
    end if;
    if s.voting_opens_at is null then
      return jsonb_build_object('status', 'not_started');
    end if;
    update public.settings
       set voting_closes_at = greatest(now(), voting_closes_at) + make_interval(mins => p_minutes)
     where id = 1 returning * into s;
  elsif p_action = 'end' then
    if s.voting_opens_at is null then
      return jsonb_build_object('status', 'not_started');
    end if;
    update public.settings
       set voting_closes_at = least(voting_closes_at, now())
     where id = 1 returning * into s;
  else
    return jsonb_build_object('status', 'invalid');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'voting_opens_at', s.voting_opens_at,
    'voting_closes_at', s.voting_closes_at);
end;
$$;

-- Host edit, allowed at any time and on hidden nominees. A replacement photo must be fresh
-- under the 'host' prefix. Same return shape as edit_nominee minus the window and rate limit.
create function public.admin_edit_nominee(
  p_nominee uuid, p_person_name text, p_costume_name text,
  p_photo_path text default null, p_add_categories text[] default '{}')
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_person text := public.clean_name(p_person_name);
  v_costume text := public.clean_name(p_costume_name);
begin
  if not public.valid_categories(coalesce(p_add_categories, '{}')) then
    return jsonb_build_object('status', 'invalid_category');
  end if;
  if not public.valid_name(v_person) or not public.valid_name(v_costume) then
    return jsonb_build_object('status', 'invalid_name');
  end if;
  if p_photo_path is not null and not public.photo_is_fresh('host', p_photo_path) then
    return jsonb_build_object('status', 'invalid_photo');
  end if;

  return public.apply_nominee_edit(
    p_nominee, null, false, v_person, v_costume, p_photo_path,
    coalesce(p_add_categories, '{}'), '{}', null);
end;
$$;

-- Host add or remove of one category. Removing deletes that category's votes for this nominee
-- only, and the last category cannot be removed (hide or delete instead).
-- Returns {"status": "ok", "edit_id": bigint} or {"status": 'invalid_category' | 'not_found' |
-- 'no_change' | 'last_category'}.
create function public.admin_set_category(p_nominee uuid, p_category text, p_present boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  n public.nominees;
begin
  if not public.valid_categories(array[p_category]) or p_present is null then
    return jsonb_build_object('status', 'invalid_category');
  end if;
  select * into n from public.nominees where id = p_nominee for update;
  if n.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  return public.apply_nominee_edit(
    p_nominee, null, false, n.person_name, n.costume_name, null,
    case when p_present then array[p_category] else '{}' end,
    case when p_present then '{}' else array[p_category] end,
    null);
end;
$$;

-- Reverses one edit: restores the names and photo that edit changed (even if later edits
-- changed them again), removes the categories it added (and their votes), and re-adds the
-- categories it removed. The undo is logged as a host edit, so it can be undone too.
-- Returns {"status": "ok", "edit_id": bigint} or {"status": 'not_found' | 'no_change' |
-- 'last_category'}.
create function public.undo_nominee_edit(p_edit_id bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  e public.nominee_edits;
  n public.nominees;
begin
  select * into e from public.nominee_edits where id = p_edit_id;
  if e.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into n from public.nominees where id = e.nominee_id for update;

  return public.apply_nominee_edit(
    e.nominee_id, null, false,
    case when e.old_person_name is distinct from e.new_person_name
         then e.old_person_name else n.person_name end,
    case when e.old_costume_name is distinct from e.new_costume_name
         then e.old_costume_name else n.costume_name end,
    case when e.old_photo_path <> e.new_photo_path then e.old_photo_path end,
    e.removed_categories, e.added_categories, e.id);
end;
$$;

-- Merges p_drop into p_keep: p_keep gains p_drop's categories, p_drop's votes move to p_keep,
-- and p_drop (with its categories and edit history) is deleted. p_keep's names, photo, and
-- hidden flag are kept. The (device_id, category) primary key means a device holds at most one
-- vote per category, so no device ends up with two. p_drop's photo is left in storage.
-- Returns {"status": 'ok' | 'not_found' | 'same_nominee'}.
create function public.merge_nominees(p_keep uuid, p_drop uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if p_keep = p_drop then
    return jsonb_build_object('status', 'same_nominee');
  end if;
  -- Lock in id order so two concurrent merges cannot deadlock.
  perform 1 from public.nominees where id in (p_keep, p_drop) order by id for update;
  if (select count(*) from public.nominees where id in (p_keep, p_drop)) < 2 then
    return jsonb_build_object('status', 'not_found');
  end if;

  insert into public.nominee_categories (nominee_id, category, added_at)
  select p_keep, category, added_at from public.nominee_categories where nominee_id = p_drop
  on conflict do nothing;
  update public.votes set nominee_id = p_keep, updated_at = now() where nominee_id = p_drop;
  delete from public.nominees where id = p_drop;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Clears votes, nominees, edits, rate limits, and the timer. Returns every photo path that was
-- in use or in edit history so the route can delete them from storage.
-- The table lock makes reset all-or-nothing against concurrent guest writes (they wait, then
-- run after the reset). Tables are listed in the order guest writes touch them.
create function public.reset_all()
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  v_paths text[];
begin
  lock table public.rate_limits, public.settings, public.nominees, public.nominee_categories,
    public.votes, public.nominee_edits in exclusive mode;
  select coalesce(array_agg(distinct p), '{}') into v_paths from (
    select photo_path as p from public.nominees
    union select old_photo_path from public.nominee_edits
    union select new_photo_path from public.nominee_edits) x;
  delete from public.votes where true;
  delete from public.nominee_edits where true;
  delete from public.nominee_categories where true;
  delete from public.nominees where true;
  delete from public.rate_limits where true;
  update public.settings set voting_opens_at = null, voting_closes_at = null where id = 1;
  return v_paths;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Privileges: service role only. Revoke everything in the schema from the browser roles, then
-- grant service_role exactly what the route handlers and these functions use.
-- ---------------------------------------------------------------------------------------------

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.settings,
  public.nominees,
  public.nominee_categories,
  public.votes,
  public.nominee_edits,
  public.rate_limits
to service_role;

grant usage, select on sequence public.nominee_edits_id_seq to service_role;

grant execute on function
  public.voting_is_open(),
  public.check_rate_limit(uuid, text, int),
  public.valid_categories(text[]),
  public.clean_name(text),
  public.valid_name(text),
  public.photo_is_fresh(text, text),
  public.apply_nominee_edit(uuid, uuid, boolean, text, text, text, text[], text[], bigint),
  public.cast_vote(uuid, text, uuid),
  public.create_nominee(uuid, text[], text, text, text),
  public.add_nominee_to_category(uuid, uuid, text),
  public.edit_nominee(uuid, uuid, text, text, text, text[]),
  public.set_timer(text, int),
  public.admin_edit_nominee(uuid, text, text, text, text[]),
  public.admin_set_category(uuid, text, boolean),
  public.undo_nominee_edit(bigint),
  public.merge_nominees(uuid, uuid),
  public.reset_all()
to service_role;
