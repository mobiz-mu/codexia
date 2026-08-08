-- Real fleet-management data: compliance/service dates, VIN/engine number,
-- mileage, and optional weekly/monthly rates. Registration number, fuel,
-- transmission, seats, doors, luggage, air conditioning, GPS, bluetooth, and
-- child-seat availability already exist on vehicles — not duplicated here.
--
-- Vehicle operational status (Available/Reserved/Preparing/.../Maintenance)
-- is deliberately NOT a stored column: it's derived at query time from the
-- vehicle's current booking + vehicle_blocks state (see
-- lib/vehicles/operational-status.ts), so it can never go stale the way a
-- manually-maintained status field would.

alter table vehicles
  add column vin text,
  add column engine_number text,
  add column insurance_expiry date,
  add column road_tax_expiry date,
  add column fitness_expiry date,
  add column last_service_date date,
  add column next_service_date date,
  add column current_mileage_km integer check (current_mileage_km >= 0),
  add column weekly_price_cents integer check (weekly_price_cents >= 0),
  add column monthly_price_cents integer check (monthly_price_cents >= 0);

-- Turnaround states (preparing/cleaning) join the existing maintenance/
-- internal block types so admins can mark a vehicle unavailable between
-- bookings without inventing a separate mechanism.
alter table vehicle_blocks
  drop constraint vehicle_blocks_type_check,
  add constraint vehicle_blocks_type_check
    check (type in ('maintenance', 'internal', 'preparing', 'cleaning'));
