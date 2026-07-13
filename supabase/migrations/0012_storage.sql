insert into storage.buckets (id, name, public)
values
  ('vehicle-images', 'vehicle-images', true),
  ('category-images', 'category-images', true),
  ('banners', 'banners', true),
  ('blog', 'blog', true),
  ('company', 'company', true),
  ('payment-proofs', 'payment-proofs', false),
  ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- Public buckets: anyone can read, only vehicle/content staff can write
create policy storage_public_buckets_select on storage.objects
  for select using (
    bucket_id in ('vehicle-images', 'category-images', 'banners', 'blog', 'company')
  );

create policy storage_public_buckets_write on storage.objects
  for all using (
    bucket_id in ('vehicle-images', 'category-images', 'banners', 'blog', 'company')
    and (
      has_permission(auth.uid(), 'manage_vehicles')
      or has_permission(auth.uid(), 'manage_content')
    )
  )
  with check (
    bucket_id in ('vehicle-images', 'category-images', 'banners', 'blog', 'company')
    and (
      has_permission(auth.uid(), 'manage_vehicles')
      or has_permission(auth.uid(), 'manage_content')
    )
  );

-- Private buckets: staff only, accessed via server-generated signed URLs
create policy storage_payment_proofs_staff on storage.objects
  for all using (
    bucket_id = 'payment-proofs'
    and (
      has_permission(auth.uid(), 'manage_payments')
      or has_permission(auth.uid(), 'approve_payment_proofs')
    )
  )
  with check (
    bucket_id = 'payment-proofs'
    and (
      has_permission(auth.uid(), 'manage_payments')
      or has_permission(auth.uid(), 'approve_payment_proofs')
    )
  );

create policy storage_invoices_staff on storage.objects
  for all using (
    bucket_id = 'invoices' and has_permission(auth.uid(), 'create_invoices')
  )
  with check (
    bucket_id = 'invoices' and has_permission(auth.uid(), 'create_invoices')
  );
