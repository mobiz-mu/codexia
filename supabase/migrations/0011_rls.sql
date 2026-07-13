-- Enable RLS everywhere. Absence of a policy = deny by default.
alter table profiles enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;
alter table site_settings enable row level security;
alter table locations enable row level security;
alter table vehicle_categories enable row level security;
alter table vehicles enable row level security;
alter table vehicle_images enable row level security;
alter table vehicle_blocks enable row level security;
alter table extras enable row level security;
alter table bookings enable row level security;
alter table booking_customers enable row level security;
alter table booking_drivers enable row level security;
alter table booking_extras enable row level security;
alter table booking_status_history enable row level security;
alter table payments enable row level security;
alter table payment_proofs enable row level security;
alter table payment_transactions enable row level security;
alter table invoice_counters enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table invoice_payments enable row level security;
alter table reviews enable row level security;
alter table blog_categories enable row level security;
alter table blog_posts enable row level security;
alter table tags enable row level security;
alter table post_tags enable row level security;
alter table hero_banners enable row level security;
alter table policy_pages enable row level security;
alter table policy_versions enable row level security;
alter table policy_acceptances enable row level security;
alter table newsletter_subscribers enable row level security;
alter table contact_messages enable row level security;
alter table faq_categories enable row level security;
alter table faq_entries enable row level security;
alter table email_templates enable row level security;
alter table email_logs enable row level security;
alter table reminder_logs enable row level security;
alter table notifications enable row level security;
alter table analytics_events enable row level security;
alter table calendar_sync_log enable row level security;
alter table audit_logs enable row level security;

-- profiles: users manage their own row; manage_users staff manage all
create policy profiles_select_own on profiles
  for select using (id = auth.uid() or has_permission(auth.uid(), 'manage_users'));
create policy profiles_update_own on profiles
  for update using (id = auth.uid() or has_permission(auth.uid(), 'manage_users'));
create policy profiles_staff_all on profiles
  for all using (has_permission(auth.uid(), 'manage_users'))
  with check (has_permission(auth.uid(), 'manage_users'));

-- RBAC tables: manage_users only
create policy roles_staff_all on roles
  for all using (has_permission(auth.uid(), 'manage_users'))
  with check (has_permission(auth.uid(), 'manage_users'));
create policy permissions_staff_all on permissions
  for all using (has_permission(auth.uid(), 'manage_users'))
  with check (has_permission(auth.uid(), 'manage_users'));
create policy role_permissions_staff_all on role_permissions
  for all using (has_permission(auth.uid(), 'manage_users'))
  with check (has_permission(auth.uid(), 'manage_users'));
create policy user_roles_staff_all on user_roles
  for all using (has_permission(auth.uid(), 'manage_users'))
  with check (has_permission(auth.uid(), 'manage_users'));

-- site_settings: publicly readable (business info customers need), writes gated
create policy site_settings_public_select on site_settings
  for select using (true);
create policy site_settings_staff_write on site_settings
  for all using (has_permission(auth.uid(), 'manage_settings'))
  with check (has_permission(auth.uid(), 'manage_settings'));

-- locations
create policy locations_public_select on locations
  for select using (active and deleted_at is null);
create policy locations_staff_all on locations
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- vehicle_categories
create policy vehicle_categories_public_select on vehicle_categories
  for select using (active and deleted_at is null);
create policy vehicle_categories_staff_all on vehicle_categories
  for all using (has_permission(auth.uid(), 'manage_vehicles'))
  with check (has_permission(auth.uid(), 'manage_vehicles'));

-- vehicles
create policy vehicles_public_select on vehicles
  for select using (status = 'active' and deleted_at is null);
create policy vehicles_staff_all on vehicles
  for all using (has_permission(auth.uid(), 'manage_vehicles'))
  with check (has_permission(auth.uid(), 'manage_vehicles'));

-- vehicle_images: visible through their parent vehicle's visibility
create policy vehicle_images_public_select on vehicle_images
  for select using (
    exists (
      select 1 from vehicles v
      where v.id = vehicle_images.vehicle_id
        and v.status = 'active'
        and v.deleted_at is null
    )
  );
create policy vehicle_images_staff_all on vehicle_images
  for all using (has_permission(auth.uid(), 'manage_vehicles'))
  with check (has_permission(auth.uid(), 'manage_vehicles'));

-- vehicle_blocks: staff only, never public
create policy vehicle_blocks_staff_all on vehicle_blocks
  for all using (has_permission(auth.uid(), 'manage_vehicles'))
  with check (has_permission(auth.uid(), 'manage_vehicles'));

-- extras
create policy extras_public_select on extras
  for select using (active);
create policy extras_staff_all on extras
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- bookings + related: no public policies at all, Server Actions use the
-- service-role key exclusively. Staff access only.
create policy bookings_staff_all on bookings
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));
create policy booking_customers_staff_all on booking_customers
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));
create policy booking_drivers_staff_all on booking_drivers
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));
create policy booking_extras_staff_all on booking_extras
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));
create policy booking_status_history_staff_all on booking_status_history
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));

-- payments: staff only
create policy payments_staff_all on payments
  for all using (has_permission(auth.uid(), 'manage_payments'))
  with check (has_permission(auth.uid(), 'manage_payments'));
