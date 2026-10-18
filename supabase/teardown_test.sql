-- TEST PROJECT ONLY. Drops everything 0001_init.sql creates (and the objects from earlier drafts
-- of it) so the migration can be run again from scratch. Never run this on production.
--
-- The nominee-photos bucket and its objects are kept: the migration's bucket insert is
-- idempotent, and Supabase does not allow deleting storage objects from SQL.
-- public.test_marker (from test_marker.sql) is deliberately left alone, so it never needs to be
-- re-run after a teardown.

drop function if exists
  public.voting_is_open,
  public.check_rate_limit,
  public.valid_categories,
  public.clean_name,
  public.valid_name,
  public.photo_is_fresh,
  public.apply_nominee_edit,
  public.cast_vote,
  public.create_nominee,
  public.add_nominee_to_category,
  public.edit_nominee,
  public.set_timer,
  public.admin_edit_nominee,
  public.admin_set_category,
  public.undo_nominee_edit,
  public.merge_nominees,
  public.reset_all;

drop table if exists
  public.votes,
  public.nominee_edits,
  public.nominee_categories,
  public.nominees,
  public.rate_limits,
  public.settings
cascade;
