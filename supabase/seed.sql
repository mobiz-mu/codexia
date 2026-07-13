-- ============================================================================
-- Codexia Ltd — seed data. Vehicles/pricing below are clearly-marked demo
-- content (is_demo = true), not binding specs or prices.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
insert into permissions (key, description) values
  ('manage_bookings', 'View and edit bookings, reassign vehicles, edit extras'),
  ('confirm_bookings', 'Transition bookings to confirmed and other status changes'),
  ('manage_vehicles', 'Manage vehicles, categories, images, availability blocks'),
  ('manage_payments', 'Manage payments and payment transactions'),
  ('approve_payment_proofs', 'Approve or reject uploaded bank transfer proofs'),
  ('create_invoices', 'Create and edit invoices'),
  ('send_invoices', 'Send invoices to customers by email or WhatsApp'),
  ('manage_content', 'Manage locations, extras, blog, banners, policies, FAQ, newsletter, contact messages, email templates'),
  ('approve_reviews', 'Moderate reviews and comments'),
  ('view_analytics', 'View analytics dashboard and system logs'),
  ('manage_users', 'Manage users, roles, and permissions'),
  ('manage_settings', 'Edit site settings')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
insert into roles (key, name, description) values
  ('super_admin', 'Super Admin', 'Full access to every area of the system'),
  ('administrator', 'Administrator', 'Full operational access excluding user/role management'),
  ('booking_manager', 'Booking Manager', 'Manages bookings and confirmations'),
  ('fleet_manager', 'Fleet Manager', 'Manages vehicles, categories, and availability'),
  ('accountant', 'Accountant', 'Manages payments and invoices'),
  ('content_editor', 'Content Editor', 'Manages public-facing content'),
  ('support_agent', 'Support Agent', 'Views bookings and handles customer messages')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p where r.key = 'super_admin'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'administrator'
  and p.key in (
    'manage_bookings', 'confirm_bookings', 'manage_vehicles', 'manage_payments',
    'approve_payment_proofs', 'create_invoices', 'send_invoices', 'manage_content',
    'approve_reviews', 'view_analytics', 'manage_settings'
  )
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'booking_manager' and p.key in ('manage_bookings', 'confirm_bookings', 'view_analytics')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'fleet_manager' and p.key in ('manage_vehicles', 'view_analytics')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'accountant' and p.key in ('manage_payments', 'approve_payment_proofs', 'create_invoices', 'send_invoices', 'view_analytics')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'content_editor' and p.key in ('manage_content', 'approve_reviews')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key = 'support_agent' and p.key in ('manage_bookings', 'manage_content')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Site settings (mirrors lib/config/site.ts SITE_DEFAULTS)
-- ---------------------------------------------------------------------------
insert into site_settings (key, value, value_type, description) values
  ('company_name', '"Codexia Ltd"', 'string', 'Legal company name'),
  ('domain', '"www.codexia.mu"', 'string', 'Primary domain'),
  ('phone', '"+230 52811999"', 'string', 'Primary phone / WhatsApp number'),
  ('whatsapp_number', '"23052811999"', 'string', 'WhatsApp number, digits only for wa.me links'),
  ('email', '"dyash21@hotmail.com"', 'string', 'Primary contact / reply-to email'),
  ('emergency_phone', '"+230 5253 2101"', 'string', 'Emergency contact number'),
  ('opening_hours', '"24/7 including public holidays"', 'string', 'Opening hours'),
  ('currency', '"EUR"', 'string', 'Default currency'),
  ('tax_rate_percent', '0', 'number', 'Default tax rate percentage'),
  ('insurance_excess_cents', '62500', 'number', 'Standard insurance excess'),
  ('delivery_fee_non_airport_cents', '1500', 'number', 'Non-airport delivery/recovery fee'),
  ('min_driver_age', '19', 'number', 'Minimum driver age'),
  ('max_driver_age', '70', 'number', 'Maximum driver age'),
  ('min_licence_years', '1', 'number', 'Minimum years licence held'),
  ('return_grace_minutes', '60', 'number', 'Grace period for returns'),
  ('invoice_prefix', '"CDX-INV-"', 'string', 'Invoice number prefix'),
  ('booking_reference_prefix', '"CDX-"', 'string', 'Booking reference prefix'),
  ('calendar_behavior_on_cancel', '"annotate"', 'string', 'delete | annotate — what happens to the Google Calendar event on cancellation'),
  ('bank_name', '""', 'string', 'Bank transfer: bank name'),
  ('bank_account_name', '""', 'string', 'Bank transfer: account holder name'),
  ('bank_account_number', '""', 'string', 'Bank transfer: account number'),
  ('bank_swift', '""', 'string', 'Bank transfer: SWIFT/BIC code'),
  ('social_facebook', '""', 'string', 'Facebook URL'),
  ('social_instagram', '""', 'string', 'Instagram URL')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Locations (10 seed locations)
