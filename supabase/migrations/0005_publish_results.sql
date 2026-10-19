-- M5: the host publishes results to guests after voting closes, and the close time has no
-- upper limit. Run once in the Supabase SQL editor after 0004 (production and test projects).

-- When the host published results; null while unpublished. Results are visible to guests only
-- while this is set AND voting is closed. Owner: set_results_published, set_timer.
alter table public.settings add column results_published_at timestamptz;

-- guest_state gains results_published (published and closed).
create or replace function public.guest_state()
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', case
      when public.voting_is_open() then 'open'
      when s.voting_opens_at is null or now() < s.voting_opens_at then 'not_started'
      else 'closed' end,
    'voting_opens_at', s.voting_opens_at,
    'voting_closes_at', s.voting_closes_at,
    'results_published', s.results_published_at is not null
      and s.voting_opens_at is not null and not public.voting_is_open(),
    'now', now())
  from public.settings s where s.id = 1;
$$;

-- Publish only after voting has closed; unpublish at any time.
-- Returns {"status": "ok", "results_published": boolean} or {"status": 'not_closed'}.
create function public.set_results_published(p_published boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.settings;
begin
  select * into s from public.settings where id = 1 for update;
  if p_published and (s.voting_opens_at is null or public.voting_is_open()) then
    return jsonb_build_object('status', 'not_closed');
  end if;
  update public.settings
     set results_published_at = case when p_published then coalesce(results_published_at, now()) end
   where id = 1;
  return jsonb_build_object('status', 'ok', 'results_published', p_published);
end;
$$;

-- set_timer: a 'start' close time only has to be in the future (the 600-minute limit is gone;
-- durations stay 1-600 minutes). 'start' and 'extend' reopen voting, so they also unpublish
-- results. 'end' is unchanged.
create or replace function public.set_timer(
  p_action text, p_minutes int default null, p_closes_at timestamptz default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.settings;
begin
  select * into s from public.settings where id = 1 for update;

  if p_action = 'start' then
    if p_minutes is not null and p_closes_at is not null then
      return jsonb_build_object('status', 'invalid');
    elsif p_closes_at is not null then
      if p_closes_at <= now() then
        return jsonb_build_object('status', 'invalid');
      end if;
      update public.settings
         set voting_opens_at = now(), voting_closes_at = p_closes_at, results_published_at = null
       where id = 1 returning * into s;
    elsif p_minutes is not null and p_minutes between 1 and 600 then
      update public.settings
         set voting_opens_at = now(), voting_closes_at = now() + make_interval(mins => p_minutes),
             results_published_at = null
       where id = 1 returning * into s;
    else
      return jsonb_build_object('status', 'invalid');
    end if;
  elsif p_action = 'extend' then
    if p_minutes is null or p_minutes not between 1 and 600 then
      return jsonb_build_object('status', 'invalid');
    end if;
    if s.voting_opens_at is null then
      return jsonb_build_object('status', 'not_started');
    end if;
    update public.settings
       set voting_closes_at = greatest(now(), voting_closes_at) + make_interval(mins => p_minutes),
           results_published_at = null
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

-- Privileges: service role only, as in 0001. create or replace keeps existing grants; revoke
-- again anyway so this file is correct on its own.
revoke execute on function
  public.guest_state(),
  public.set_results_published(boolean),
  public.set_timer(text, int, timestamptz)
from public, anon, authenticated;

grant execute on function
  public.guest_state(),
  public.set_results_published(boolean),
  public.set_timer(text, int, timestamptz)
to service_role;
