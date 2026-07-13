-- The `whatsapp` display value was previously read from `phone` at the
-- application layer, which meant changing the office phone number silently
-- changed the displayed WhatsApp number too, independent of the actual
-- wa.me link target stored in `whatsapp_number`. Give it its own row.
insert into site_settings (key, value, value_type, description)
values ('whatsapp', '"+230 52811999"', 'string', 'Displayed WhatsApp contact number (formatted)')
on conflict (key) do nothing;
