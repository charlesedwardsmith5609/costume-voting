-- M2 cross-review fix: photo paths no longer contain the uploader's device ID.
-- Run once in the Supabase SQL editor after 0002 (production and test projects).
--
-- Before: guest photos lived at <device>/<uuid>.jpg, and every guest gets public photo URLs, so
-- anyone could read another device's ID and use it to see or change that device's votes.
-- Now: guest photos live at guest/<uuid>.jpg, and which device was issued each path is kept in
-- photo_uploads, which only the service role can read. Host photos stay at host/<uuid>.jpg.
-- Existing nominees keep their current paths.

-- One row per guest upload URL issued. Owner: issue_upload.
create table public.photo_uploads (
  path text primary key,
  device_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.photo_uploads enable row level security;

-- Now also chooses the path and records which device it was issued to.
-- Returns {"status": "ok", "path": text} or {"status": 'rate_limited' | 'closed'}.
drop function public.issue_upload(uuid);

create function public.issue_upload(p_device uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_path text := 'guest/' || gen_random_uuid() || '.jpg';
begin
  if not public.check_rate_limit(p_device, 'upload', 20) then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if not public.voting_is_open() then
    return jsonb_build_object('status', 'closed');
  end if;
  insert into public.photo_uploads (path, device_id) values (v_path, p_device);
  return jsonb_build_object('status', 'ok', 'path', v_path);
end;
$$;

-- A photo path is usable when the object was uploaded to the photos bucket, no nominee or edit
-- has ever used it, and it belongs to p_owner: for 'host', a host/<uuid>.jpg path; for a device
-- ID, a guest/<uuid>.jpg path that issue_upload issued to that device. The parameter is renamed
-- from p_prefix; callers pass it positionally, so they need no change.
drop function public.photo_is_fresh(text, text);

create function public.photo_is_fresh(p_owner text, p_path text)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_path is not null
     and case
       when p_owner = 'host' then
         p_path ~ '^host/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
       else
         p_path ~ '^guest/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
         and exists (
           select 1 from public.photo_uploads u
            where u.path = p_path and u.device_id::text = p_owner)
     end
     and exists (
       select 1 from storage.objects o
        where o.bucket_id = 'nominee-photos' and o.name = p_path)
     and not exists (select 1 from public.nominees n where n.photo_path = p_path)
     and not exists (
       select 1 from public.nominee_edits e
        where e.old_photo_path = p_path or e.new_photo_path = p_path);
$$;

-- Same as 0001, plus photo_uploads: its paths are returned for storage cleanup (including
-- uploads that never became a nominee), and its rows are cleared.
create or replace function public.reset_all()
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  v_paths text[];
begin
  lock table public.rate_limits, public.settings, public.photo_uploads, public.nominees,
    public.nominee_categories, public.votes, public.nominee_edits in exclusive mode;
  select coalesce(array_agg(distinct p), '{}') into v_paths from (
    select photo_path as p from public.nominees
    union select old_photo_path from public.nominee_edits
    union select new_photo_path from public.nominee_edits
    union select path from public.photo_uploads) x;
  delete from public.votes where true;
  delete from public.nominee_edits where true;
  delete from public.nominee_categories where true;
  delete from public.nominees where true;
  delete from public.photo_uploads where true;
  delete from public.rate_limits where true;
  update public.settings set voting_opens_at = null, voting_closes_at = null where id = 1;
  return v_paths;
end;
$$;

-- Privileges: service role only, as in 0001.
revoke all on table public.photo_uploads from public, anon, authenticated;
grant select, insert, update, delete on table public.photo_uploads to service_role;

revoke execute on function
  public.issue_upload(uuid),
  public.photo_is_fresh(text, text),
  public.reset_all()
from public, anon, authenticated;

grant execute on function
  public.issue_upload(uuid),
  public.photo_is_fresh(text, text),
  public.reset_all()
to service_role;
