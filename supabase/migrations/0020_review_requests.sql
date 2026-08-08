-- Dedup log for the automated post-rental review-request email: one row per
-- booking, inserted before the email is sent so a concurrent cron run can't
-- double-send (same insert-first pattern as reminder_logs).

create table review_request_logs (
  booking_id uuid primary key references bookings (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table review_request_logs enable row level security;

create policy review_request_logs_staff_select on review_request_logs
  for select using (has_permission(auth.uid(), 'view_analytics'));
