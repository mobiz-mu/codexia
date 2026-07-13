alter table bookings
  add column payment_method text check (payment_method in ('bank_transfer', 'pay_on_arrival', 'online'));
