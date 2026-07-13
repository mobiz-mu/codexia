// Hand-written subset matching supabase/migrations, covering only the tables
// queried so far. The schema is live on the project, but `supabase gen types`
// needs a local container runtime (podman/docker) that isn't available here.
// Once one is, replace entirely with:
//   npx supabase gen types typescript --db-url "<pooler-url>" --schema public > lib/supabase/types.ts
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      site_settings: Table<{
        key: string;
        value: unknown;
        value_type: "string" | "number" | "boolean" | "json";
        description: string | null;
        updated_at: string;
        updated_by: string | null;
      }>;
      locations: Table<{
        id: string;
        slug: string;
        name_en: string;
        name_fr: string;
        description_en: string | null;
        description_fr: string | null;
        hero_image_path: string | null;
        delivery_fee_cents: number;
        latitude: number | null;
        longitude: number | null;
        meta_title_en: string | null;
        meta_title_fr: string | null;
        meta_description_en: string | null;
        meta_description_fr: string | null;
        og_image_path: string | null;
        canonical_path: string | null;
        display_order: number;
        active: boolean;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      vehicle_categories: Table<{
        id: string;
        slug: string;
        name_en: string;
        name_fr: string;
        description_en: string | null;
        description_fr: string | null;
        image_path: string | null;
        icon: string | null;
        display_order: number;
        active: boolean;
        featured: boolean;
        meta_title_en: string | null;
        meta_title_fr: string | null;
        meta_description_en: string | null;
        meta_description_fr: string | null;
        og_image_path: string | null;
        canonical_path: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      vehicles: Table<{
        id: string;
        slug: string;
        name: string;
        brand: string;
        model: string;
        year: number;
        internal_registration_ref: string | null;
        category_id: string;
        description_en: string | null;
        description_fr: string | null;
        daily_price_cents: number;
        currency: string;
        deposit_cents: number;
        insurance_excess_cents: number;
        extra_insurance_daily_cents: number;
        min_rental_days: number;
        status: "draft" | "active" | "archived";
        featured: boolean;
        is_demo: boolean;
        passengers: number;
        doors: number;
        luggage: number;
        transmission: "manual" | "automatic";
        fuel: "petrol" | "diesel" | "hybrid" | "electric";
        air_conditioning: boolean;
        engine_size: string | null;
        drive_type: string | null;
        mileage_policy: string;
        min_driver_age: number;
        bluetooth: boolean;
        usb: boolean;
        gps: boolean;
        child_seat_available: boolean;
        booster_seat_available: boolean;
        features: unknown;
        meta_title_en: string | null;
        meta_title_fr: string | null;
        meta_description_en: string | null;
        meta_description_fr: string | null;
        og_image_path: string | null;
        canonical_path: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      vehicle_images: Table<{
        id: string;
        vehicle_id: string;
        path: string;
        display_order: number;
        is_main: boolean;
        alt_en: string | null;
        alt_fr: string | null;
        created_at: string;
      }>;
      extras: Table<{
        id: string;
        name_en: string;
        name_fr: string;
        price_cents: number;
        currency: string;
        pricing_mode: "per_day" | "flat";
        active: boolean;
        display_order: number;
        created_at: string;
        updated_at: string;
      }>;
      blog_categories: Table<{
        id: string;
        slug: string;
        name_en: string;
        name_fr: string;
        created_at: string;
      }>;
      blog_posts: Table<{
        id: string;
        slug: string;
        title_en: string;
        title_fr: string;
        excerpt_en: string | null;
        excerpt_fr: string | null;
        body_en: string | null;
        body_fr: string | null;
        featured_image_path: string | null;
        featured_image_alt_en: string | null;
        featured_image_alt_fr: string | null;
        author_id: string | null;
        category_id: string | null;
        status: "draft" | "scheduled" | "published";
        publish_at: string | null;
        meta_title_en: string | null;
        meta_title_fr: string | null;
        meta_description_en: string | null;
        meta_description_fr: string | null;
        og_image_path: string | null;
        canonical_path: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      hero_banners: Table<{
        id: string;
        desktop_image_path: string;
        mobile_image_path: string | null;
        heading_en: string | null;
        heading_fr: string | null;
        text_en: string | null;
        text_fr: string | null;
        button_label_en: string | null;
        button_label_fr: string | null;
        button_href: string | null;
        alt_en: string | null;
        alt_fr: string | null;
        overlay_color: string | null;
        overlay_opacity: number | null;
        display_order: number;
        schedule_start: string | null;
        schedule_end: string | null;
        active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      policy_pages: Table<{
        id: string;
        slug: string;
        title_en: string;
        title_fr: string;
        created_at: string;
      }>;
      policy_versions: Table<{
        id: string;
        policy_page_id: string;
        version: number;
        body_en: string;
        body_fr: string;
        published_at: string;
        created_at: string;
      }>;
      faq_categories: Table<{
        id: string;
        slug: string;
        name_en: string;
        name_fr: string;
        display_order: number;
        created_at: string;
      }>;
      faq_entries: Table<{
        id: string;
        category_id: string;
        question_en: string;
        question_fr: string;
        answer_en: string;
        answer_fr: string;
        display_order: number;
        active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      reviews: Table<{
        id: string;
        target_type: "vehicle" | "post" | "homepage";
        target_id: string | null;
        name: string;
        country: string | null;
        email: string;
        rating: number;
        body: string;
        status: "pending" | "approved" | "rejected" | "hidden";
        featured: boolean;
        admin_reply: string | null;
        consent: boolean;
        ip_hash: string | null;
        created_at: string;
        updated_at: string;
      }>;
      contact_messages: Table<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
        subject: string | null;
        message: string;
        status: "new" | "read" | "replied" | "archived";
        created_at: string;
      }>;
      newsletter_subscribers: Table<{
        id: string;
        email: string;
        locale: string;
        status: "subscribed" | "unsubscribed";
        source: string | null;
        created_at: string;
        updated_at: string;
      }>;
    };
    Views: {
      public_reviews: {
        Row: {
          id: string;
          target_type: "vehicle" | "post" | "homepage";
          target_id: string | null;
          name: string;
          country: string | null;
          rating: number;
          body: string;
          admin_reply: string | null;
          featured: boolean;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
};
