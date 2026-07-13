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
      profiles: Table<{
        id: string;
        full_name: string | null;
        phone: string | null;
        avatar_path: string | null;
        created_at: string;
        updated_at: string;
      }>;
      roles: Table<{
        id: string;
        key: string;
        name: string;
        description: string | null;
        created_at: string;
      }>;
      permissions: Table<{
        id: string;
        key: string;
        description: string | null;
        created_at: string;
      }>;
      role_permissions: Table<{
        role_id: string;
        permission_id: string;
      }>;
      user_roles: Table<{
        user_id: string;
        role_id: string;
        assigned_at: string;
        assigned_by: string | null;
      }>;
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
      bookings: Table<{
        id: string;
        reference: string;
        vehicle_id: string | null;
        category_id: string;
        pickup_at: string;
        return_at: string;
        pickup_location_id: string;
        dropoff_location_id: string;
        status:
          | "draft"
          | "pending"
          | "awaiting_payment"
          | "payment_proof_submitted"
          | "payment_under_review"
          | "confirmed"
          | "partially_paid"
          | "paid"
          | "vehicle_assigned"
          | "ready_for_pickup"
          | "active"
          | "completed"
          | "cancelled"
          | "no_show"
          | "refunded"
          | "rejected";
        pricing: unknown;
        total_cents: number;
        paid_cents: number;
        balance_cents: number;
        passengers: number;
        flight_number: string | null;
        flight_airline: string | null;
        flight_arrival_date: string | null;
        flight_arrival_time: string | null;
        special_requests: string | null;
        policy_acceptance: unknown;
        accepted_at: string | null;
        accepted_ip: string | null;
        accepted_user_agent: string | null;
        google_event_id: string | null;
        access_token_hash: string | null;
        idempotency_key: string | null;
        payment_method: "bank_transfer" | "pay_on_arrival" | "online" | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      booking_customers: Table<{
        booking_id: string;
        full_name: string;
        email: string;
        phone: string;
        whatsapp: string | null;
        country: string;
        address: string | null;
        created_at: string;
      }>;
      booking_drivers: Table<{
        id: string;
        booking_id: string;
        is_primary: boolean;
        full_name: string;
        age: number;
        licence_country: string;
        licence_issue_date: string;
        created_at: string;
      }>;
      booking_extras: Table<{
        id: string;
        booking_id: string;
        extra_id: string;
        quantity: number;
        unit_price_cents: number;
        pricing_mode: string;
        created_at: string;
      }>;
      booking_status_history: Table<{
        id: string;
        booking_id: string;
        old_status: string | null;
        new_status: string;
        actor_id: string | null;
        internal_note: string | null;
        customer_note: string | null;
        at: string;
      }>;
      vehicle_blocks: Table<{
        id: string;
        vehicle_id: string;
        period: string;
        type: "maintenance" | "internal";
        note: string | null;
        created_by: string | null;
        created_at: string;
      }>;
      email_logs: Table<{
        id: string;
        template_key: string;
        to_email: string;
        booking_id: string | null;
        status: "sent" | "failed";
        error: string | null;
        sent_at: string | null;
        created_at: string;
      }>;
      payment_proofs: Table<{
        id: string;
        booking_id: string;
        storage_path: string;
        status: "pending" | "approved" | "rejected";
        bank_name: string | null;
        transaction_ref: string | null;
        payment_date: string | null;
        reviewer_id: string | null;
        rejection_reason: string | null;
        created_at: string;
        updated_at: string;
      }>;
      audit_logs: Table<{
        id: string;
        actor_id: string | null;
        action: string;
        entity: string;
        entity_id: string | null;
        diff: unknown;
        created_at: string;
      }>;
      payments: Table<{
        id: string;
        booking_id: string;
        method: "bank_transfer" | "online" | "pay_on_arrival" | "cash";
        amount_cents: number;
        currency: string;
        status: "pending" | "recorded" | "refunded";
        recorded_by: string | null;
        note: string | null;
        paid_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      notifications: Table<{
        id: string;
        type: string;
        payload: unknown;
        link: string | null;
        read_at: string | null;
        archived_at: string | null;
        created_at: string;
      }>;
      email_templates: Table<{
        id: string;
        key: string;
        locale: string;
        subject: string;
        body: string;
        created_at: string;
        updated_at: string;
        updated_by: string | null;
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
