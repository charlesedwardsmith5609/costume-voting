-- TEST PROJECT ONLY (costume-vote-test). Marks this project as safe for the DB tests to wipe:
-- tests/db/helpers.ts refuses to run unless this one-row table exists.
--
-- Never run this on production. The migration, teardown_test.sql, and the app never create or
-- drop it, so it survives a teardown and only needs to be run once per test project.
-- Safe to re-run.

create table if not exists public.test_marker (
  id int primary key default 1 check (id = 1),
  note text not null default 'costume-vote test project: DB tests may wipe this database'
);
insert into public.test_marker (id) values (1) on conflict (id) do nothing;

alter table public.test_marker enable row level security;
revoke all on table public.test_marker from public, anon, authenticated;
grant select on table public.test_marker to service_role;
