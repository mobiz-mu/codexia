-- Admin-editable Google Maps link for the office/counter location, used in
-- the standardized email footer. Left empty by default rather than
-- fabricating an address — the footer's Maps button only renders once an
-- admin sets a real value in Settings.
insert into site_settings (key, value, value_type, description)
values ('google_maps_url', '""', 'string', 'Google Maps link to the Codexia office/counter, shown in email footers. Leave empty to hide the Maps button.')
on conflict (key) do nothing;
