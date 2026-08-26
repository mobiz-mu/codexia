// Hand-generated from a direct introspection of the live Supabase Postgres
// schema (information_schema.columns + pg_constraint check defs), since no
// container runtime is available in this environment for the official
// `supabase gen types typescript` command (it shells out to a Docker/Podman
// postgres-meta container even when pointed at a remote --db-url).
// Regenerate by re-running the introspection query and this generator if the
// schema changes again.
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      analytics_events: Table<{
        id: string;
        event: string;
        path: string | null;
        vehicle_id: string | null;
        session_hash: string | null;
        device: string | null;
        browser: string | null;
        country: string | null;
        locale: string | null;
        referrer: string | null;
        created_at: string;
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
      bookings: Table<{
        id: string;
        reference: string;
        vehicle_id: string | null;
        category_id: string;
        pickup_at: string;
        return_at: string;
        pickup_location_id: string;
        dropoff_location_id: string;
        status: "draft" | "pending" | "awaiting_payment" | "payment_proof_submitted" | "payment_under_review" | "confirmed" | "partially_paid" | "paid" | "vehicle_assigned" | "ready_for_pickup" | "active" | "completed" | "cancelled" | "no_show" | "refunded" | "rejected";
        currency: string;
        pricing: unknown;
        total_cents: number;
        paid_cents: number;
        balance_cents: number;
        passengers: number;
        flight_number: string | null;
        flight_airport: string | null;
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
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
        payment_method: "bank_transfer" | "pay_on_arrival" | "online" | null;
        /** Channel the booking arrived through (0031). */
        source: "website" | "admin";
        /** Staff-only notes; never rendered to the customer (0031). */
        internal_notes: string | null;
      }>;
      calendar_sync_log: Table<{
        id: string;
        booking_id: string;
        action: "create" | "update" | "delete";
        status: "success" | "failed";
        error: string | null;
        google_event_id: string | null;
        created_at: string;
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
      invoice_counters: Table<{
        year: number;
        next_number: number;
      }>;
      invoice_items: Table<{
        id: string;
        invoice_id: string;
        description: string;
        quantity: number;
        unit_price_cents: number;
        tax_rate: number;
        discount_cents: number;
        line_total_cents: number;
        display_order: number;
      }>;
      invoice_payments: Table<{
        id: string;
        invoice_id: string;
        amount_cents: number;
        method: string;
        paid_at: string;
        note: string | null;
        recorded_by: string | null;
        created_at: string;
      }>;
      invoices: Table<{
        id: string;
        number: string;
        booking_id: string | null;
        customer_name: string;
        customer_email: string;
        customer_address: string | null;
        issue_date: string;
        due_date: string;
        status: "draft" | "sent" | "paid" | "partially_paid" | "void";
        currency: string;
        terms: string | null;
        notes: string | null;
        subtotal_cents: number;
        tax_cents: number;
        discount_cents: number;
        total_cents: number;
        paid_cents: number;
        storage_path: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
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
        delivery_fee_currency: string;
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
      newsletter_subscribers: Table<{
        id: string;
        email: string;
        locale: string;
        status: "subscribed" | "unsubscribed";
        source: string | null;
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
      payment_transactions: Table<{
        id: string;
        booking_id: string;
        provider: string;
        provider_ref: string | null;
        capture_id: string | null;
        amount_cents: number;
        currency: string;
        exchange_rate: number | null;
        status: "created" | "pending" | "succeeded" | "failed" | "denied" | "cancelled" | "refunded" | "reversed" | "disputed";
        webhook_payload: unknown;
        idempotency_key: string;
        created_at: string;
        updated_at: string;
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
      permissions: Table<{
        id: string;
        key: string;
        description: string | null;
        created_at: string;
      }>;
      policy_acceptances: Table<{
        id: string;
        booking_id: string;
        policy_page_id: string;
        version: number;
        accepted_at: string;
        ip: string | null;
        user_agent: string | null;
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
      post_tags: Table<{
        post_id: string;
        tag_id: string;
      }>;
      profiles: Table<{
        id: string;
        full_name: string | null;
        phone: string | null;
        avatar_path: string | null;
        created_at: string;
        updated_at: string;
      }>;
      reminder_logs: Table<{
        id: string;
        booking_id: string;
        reminder_type: "seven_day" | "tomorrow";
        sent_at: string;
      }>;
      review_request_logs: Table<{
        booking_id: string;
        sent_at: string;
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
      role_permissions: Table<{
        role_id: string;
        permission_id: string;
      }>;
      roles: Table<{
        id: string;
        key: string;
        name: string;
        description: string | null;
        created_at: string;
      }>;
      site_settings: Table<{
        key: string;
        value: unknown;
        value_type: "string" | "number" | "boolean" | "json";
        description: string | null;
        updated_at: string;
        updated_by: string | null;
      }>;
      tags: Table<{
        id: string;
        slug: string;
        name_en: string;
        name_fr: string;
      }>;
      user_roles: Table<{
        user_id: string;
        role_id: string;
        assigned_at: string;
        assigned_by: string | null;
      }>;
      vehicle_fuel_records: Table<{
        id: string;
        vehicle_id: string;
        filled_at: string;
        odometer_km: number;
        /** Integer millilitres — never a float (0033). */
        litres_ml: number;
        price_per_litre_cents: number;
        total_cost_cents: number;
        /** Always 'MUR'. */
        currency: string;
        station: string | null;
        driver_name: string | null;
        full_tank: boolean;
        receipt_reference: string | null;
        notes: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      vehicle_fuel_attachments: Table<{
        id: string;
        fuel_record_id: string;
        storage_path: string;
        file_name: string;
        mime_type: string;
        size_bytes: number;
        uploaded_by: string | null;
        created_at: string;
      }>;

      vehicle_inspections: Table<{
        id: string;
        vehicle_id: string;
        /** Which canonical checklist definition this sheet was taken against (0034). */
        checklist_version: number;
        /** Sunday of the Mauritius operational week (Monday-Sunday). */
        week_ending: string;
        inspection_date: string;
        odometer_km: number;
        company_name: string | null;
        /** Identity snapshot for the printed sheet; vehicle_id stays authoritative. */
        vehicle_registration: string | null;
        vehicle_make_model: string | null;
        /** Free text: a driver is not necessarily an admin user. */
        driver_name: string | null;
        driver_acknowledged_on: string | null;
        inspector_name: string | null;
        inspected_by: string | null;
        inspector_acknowledged_on: string | null;
        /** Written only by the approve path, from the authenticated user. */
        approved_by: string | null;
        approved_at: string | null;
        approval_remarks: string | null;
        /** Derived from the items. Deliberately has no 'approved' value — approval is a separate layer. */
        result: "draft" | "completed" | "attention_required" | "failed";
        defects_notes: string | null;
        /** Optional canonical vehicle_blocks link; never populated automatically. */
        availability_block_id: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;

      vehicle_inspection_items: Table<{
        id: string;
        inspection_id: string;
        section:
          | "exterior"
          | "tyres_wheels"
          | "engine_fluids"
          | "interior"
          | "safety_equipment"
          | "road_test";
        /** Stable key from lib/fleet/inspection-checklist.ts. Append-only. */
        item_key: string;
        display_order: number;
        /** null means not yet answered, which keeps the inspection in draft. */
        result: "pass" | "attention" | "fail" | "na" | null;
        remarks: string | null;
        created_at: string;
        updated_at: string;
      }>;

      vehicle_inspection_attachments: Table<{
        id: string;
        inspection_id: string;
        /** Optionally pins the evidence to the exact checklist item it supports. */
        inspection_item_id: string | null;
        storage_path: string;
        file_name: string;
        mime_type: string;
        size_bytes: number;
        uploaded_by: string | null;
        created_at: string;
      }>;
      vehicle_tariff_periods: Table<{
        id: string;
        vehicle_id: string | null;
        category_id: string | null;
        label: string | null;
        effective_from: string;
        effective_to: string;
        rate_1_day_cents: number;
        rate_3_day_cents: number;
        rate_4_day_cents: number;
        rate_7_day_cents: number;
        rate_14_day_cents: number;
        rate_21_plus_day_cents: number;
        currency: string;
        active: boolean;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      vehicle_tariff_period_locations: Table<{
        tariff_period_id: string;
        location_id: string;
      }>;
      vehicle_blocks: Table<{
        id: string;
        vehicle_id: string;
        period: string;
        /** 'inspection' added by 0034 — one availability engine, one more caller. */
        type:
          | "maintenance"
          | "internal"
          | "preparing"
          | "cleaning"
          | "incident"
          | "stop_sell"
          | "inspection";
        note: string | null;
        created_by: string | null;
        created_at: string;
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
      vehicle_compliance_alert_logs: Table<{
        id: string;
        compliance_record_id: string;
        alert_date: string;
        status_at_alert: "warning" | "urgent" | "expires_today" | "expired";
        created_at: string;
      }>;
      vehicle_compliance_attachments: Table<{
        id: string;
        compliance_record_id: string;
        storage_path: string;
        file_name: string;
        mime_type: string;
        size_bytes: number;
        uploaded_by: string | null;
        created_at: string;
      }>;
      vehicle_compliance_current: Table<{
        id: string;
        vehicle_id: string;
        document_type: "road_tax" | "insurance" | "psvl" | "fitness" | "other";
        custom_type: string | null;
        reference_number: string | null;
        provider: string | null;
        issued_date: string | null;
        expiry_date: string;
        cost_cents: number | null;
        remarks: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      vehicle_compliance_records: Table<{
        id: string;
        vehicle_id: string;
        document_type: "road_tax" | "insurance" | "psvl" | "fitness" | "other";
        custom_type: string | null;
        reference_number: string | null;
        provider: string | null;
        issued_date: string | null;
        expiry_date: string;
        cost_cents: number | null;
        /** Always 'MUR' — internal fleet costs are rupee-denominated (0030). */
        currency: string;
        remarks: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      vehicle_images: Table<{
        id: string;
        vehicle_id: string;
        path: string;
        display_order: number;
        is_main: boolean;
        alt_en: string | null;
        alt_fr: string | null;
        content_hash: string | null;
        variants: unknown;
        blur_data_url: string | null;
        created_at: string;
      }>;
      vehicle_incident_attachments: Table<{
        id: string;
        incident_id: string;
        category: "photo" | "police_report" | "insurance_document" | "repair_quotation" | "other";
        storage_path: string;
        file_name: string;
        mime_type: string;
        size_bytes: number;
        uploaded_by: string | null;
        created_at: string;
      }>;
      vehicle_incident_records: Table<{
        id: string;
        vehicle_id: string;
        booking_id: string | null;
        availability_block_id: string | null;
        incident_date: string;
        incident_time: string | null;
        location: string | null;
        driver_customer_name: string | null;
        incident_type:
          | "collision"
          | "parking_damage"
          | "windscreen"
          | "tyre_wheel"
          | "vandalism"
          | "theft_attempt"
          | "weather_damage"
          | "mechanical_damage"
          | "other";
        custom_type: string | null;
        accident_description: string | null;
        damage_description: string | null;
        affected_areas: string | null;
        police_report_reference: string | null;
        insurance_claim_reference: string | null;
        third_party_details: string | null;
        estimated_repair_cost_cents: number | null;
        actual_repair_cost_cents: number | null;
        /** Always 'MUR'; applies to both repair cost columns (0030). */
        repair_cost_currency: string;
        vehicle_operational_status: "operational" | "limited_operation" | "not_operational";
        repair_status:
          | "reported"
          | "under_assessment"
          | "awaiting_insurance"
          | "approved_for_repair"
          | "under_repair"
          | "repaired"
          | "closed";
        severity: "minor" | "moderate" | "major" | "write_off";
        date_reported: string | null;
        date_repair_started: string | null;
        date_repaired: string | null;
        downtime_start: string | null;
        downtime_end: string | null;
        remarks: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      vehicle_maintenance_attachments: Table<{
        id: string;
        maintenance_record_id: string;
        storage_path: string;
        file_name: string;
        mime_type: string;
        size_bytes: number;
        uploaded_by: string | null;
        created_at: string;
      }>;
      vehicle_maintenance_records: Table<{
        id: string;
        vehicle_id: string;
        maintenance_date: string;
        maintenance_type:
          | "scheduled_service"
          | "repair"
          | "tyre_change"
          | "battery_change"
          | "oil_filter_change"
          | "brake_work"
          | "suspension_work"
          | "electrical_work"
          | "other";
        custom_type: string | null;
        repairs_performed: string | null;
        parts_changed: string | null;
        tyre_changes: string | null;
        battery_changes: string | null;
        servicing_details: string | null;
        oil_filter_changes: string | null;
        brake_work: string | null;
        suspension_work: string | null;
        electrical_work: string | null;
        mileage_km: number | null;
        service_provider: string | null;
        /** Authoritative MUR total; the three component columns are an optional breakdown (0032). */
        cost_cents: number;
        parts_cost_cents: number;
        labour_cost_cents: number;
        other_cost_cents: number;
        invoice_reference: string | null;
        next_service_date: string | null;
        next_service_mileage_km: number | null;
        /** Optional link to the canonical vehicle_blocks row taking this car off the road (0032). */
        availability_block_id: string | null;
        /** Set when this job was raised from a weekly inspection defect (0034). One inspection may have many. */
        source_inspection_id: string | null;
        /** Canonical follow-up identity: sorted, deduplicated checklist item_keys (0035). Unique per inspection. */
        source_inspection_followup_key: string | null;
        /** Always 'MUR' — internal fleet costs are rupee-denominated (0030). */
        currency: string;
        remarks: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
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
        /** Internal/staff vehicle: excluded from public inventory and booking (0030). */
        is_staff_car: boolean;
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
        vin: string | null;
        engine_number: string | null;
        // LEGACY (0021), superseded by vehicle_compliance_records (0027) —
        // not written by any current code path; not dropped, for a future
        // cleanup migration to decide.
        insurance_expiry: string | null;
        road_tax_expiry: string | null;
        fitness_expiry: string | null;
        last_service_date: string | null;
        next_service_date: string | null;
        current_mileage_km: number | null;
        weekly_price_cents: number | null;
        monthly_price_cents: number | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;
      webhook_events: Table<{
        id: string;
        provider: string;
        event_id: string;
        event_type: string;
        payload: unknown;
        processed_at: string | null;
        created_at: string;
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
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
