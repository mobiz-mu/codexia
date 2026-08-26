-- Weekly inspection programme start date — Phase E6.5.
--
-- E6 derived the historical boundary from the earliest recorded inspection.
-- That was wrong: compliance ACTIVITY cannot define when a compliance
-- REQUIREMENT began. If the programme starts in week 1 and nobody inspects
-- anything until week 4, an activity-derived boundary quietly erases weeks
-- 1-3 — precisely the weeks somebody needs to answer for. It also meant
-- deleting the oldest inspection would silently move the boundary.
--
-- The requirement therefore gets its own explicit, persistent start date.
--
-- Stored as an ISO calendar date, not a timestamp: the rule is week-based, and
-- a timestamp would imply an intra-day precision the rule does not have.
-- 2026-08-24 is the Monday opening the first Mauritius week in which Weekly
-- Inspections are required.
--
-- No schema is added. site_settings already exists and the admin settings
-- screen lists every row in it, so this key becomes editable with its
-- description as on-screen help — including the warning that changing it
-- changes which historical weeks count as missed.

insert into site_settings (key, value, value_type, description)
values (
  'weekly_inspection_program_start_date',
  '"2026-08-24"',
  'string',
  'Weekly inspection programme start date (Monday, Mauritius). Weeks before this are never reported as missed. Changing this date changes which historical weeks are considered required or missed.'
)
on conflict (key) do nothing;
