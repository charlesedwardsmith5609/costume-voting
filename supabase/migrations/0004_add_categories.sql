-- M4 "Nominate a costume" flow: add an existing nominee to several categories in one call.
-- Run once in the Supabase SQL editor after 0003 (production and test projects).
--
-- One call is one rate-limit hit ('edit', shared with edits) and one nominee_edits row, and it
-- either adds every new category or none. Categories the nominee already has are skipped.
-- add_nominee_to_category stays for the per-category "Add to this category" path.
-- Returns {"status": "ok", "edit_id": bigint} or {"status": 'rate_limited' | 'closed' |
-- 'invalid_category' | 'not_found' | 'already_in_category'}.
create function public.add_nominee_to_categories(p_device uuid, p_nominee uuid, p_categories text[])
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
  if coalesce(cardinality(p_categories), 0) = 0 or not public.valid_categories(p_categories) then
    return jsonb_build_object('status', 'invalid_category');
  end if;
  select * into n from public.nominees where id = p_nominee for update;
  if n.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_res := public.apply_nominee_edit(
    p_nominee, p_device, true, n.person_name, n.costume_name, null,
    p_categories, '{}', null);
  if v_res->>'status' = 'no_change' then
    return jsonb_build_object('status', 'already_in_category');
  end if;
  return v_res;
end;
$$;

-- Privileges: service role only, as in 0001.
revoke execute on function public.add_nominee_to_categories(uuid, uuid, text[])
from public, anon, authenticated;

grant execute on function public.add_nominee_to_categories(uuid, uuid, text[]) to service_role;
