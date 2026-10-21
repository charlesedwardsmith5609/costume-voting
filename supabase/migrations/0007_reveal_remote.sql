-- M5: control the winner reveal from the host's phone, and Reset also unpublishes results.
-- Run once in the Supabase SQL editor after 0006 (production and test projects).

-- One row shared by the TV page and the phone remote. The phone sends commands (seq counts
-- them); the TV page polls for new ones and publishes its own status in state.
-- Owner: send_reveal_command (command, seq), the reveal-state route (state).
create table public.reveal_remote (
  id int primary key default 1 check (id = 1),
  seq bigint not null default 0,
  command text,
  state jsonb,
  state_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.reveal_remote (id) values (1);
alter table public.reveal_remote enable row level security;

-- Records one command and bumps the counter in a single statement.
-- Returns {"status": "ok", "seq": n} or {"status": "invalid"}.
create function public.send_reveal_command(p_command text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_seq bigint;
begin
  if p_command is null or p_command not in
     ('reveal', 'next', 'previous', 'start_slideshow', 'exit_slideshow', 'mute_toggle') then
    return jsonb_build_object('status', 'invalid');
  end if;
  update public.reveal_remote
     set seq = seq + 1, command = p_command, updated_at = now()
   where id = 1
  returning seq into v_seq;
  return jsonb_build_object('status', 'ok', 'seq', v_seq);
end;
$$;

-- reset_all: as in 0006, plus unpublish results and clear the reveal remote (state and command;
-- seq keeps counting so a TV page left open never replays an old command).
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
  update public.settings
     set voting_opens_at = null, voting_closes_at = null, results_published_at = null
   where id = 1;
  update public.reveal_remote set command = null, state = null, state_at = null where id = 1;
  return v_paths;
end;
$$;

-- Privileges: service role only, as in 0001.
revoke all on table public.reveal_remote from public, anon, authenticated;
grant select, insert, update, delete on table public.reveal_remote to service_role;
revoke execute on function public.send_reveal_command(text), public.reset_all()
  from public, anon, authenticated;
grant execute on function public.send_reveal_command(text), public.reset_all() to service_role;