-- ---------------------------------------------------------------------------
insert into locations (slug, name_en, name_fr, delivery_fee_cents, display_order) values
  ('ssr-airport', 'SSR Airport (Plaisance)', 'Aéroport SSR (Plaisance)', 0, 1),
  ('port-louis', 'Port Louis', 'Port Louis', 1500, 2),
  ('grand-baie', 'Grand Baie', 'Grand Baie', 1500, 3),
  ('trou-d-eau-douce', 'Trou d''Eau Douce', 'Trou d''Eau Douce', 1500, 4),
  ('flic-en-flac', 'Flic-en-Flac', 'Flic-en-Flac', 1500, 5),
  ('tamarin', 'Tamarin', 'Tamarin', 1500, 6),
  ('le-morne', 'Le Morne', 'Le Morne', 1500, 7),
  ('bel-ombre', 'Bel Ombre', 'Bel Ombre', 1500, 8),
  ('mahebourg', 'Mahébourg', 'Mahébourg', 1500, 9),
  ('belle-mare', 'Belle Mare', 'Belle Mare', 1500, 10)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Vehicle categories (demo)
-- ---------------------------------------------------------------------------
insert into vehicle_categories (slug, name_en, name_fr, description_en, description_fr, display_order, active) values
  ('economy', 'Economy', 'Économique', 'Demonstration category — compact, fuel-efficient cars.', 'Catégorie de démonstration — voitures compactes et économiques.', 1, true),
  ('compact', 'Compact', 'Compacte', 'Demonstration category — city-friendly hatchbacks.', 'Catégorie de démonstration — citadines pratiques.', 2, true),
  ('sedan', 'Sedan', 'Berline', 'Demonstration category — comfortable sedans.', 'Catégorie de démonstration — berlines confortables.', 3, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Vehicles (demo fleet — pricing is placeholder, non-binding)
-- ---------------------------------------------------------------------------
insert into vehicles (
  slug, name, brand, model, year, category_id, description_en, description_fr,
  daily_price_cents, status, featured, is_demo, passengers, doors, luggage,
  transmission, fuel, air_conditioning
)
select
  v.slug, v.name, v.brand, v.model, v.year, c.id, v.description_en, v.description_fr,
  v.daily_price_cents, 'active', v.featured, true, v.passengers, v.doors, v.luggage,
  v.transmission, v.fuel, true
from (values
  ('suzuki-dzire', 'Suzuki Dzire', 'Suzuki', 'Dzire', 2021, 'sedan', 3500, true, 5, 4, 2, 'manual', 'petrol',
    'Demonstration listing — a comfortable compact sedan, ideal for small families exploring Mauritius.',
    'Annonce de démonstration — une berline compacte confortable, idéale pour les petites familles explorant Maurice.'),
  ('suzuki-baleno', 'Suzuki Baleno', 'Suzuki', 'Baleno', 2020, 'compact', 3200, false, 5, 4, 2, 'manual', 'petrol',
    'Demonstration listing — spacious hatchback with a smooth ride for island touring.',
    'Annonce de démonstration — hayon spacieux avec une conduite souple pour explorer l''île.'),
  ('nissan-march', 'Nissan March', 'Nissan', 'March', 2019, 'economy', 2800, false, 5, 4, 1, 'automatic', 'petrol',
    'Demonstration listing — easy-to-drive automatic city car.',
    'Annonce de démonstration — petite citadine automatique facile à conduire.'),
  ('suzuki-celerio', 'Suzuki Celerio', 'Suzuki', 'Celerio', 2022, 'economy', 2900, true, 5, 4, 1, 'automatic', 'petrol',
    'Demonstration listing — Codexia''s most fuel-efficient option, automatic transmission.',
    'Annonce de démonstration — l''option la plus économique de Codexia, boîte automatique.'),
  ('suzuki-swift', 'Suzuki Swift', 'Suzuki', 'Swift', 2021, 'compact', 3300, true, 5, 4, 2, 'manual', 'petrol',
    'Demonstration listing — agile hatchback, a favourite for coastal road trips.',
    'Annonce de démonstration — hayon agile, un favori pour les road trips côtiers.')
) as v(slug, name, brand, model, year, category_slug, daily_price_cents, featured, passengers, doors, luggage, transmission, fuel, description_en, description_fr)
join vehicle_categories c on c.slug = v.category_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Extras
-- ---------------------------------------------------------------------------
insert into extras (name_en, name_fr, price_cents, pricing_mode, display_order) values
  ('Child Seat', 'Siège enfant', 500, 'per_day', 1),
  ('Booster Seat', 'Réhausseur', 400, 'per_day', 2),
  ('GPS Navigation', 'Navigation GPS', 500, 'per_day', 3),
  ('Internet SIM Card', 'Carte SIM Internet', 1000, 'flat', 4),
  ('Extra Insurance (reduced excess)', 'Assurance supplémentaire (franchise réduite)', 1200, 'per_day', 5)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- FAQ
-- ---------------------------------------------------------------------------
insert into faq_categories (slug, name_en, name_fr, display_order) values
  ('documents-eligibility', 'Documents & Eligibility', 'Documents et éligibilité', 1),
  ('airport-delivery', 'Airport & Delivery', 'Aéroport et livraison', 2),
  ('insurance-mileage', 'Insurance & Mileage', 'Assurance et kilométrage', 3),
  ('payment-booking', 'Payment & Booking', 'Paiement et réservation', 4),
  ('driving-mauritius', 'Driving in Mauritius', 'Conduire à Maurice', 5)
on conflict (slug) do nothing;

insert into faq_entries (category_id, question_en, question_fr, answer_en, answer_fr, display_order)
select c.id, f.question_en, f.question_fr, f.answer_en, f.answer_fr, f.display_order
from (values
  ('documents-eligibility', 'What documents do I need to rent a car?', 'Quels documents sont nécessaires pour louer une voiture ?',
    'A valid driving licence held for at least 1 year, a valid ID or passport, and a credit/debit card or cash deposit as required.',
    'Un permis de conduire valide détenu depuis au moins 1 an, une pièce d''identité ou un passeport valide, et une carte de crédit/débit ou un dépôt en espèces si requis.', 1),
  ('documents-eligibility', 'What is the minimum and maximum driver age?', 'Quel est l''âge minimum et maximum du conducteur ?',
    'Drivers must be between 19 and 70 years old and have held their licence for at least 1 year.',
    'Les conducteurs doivent avoir entre 19 et 70 ans et détenir leur permis depuis au moins 1 an.', 2),
  ('documents-eligibility', 'Is a second driver allowed?', 'Un second conducteur est-il autorisé ?',
    'Yes — your first additional driver is included free of charge.',
    'Oui — votre premier conducteur supplémentaire est inclus gratuitement.', 3),
  ('documents-eligibility', 'Are child seats available?', 'Des sièges enfants sont-ils disponibles ?',
    'Yes, child and booster seats can be added as extras during booking.',
    'Oui, des sièges enfants et réhausseurs peuvent être ajoutés en extra lors de la réservation.', 4),
  ('airport-delivery', 'Do you offer airport delivery?', 'Proposez-vous la livraison à l''aéroport ?',
    'Yes, airport delivery and recovery at SSR Airport is free of charge.',
    'Oui, la livraison et la récupération à l''aéroport SSR sont gratuites.', 1),
  ('airport-delivery', 'What if my flight is delayed?', 'Que se passe-t-il si mon vol est retardé ?',
    'Provide your flight number when booking — we monitor arrivals and adjust your pickup time accordingly.',
    'Indiquez votre numéro de vol lors de la réservation — nous suivons les arrivées et ajustons l''heure de prise en charge en conséquence.', 2),
  ('airport-delivery', 'How much does non-airport delivery cost?', 'Quel est le coût de la livraison hors aéroport ?',
    'Delivery or recovery outside the airport costs EUR 15.',
    'La livraison ou la récupération hors aéroport coûte 15 EUR.', 3),
  ('airport-delivery', 'Can I get a SIM card with internet?', 'Puis-je obtenir une carte SIM avec internet ?',
    'Yes, a local internet SIM card can be added as an extra.',
    'Oui, une carte SIM locale avec internet peut être ajoutée en extra.', 4),
  ('insurance-mileage', 'Is insurance included?', 'L''assurance est-elle incluse ?',
    'Yes, comprehensive insurance is included with a standard excess of EUR 625. Extra insurance to reduce the excess is available.',
    'Oui, une assurance complète est incluse avec une franchise standard de 625 EUR. Une assurance supplémentaire pour réduire la franchise est disponible.', 1),
  ('insurance-mileage', 'Is mileage unlimited?', 'Le kilométrage est-il illimité ?',
    'Yes, every rental includes unlimited mileage.',
    'Oui, chaque location inclut un kilométrage illimité.', 2),
  ('insurance-mileage', 'What happens in case of an accident?', 'Que se passe-t-il en cas d''accident ?',
    'Contact us immediately via our 24/7 emergency line and follow the instructions in your rental agreement.',
    'Contactez-nous immédiatement via notre ligne d''urgence 24h/24 et suivez les instructions de votre contrat de location.', 3),
  ('payment-booking', 'Can I pay by bank transfer?', 'Puis-je payer par virement bancaire ?',
    'Yes — bank details are provided at checkout, and you upload proof of payment for our team to confirm.',
    'Oui — les coordonnées bancaires sont fournies lors de la commande, et vous téléversez la preuve de paiement pour confirmation par notre équipe.', 1),
  ('payment-booking', 'Can I pay on arrival?', 'Puis-je payer à l''arrivée ?',
    'Yes — choose "Pay on Arrival" at checkout. Your booking is pending until confirmed by Codexia.',
    'Oui — choisissez "Payer à l''arrivée" lors de la commande. Votre réservation est en attente jusqu''à confirmation par Codexia.', 2),
  ('payment-booking', 'What is your cancellation policy?', 'Quelle est votre politique d''annulation ?',
    'See our Cancellation Policy page for full details on notice periods and any applicable charges.',
    'Consultez notre page Politique d''annulation pour tous les détails sur les délais de préavis et les frais éventuels.', 3),
  ('payment-booking', 'What if I return the car late?', 'Que se passe-t-il si je rends la voiture en retard ?',
    'A 60-minute grace period applies. Beyond that, late-return fees may apply as per your rental agreement.',
    'Une période de grâce de 60 minutes s''applique. Au-delà, des frais de retard peuvent s''appliquer selon votre contrat.', 4),
  ('payment-booking', 'Online payment (MCB)?', 'Paiement en ligne (MCB) ?',
    'Online payment via MCB is coming soon. For now, please use bank transfer or pay on arrival.',
    'Le paiement en ligne via MCB arrive bientôt. Pour l''instant, utilisez le virement bancaire ou le paiement à l''arrivée.', 5),
  ('driving-mauritius', 'Which side of the road do you drive on?', 'De quel côté de la route conduit-on ?',
    'Mauritius drives on the left, as in the UK.',
    'À Maurice, on conduit à gauche, comme au Royaume-Uni.', 1),
  ('driving-mauritius', 'Can I drive on unpaved roads?', 'Puis-je conduire sur des routes non pavées ?',
    'No — vehicles are limited to paved public roads only.',
    'Non — les véhicules sont limités aux routes publiques pavées uniquement.', 2),
  ('driving-mauritius', 'Can I extend my rental?', 'Puis-je prolonger ma location ?',
    'Yes, subject to vehicle availability — contact us as early as possible to arrange an extension.',
    'Oui, sous réserve de disponibilité du véhicule — contactez-nous le plus tôt possible pour organiser une prolongation.', 3),
  ('driving-mauritius', 'What is the fuel policy?', 'Quelle est la politique de carburant ?',
    'The vehicle must be returned with the same fuel level as at pickup.',
    'Le véhicule doit être restitué avec le même niveau de carburant qu''au départ.', 4)
) as f(category_slug, question_en, question_fr, answer_en, answer_fr, display_order)
join faq_categories c on c.slug = f.category_slug;

-- ---------------------------------------------------------------------------
-- Policy pages (version 1 seed content)
-- ---------------------------------------------------------------------------
insert into policy_pages (slug, title_en, title_fr) values
  ('general-rental-conditions', 'General Rental Conditions', 'Conditions générales de location'),
  ('privacy', 'Privacy Policy', 'Politique de confidentialité'),
  ('cookie', 'Cookie Policy', 'Politique de cookies'),
  ('cancellation', 'Cancellation Policy', 'Politique d''annulation'),
  ('insurance', 'Insurance Policy', 'Politique d''assurance'),
  ('payment', 'Payment Policy', 'Politique de paiement'),
  ('fuel', 'Fuel Policy', 'Politique de carburant'),
  ('terms-of-use', 'Terms of Use', 'Conditions d''utilisation')
on conflict (slug) do nothing;

insert into policy_versions (policy_page_id, version, body_en, body_fr)
select p.id, 1, v.body_en, v.body_fr
from (values
  ('general-rental-conditions',
   E'## Inclusions\n- Unlimited mileage\n- Comprehensive insurance\n- Local taxes\n- 24h road assistance\n- First additional driver free\n- Free airport delivery/recovery\n\n## Exclusions\n- Fines\n- Fuel\n- Cancellation charges\n- Late-return fees\n- Lost keys/documents\n\n## Delivery & Recovery\nFree at SSR Airport. EUR 15 for non-airport delivery or recovery.\n\n## Documents & Eligibility\nDriver age 19–70, licence held at least 1 year, valid ID/passport.\n\n## Vehicle Group vs Model\nA specific make/model/fuel type may be replaced by a similar or upgraded vehicle depending on availability.\n\n## Additional Drivers\nThe first additional driver is included free of charge; further drivers may incur a fee.\n\n## Amendments & Extensions\nAmendments and extensions are subject to vehicle availability.\n\n## Insurance & Excess\nComprehensive insurance is included with an excess of EUR 625. Extra insurance is available to reduce this excess. Exclusions apply as detailed in the Insurance Policy.\n\n## Cancellation\nSee the Cancellation Policy for notice periods and charges. No-shows may forfeit any deposit paid.\n\n## Payment\nCard pre-authorization may be required. Amounts may be subject to exchange rate variation.\n\n## Vehicle Use\nVehicles are limited to paved public roads. Mauritius drives on the left.\n\n## Accidents, Damages & Liability\nAny accident or damage must be reported immediately via the 24h emergency line.\n\n## Mechanical Issues & Maintenance\nReport any mechanical issue immediately; do not attempt repairs yourself.\n\n## Fuel Policy\nThe vehicle must be returned with the same fuel level as at pickup.\n\n## Hours & Emergency Contact\nWe operate 24/7 including public holidays. Emergency contact: +230 5253 2101.\n\n## Late Pickup, Early Dropoff & Late Return\nA 60-minute grace period applies to returns; late-return fees may apply beyond this.',
   E'## Inclusions\n- Kilométrage illimité\n- Assurance complète\n- Taxes locales incluses\n- Assistance routière 24h/24\n- Premier conducteur supplémentaire gratuit\n- Livraison/récupération aéroport gratuite\n\n## Exclusions\n- Amendes\n- Carburant\n- Frais d''annulation\n- Frais de retard\n- Perte de clés/documents\n\n## Livraison et récupération\nGratuite à l''aéroport SSR. 15 EUR pour la livraison ou récupération hors aéroport.\n\n## Documents et éligibilité\nÂge du conducteur 19–70 ans, permis détenu depuis au moins 1 an, pièce d''identité/passeport valide.\n\n## Groupe de véhicule vs modèle\nUne marque/modèle/carburant spécifique peut être remplacé par un véhicule similaire ou supérieur selon disponibilité.\n\n## Conducteurs supplémentaires\nLe premier conducteur supplémentaire est inclus gratuitement ; des frais peuvent s''appliquer au-delà.\n\n## Modifications et prolongations\nLes modifications et prolongations sont soumises à disponibilité du véhicule.\n\n## Assurance et franchise\nUne assurance complète est incluse avec une franchise de 625 EUR. Une assurance supplémentaire est disponible pour réduire cette franchise.\n\n## Annulation\nConsultez la Politique d''annulation pour les délais de préavis et frais applicables.\n\n## Paiement\nUne pré-autorisation par carte peut être requise. Les montants peuvent varier selon le taux de change.\n\n## Utilisation du véhicule\nLes véhicules sont limités aux routes publiques pavées. On conduit à gauche à Maurice.\n\n## Accidents, dommages et responsabilité\nTout accident ou dommage doit être signalé immédiatement via la ligne d''urgence 24h/24.\n\n## Problèmes mécaniques et entretien\nSignalez immédiatement tout problème mécanique ; n''essayez pas de réparer vous-même.\n\n## Politique de carburant\nLe véhicule doit être restitué avec le même niveau de carburant qu''au départ.\n\n## Horaires et contact d''urgence\nNous sommes disponibles 24h/24 et 7j/7, y compris les jours fériés. Contact d''urgence : +230 5253 2101.\n\n## Retard de prise en charge, restitution anticipée et retard\nUne période de grâce de 60 minutes s''applique aux retours ; des frais de retard peuvent s''appliquer au-delà.'),
  ('privacy',
   E'## What We Collect\nBooking details, contact information, and payment references necessary to fulfil your rental.\n\n## How We Use It\nTo process bookings, communicate with you, and comply with legal obligations.\n\n## Sharing\nWe do not sell personal data. Data is shared only with service providers necessary to deliver the rental (e.g. insurance, payment verification).\n\n## Your Rights\nYou may request access to, correction of, or deletion of your personal data by contacting dyash21@hotmail.com.',
   E'## Ce que nous collectons\nDétails de réservation, coordonnées et références de paiement nécessaires à la location.\n\n## Utilisation\nPour traiter les réservations, communiquer avec vous et respecter nos obligations légales.\n\n## Partage\nNous ne vendons pas de données personnelles. Les données sont partagées uniquement avec les prestataires nécessaires à la location (assurance, vérification de paiement).\n\n## Vos droits\nVous pouvez demander l''accès, la correction ou la suppression de vos données personnelles en contactant dyash21@hotmail.com.'),
  ('cookie',
   E'## Cookies We Use\nEssential cookies for site function, and privacy-friendly analytics cookies to understand site usage.\n\n## Your Choices\nYou can manage cookie preferences via your browser settings or our cookie consent banner.',
   E'## Cookies utilisés\nCookies essentiels au fonctionnement du site et cookies d''analyse respectueux de la vie privée.\n\n## Vos choix\nVous pouvez gérer vos préférences via les paramètres de votre navigateur ou notre bandeau de consentement.'),
  ('cancellation',
   E'## Notice Periods\nCancellation charges depend on how far in advance you cancel before pickup. Contact us as early as possible.\n\n## No-Shows\nNo-shows may forfeit any deposit paid.',
   E'## Délais de préavis\nLes frais d''annulation dépendent du délai avant la prise en charge. Contactez-nous le plus tôt possible.\n\n## Absence au rendez-vous\nToute absence peut entraîner la perte du dépôt versé.'),
  ('insurance',
   E'## Coverage\nComprehensive insurance is included with every rental, with a standard excess of EUR 625.\n\n## Extra Insurance\nExtra insurance is available to reduce the excess amount, priced per day.\n\n## Exclusions\nInsurance excludes damage from unauthorized use, unpaved roads, or driving under the influence.',
   E'## Couverture\nUne assurance complète est incluse avec chaque location, avec une franchise standard de 625 EUR.\n\n## Assurance supplémentaire\nUne assurance supplémentaire est disponible pour réduire la franchise, facturée par jour.\n\n## Exclusions\nL''assurance exclut les dommages résultant d''une utilisation non autorisée, de routes non pavées, ou de conduite sous influence.'),
  ('payment',
   E'## Accepted Methods\nBank transfer, pay on arrival, or online payment (MCB — coming soon).\n\n## Pre-Authorization\nA card pre-authorization may be required at pickup to cover the insurance excess.\n\n## Currency\nAll prices are shown in EUR; amounts may be subject to exchange rate variation.',
   E'## Méthodes acceptées\nVirement bancaire, paiement à l''arrivée, ou paiement en ligne (MCB — bientôt disponible).\n\n## Pré-autorisation\nUne pré-autorisation par carte peut être requise à la prise en charge pour couvrir la franchise d''assurance.\n\n## Devise\nTous les prix sont affichés en EUR ; les montants peuvent varier selon le taux de change.'),
  ('fuel',
   E'## Fuel Policy\nThe vehicle is provided with a full tank and must be returned at the same fuel level. Refuelling charges apply if returned with less fuel.',
   E'## Politique de carburant\nLe véhicule est fourni avec le plein et doit être restitué au même niveau. Des frais de ravitaillement s''appliquent en cas de retour avec moins de carburant.'),
  ('terms-of-use',
   E'## Use of This Website\nThis website is provided by Codexia Ltd for informational and booking purposes. By using this site, you agree to these terms.\n\n## Intellectual Property\nAll content on this site is the property of Codexia Ltd unless otherwise stated.',
   E'## Utilisation de ce site\nCe site est fourni par Codexia Ltd à des fins d''information et de réservation. En utilisant ce site, vous acceptez ces conditions.\n\n## Propriété intellectuelle\nTout le contenu de ce site est la propriété de Codexia Ltd, sauf mention contraire.')
) as v(slug, body_en, body_fr)
join policy_pages p on p.slug = v.slug
on conflict (policy_page_id, version) do nothing;
