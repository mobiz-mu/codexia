-- Switch the platform's default currency from EUR to MUR (Mauritian Rupee).
alter table vehicles alter column currency set default 'MUR';
alter table extras alter column currency set default 'MUR';
alter table payments alter column currency set default 'MUR';
alter table payment_transactions alter column currency set default 'MUR';

update vehicles set currency = 'MUR' where currency = 'EUR';
update extras set currency = 'MUR' where currency = 'EUR';
update payments set currency = 'MUR' where currency = 'EUR';
update payment_transactions set currency = 'MUR' where currency = 'EUR';

update site_settings set value = '"MUR"' where key = 'currency' and value = '"EUR"';
