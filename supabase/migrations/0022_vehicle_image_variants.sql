-- Upload-time image pipeline: content_hash lets uploadVehicleImage reject an
-- exact duplicate photo for the same vehicle before it ever hits storage;
-- variants holds the generated WebP/AVIF thumb/card/hero/gallery paths
-- (jsonb rather than one column per size x format, since the format set can
-- grow — e.g. adding AVIF-only fallback logic — without another migration);
-- blur_data_url is a tiny base64 placeholder for next/image's blur-up effect.
-- The original upload is untouched and still referenced by `path`.

alter table vehicle_images
  add column content_hash text,
  add column variants jsonb,
  add column blur_data_url text;

create index vehicle_images_content_hash_idx on vehicle_images (vehicle_id, content_hash);
