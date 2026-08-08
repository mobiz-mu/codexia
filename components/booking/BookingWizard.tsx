"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { StepIndicator } from "./StepIndicator";
import { PriceSummary } from "./PriceSummary";
import { SearchStep } from "./steps/SearchStep";
import { VehicleStep } from "./steps/VehicleStep";
import { ExtrasStep } from "./steps/ExtrasStep";
import { DetailsStep } from "./steps/DetailsStep";
import { SummaryStep } from "./steps/SummaryStep";
import { PaymentStep } from "./steps/PaymentStep";
import { Confirmation } from "./steps/Confirmation";
import { EMPTY_CUSTOMER, type BookingCriteria, type BookingCustomer } from "./types";
import {
  searchAvailableVehicles,
  getExtras,
  quoteBooking,
  createBooking,
} from "@/lib/actions/booking";
import type { VehicleWithImages } from "@/lib/data/vehicles";
import type { PriceBreakdown } from "@/lib/pricing/calculate";

type Option = { slug: string; label: string };
type LocationOption = Option & { id: string };
type Extra = Awaited<ReturnType<typeof getExtras>>[number];

export function BookingWizard({
  locale,
  categories,
  locations,
  initialCriteria,
  initialVehicleSlug,
}: {
  locale: "en" | "fr";
  categories: Option[];
  locations: LocationOption[];
  initialCriteria: BookingCriteria;
  initialVehicleSlug: string;
}) {
  const t = useTranslations("booking");

  const [step, setStep] = useState(1);
  const [criteria, setCriteria] = useState<BookingCriteria>(initialCriteria);
  const [vehicles, setVehicles] = useState<VehicleWithImages[]>([]);
  const [vehicle, setVehicle] = useState<VehicleWithImages | null>(null);
  const [extrasCatalog, setExtrasCatalog] = useState<Extra[]>([]);
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState<BookingCustomer>(EMPTY_CUSTOMER);
  const [policyAcceptance, setPolicyAcceptance] = useState({
    generalConditions: false,
    privacy: false,
    cancellation: false,
    insurance: false,
  });
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<{
    bookingId: string;
    reference: string;
    accessToken: string;
  } | null>(null);
  const [result, setResult] = useState<{ reference: string; accessToken: string } | null>(null);

  const idempotencyKey = useMemo(
    () => (typeof window !== "undefined" ? window.crypto.randomUUID() : ""),
    []
  );

  const pickupLocation = locations.find((l) => l.slug === criteria.pickupLocationSlug);
  const dropoffLocation = locations.find((l) => l.slug === criteria.dropoffLocationSlug);
  const isAirportPickup = criteria.pickupLocationSlug === "ssr-airport";

  useEffect(() => {
    getExtras().then(setExtrasCatalog);
  }, []);

  async function handleSearchSubmit() {
    setError(null);
    if (!criteria.pickupAt || !criteria.returnAt) return;
    if (new Date(criteria.returnAt) <= new Date(criteria.pickupAt)) {
      setError("Return date must be after pickup date.");
      return;
    }

    setLoading(true);
    setStep(2);
    const results = await searchAvailableVehicles({
      categorySlug: criteria.categorySlug || undefined,
      pickupAt: criteria.pickupAt,
      returnAt: criteria.returnAt,
    });
    setVehicles(results);
    setLoading(false);

    if (initialVehicleSlug) {
      const match = results.find((v) => v.slug === initialVehicleSlug);
      if (match) {
        handleVehicleSelect(match);
      }
    }
  }

  function handleVehicleSelect(selected: VehicleWithImages) {
    setVehicle(selected);
    setStep(3);
  }

  async function handleExtrasContinue() {
    setStep(4);
  }

  async function handleDetailsContinue() {
    if (!vehicle || !pickupLocation || !dropoffLocation) return;
    setError(null);
    setLoading(true);
    const quote = await quoteBooking({
      vehicleId: vehicle.id,
      pickupLocationId: pickupLocation.id,
      dropoffLocationId: dropoffLocation.id,
      pickupAt: criteria.pickupAt,
      returnAt: criteria.returnAt,
      extras,
    });
    setLoading(false);
    if (!quote.ok) {
      setError(quote.error);
      return;
    }
    setBreakdown(quote.breakdown);
    setStep(5);
  }

  async function handleContinueToPayment() {
    setStep(6);
    if (!vehicle || !pickupLocation || !dropoffLocation) return;
    setSubmitting(true);
    setError(null);

    const response = await createBooking({
      vehicleId: vehicle.id,
      categoryId: vehicle.category_id,
      pickupLocationId: pickupLocation.id,
      dropoffLocationId: dropoffLocation.id,
      pickupAt: criteria.pickupAt,
      returnAt: criteria.returnAt,
      extras,
      customer: {
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        whatsapp: customer.whatsapp,
        country: customer.country,
        address: customer.address,
        passengers: criteria.passengers,
        driver: {
          age: Number(customer.driverAge),
          licenceCountry: customer.licenceCountry,
          licenceIssueDate: customer.licenceIssueDate,
        },
        secondDriver: customer.hasSecondDriver
          ? {
              fullName: customer.secondDriverName,
              age: Number(customer.secondDriverAge),
              licenceCountry: customer.secondDriverLicenceCountry,
              licenceIssueDate: customer.secondDriverLicenceIssueDate,
            }
          : undefined,
        flightNumber: customer.flightNumber,
        flightAirline: customer.flightAirline,
        flightArrivalDate: customer.flightArrivalDate,
        flightArrivalTime: customer.flightArrivalTime,
        specialRequests: customer.specialRequests,
      },
      policyAcceptance,
      paymentMethod: "online",
      idempotencyKey,
      locale,
    });

    setSubmitting(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    setPendingBooking({
      bookingId: response.bookingId,
      reference: response.reference,
      accessToken: response.accessToken,
    });
  }

  if (result) {
    return <Confirmation reference={result.reference} accessToken={result.accessToken} />;
  }

  const showSummary = step >= 2;

  const stepContent = (
    <>
      {step === 1 && (
        <SearchStep
          categories={categories}
          locations={locations}
          criteria={criteria}
          onChange={setCriteria}
          onSubmit={handleSearchSubmit}
          loading={loading}
          error={error}
        />
      )}

      {step === 2 && (
        <VehicleStep
          vehicles={vehicles}
          loading={loading}
          locale={locale}
          onSelect={handleVehicleSelect}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <ExtrasStep
          extras={extrasCatalog}
          selection={extras}
          onChange={setExtras}
          locale={locale}
          onContinue={handleExtrasContinue}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <DetailsStep
          customer={customer}
          onChange={setCustomer}
          isAirportPickup={isAirportPickup}
          onContinue={handleDetailsContinue}
          onBack={() => setStep(3)}
          loading={loading}
          error={error}
        />
      )}

      {step === 5 && (
        <SummaryStep
          breakdown={breakdown}
          locale={locale}
          policyAcceptance={policyAcceptance}
          onPolicyChange={setPolicyAcceptance}
          onContinue={handleContinueToPayment}
          onBack={() => setStep(4)}
        />
      )}

      {step === 6 && (
        <PaymentStep
          pendingBooking={pendingBooking}
          creating={submitting}
          createError={error}
          locale={locale}
          onBack={() => setStep(5)}
          onPaid={() => {
            if (pendingBooking) {
              setResult({ reference: pendingBooking.reference, accessToken: pendingBooking.accessToken });
            }
          }}
        />
      )}
    </>
  );

  return (
    <div>
      <StepIndicator
        currentStep={step}
        labels={{
          search: t("steps.search"),
          vehicle: t("steps.vehicle"),
          extras: t("steps.extras"),
          details: t("steps.details"),
          summary: t("steps.summary"),
          payment: t("steps.payment"),
        }}
      />

      {showSummary ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">{stepContent}</div>

          <div className="lg:col-span-1">
            {/* Mobile/tablet: collapsible summary */}
            <details className="group mb-2 rounded-xl border border-border bg-background lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold text-ink marker:content-none">
                {t("priceSummary.title")}
                <ChevronDown
                  className="h-4 w-4 text-muted transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="px-4 pb-4">
                <PriceSummary
                  vehicle={vehicle}
                  pickupAt={criteria.pickupAt}
                  returnAt={criteria.returnAt}
                  breakdown={breakdown}
                  locale={locale}
                />
              </div>
            </details>

            {/* Desktop: sticky summary sidebar */}
            <div className="sticky top-24 hidden lg:block">
              <p className="mb-2 text-sm font-semibold text-ink">{t("priceSummary.title")}</p>
              <PriceSummary
                vehicle={vehicle}
                pickupAt={criteria.pickupAt}
                returnAt={criteria.returnAt}
                breakdown={breakdown}
                locale={locale}
              />
            </div>
          </div>
        </div>
      ) : (
        stepContent
      )}
    </div>
  );
}
