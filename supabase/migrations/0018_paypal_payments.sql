-- PayPal is now the only online payment method. The site displays prices in
-- MUR, but PayPal does not settle in MUR, so we keep a single admin-editable
-- exchange rate (MUR per 1 EUR) to convert the booking total into the EUR
-- amount actually charged for the deposit/full payment.
insert into site_settings (key, value, value_type, description)
values ('eur_exchange_rate', '47.5', 'number', 'MUR per 1 EUR, used to convert booking totals into the EUR amount charged via PayPal. Update to the current rate before go-live.')
on conflict (key) do nothing;
