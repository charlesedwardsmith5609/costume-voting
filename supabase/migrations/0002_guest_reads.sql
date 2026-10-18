-- M2: guest state read, upload rate limit, and start-by-close-time for the timer.
-- Run once in the Supabase SQL editor after 0001 (production and test projects).
--
-- One window for everything: nominating, editing, uploads, and voting are open from when the
-- host starts voting until it closes. After close, every guest write is rejected; host edits
-- still work.

-- Guest home screen state, all from the database clock. status is 'not_started' | 'open' |
-- 'closed'. "now" lets the client correct its own clock for the countdown.
create function public.guest_state()
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
    'now', now())
  from public.settings s where s.id = 1;
$$;

-- Gate for the upload-URL route: rate limit (20 per 10 minutes, enough for 10 nominations plus
-- 10 photo edits), then the voting window. Returns 'ok' | 'rate_limited' | 'closed'.
create function public.issue_upload(p_device uuid)
returns text
language plpgsql
set search_path = ''
as $$
begin
  if not public.check_rate_limit(p_device, 'upload', 20) then
    return 'rate_limited';
  end if;
  if not public.voting_is_open() then
    return 'closed';
  end if;
  return 'ok';
end;
$$;

-- set_timer gains p_closes_at: 'start' takes exactly one of p_minutes (1-600) or p_closes_at
-- (an absolute close time, after now and at most 600 minutes ahead). Extend and end are
-- unchanged. Named-argument callers of the old (p_action, p_minutes) form keep working.
drop function public.set_timer(text, int);

create function public.set_timer(
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
      if p_closes_at <= now() or p_closes_at > now() + interval '600 minutes' then
        return jsonb_build_object('status', 'invalid');
      end if;
      update public.settings
         set voting_opens_at = now(), voting_closes_at = p_closes_at
       where id = 1 returning * into s;
    elsif p_minutes is not null and p_minutes between 1 and 600 then
      update public.settings
         set voting_opens_at = now(), voting_closes_at = now() + make_interval(mins => p_minutes)
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

-- New functions get EXECUTE for public (and Supabase's default privileges add anon and
-- authenticated), so revoke explicitly, then grant service_role only.
revoke execute on function
  public.guest_state(),
  public.issue_upload(uuid),
  public.set_timer(text, int, timestamptz)
from public, anon, authenticated;

grant execute on function
  public.guest_state(),
  public.issue_upload(uuid),
  public.set_timer(text, int, timestamptz)
to service_role;
