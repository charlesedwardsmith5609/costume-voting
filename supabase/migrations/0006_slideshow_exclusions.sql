-- M5: the host can remove individual photos from the final slideshow. Run once in the Supabase
-- SQL editor after 0005 (production and test projects).

-- Photos left out of the slideshow, by storage path (so one photo can go while its nominee stays).
-- Owner: the admin slideshow-exclude route (insert or delete of one row); cleared by reset_all.
create table public.slideshow_exclusions (
  photo_path text primary key,
  created_at timestamptz not null default now()
);
alter table public.slideshow_exclusions enable row level security;

-- reset_all: as in 0003, plus slideshow_exclusions.
create or replace function public.reset_all()
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  v_paths text[];
begin
  lock table public.rate_limits, public.settings, public.photo_uploads, public.nominees,
    public.nominee_categories, public.votes, public.nominee_edits, public.slideshow_exclusions
    in exclusive mode;
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
  delete from public.slideshow_exclusions where true;
  delete from public.rate_limits where true;
  update public.settings set voting_opens_at = null, voting_closes_at = null where id = 1;
  return v_paths;
end;
$$;

-- Privileges: service role only, as in 0001.
revoke all on table public.slideshow_exclusions from public, anon, authenticated;
grant select, insert, update, delete on table public.slideshow_exclusions to service_role;
revoke execute on function public.reset_all() from public, anon, authenticated;
grant execute on function public.reset_all() to service_role;