create policy payment_proofs_staff_select on payment_proofs
  for select using (
    has_permission(auth.uid(), 'manage_payments')
    or has_permission(auth.uid(), 'approve_payment_proofs')
  );
create policy payment_proofs_staff_write on payment_proofs
  for update using (has_permission(auth.uid(), 'approve_payment_proofs'))
  with check (has_permission(auth.uid(), 'approve_payment_proofs'));
create policy payment_proofs_staff_delete on payment_proofs
  for delete using (has_permission(auth.uid(), 'manage_payments'));
create policy payment_transactions_staff_all on payment_transactions
  for all using (has_permission(auth.uid(), 'manage_payments'))
  with check (has_permission(auth.uid(), 'manage_payments'));

-- invoices: create_invoices staff only
create policy invoice_counters_staff_all on invoice_counters
  for all using (has_permission(auth.uid(), 'create_invoices'))
  with check (has_permission(auth.uid(), 'create_invoices'));
create policy invoices_staff_all on invoices
  for all using (has_permission(auth.uid(), 'create_invoices'))
  with check (has_permission(auth.uid(), 'create_invoices'));
create policy invoice_items_staff_all on invoice_items
  for all using (has_permission(auth.uid(), 'create_invoices'))
  with check (has_permission(auth.uid(), 'create_invoices'));
create policy invoice_payments_staff_all on invoice_payments
  for all using (has_permission(auth.uid(), 'create_invoices'))
  with check (has_permission(auth.uid(), 'create_invoices'));

-- reviews: public can submit (status defaults to pending); approved-only
-- publicly selectable via the public_reviews view (keeps email out of reach).
create policy reviews_public_insert on reviews
  for insert with check (status = 'pending');
create policy reviews_staff_all on reviews
  for all using (has_permission(auth.uid(), 'approve_reviews'))
  with check (has_permission(auth.uid(), 'approve_reviews'));

create view public_reviews with (security_invoker = true) as
  select id, target_type, target_id, name, country, rating, body, admin_reply, featured, created_at
  from reviews
  where status = 'approved';

grant select on public_reviews to anon, authenticated;

-- blog
create policy blog_categories_public_select on blog_categories
  for select using (true);
create policy blog_categories_staff_all on blog_categories
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

create policy blog_posts_public_select on blog_posts
  for select using (
    status = 'published'
    and deleted_at is null
    and (publish_at is null or publish_at <= now())
  );
create policy blog_posts_staff_all on blog_posts
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

create policy tags_public_select on tags for select using (true);
create policy tags_staff_all on tags
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

create policy post_tags_public_select on post_tags for select using (true);
create policy post_tags_staff_all on post_tags
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- hero_banners: public sees active + within schedule window
create policy hero_banners_public_select on hero_banners
  for select using (
    active
    and (schedule_start is null or schedule_start <= now())
    and (schedule_end is null or schedule_end >= now())
  );
create policy hero_banners_staff_all on hero_banners
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- policy_pages / policy_versions: fully public read, staff write
create policy policy_pages_public_select on policy_pages for select using (true);
create policy policy_pages_staff_all on policy_pages
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));
create policy policy_versions_public_select on policy_versions for select using (true);
create policy policy_versions_staff_all on policy_versions
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- policy_acceptances: booking-linked audit trail, staff only
create policy policy_acceptances_staff_all on policy_acceptances
  for all using (has_permission(auth.uid(), 'manage_bookings'))
  with check (has_permission(auth.uid(), 'manage_bookings'));

-- newsletter: public can subscribe (insert only), staff manage
create policy newsletter_public_insert on newsletter_subscribers
  for insert with check (status = 'subscribed');
create policy newsletter_staff_all on newsletter_subscribers
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- contact_messages: public can submit (insert only), staff manage
create policy contact_messages_public_insert on contact_messages
  for insert with check (status = 'new');
create policy contact_messages_staff_all on contact_messages
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- FAQ
create policy faq_categories_public_select on faq_categories for select using (true);
create policy faq_categories_staff_all on faq_categories
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));
create policy faq_entries_public_select on faq_entries
  for select using (active);
create policy faq_entries_staff_all on faq_entries
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- email_templates: staff only (rendering falls back to shipped defaults
-- in code when no row exists, so no public read is needed)
create policy email_templates_staff_all on email_templates
  for all using (has_permission(auth.uid(), 'manage_content'))
  with check (has_permission(auth.uid(), 'manage_content'));

-- observability tables: staff read via view_analytics, writes are
-- service-role only (no policy needed since inserts happen server-side)
create policy email_logs_staff_select on email_logs
  for select using (has_permission(auth.uid(), 'view_analytics'));
create policy reminder_logs_staff_select on reminder_logs
  for select using (has_permission(auth.uid(), 'view_analytics'));
create policy calendar_sync_log_staff_select on calendar_sync_log
  for select using (has_permission(auth.uid(), 'view_analytics'));
create policy analytics_events_staff_select on analytics_events
  for select using (has_permission(auth.uid(), 'view_analytics'));

-- notifications: visible to any staff member
create policy notifications_staff_select on notifications
  for select using (is_staff(auth.uid()));
create policy notifications_staff_update on notifications
  for update using (is_staff(auth.uid()))
  with check (is_staff(auth.uid()));

-- audit_logs: staff with manage_users oversight only
create policy audit_logs_staff_select on audit_logs
  for select using (has_permission(auth.uid(), 'manage_users'));
