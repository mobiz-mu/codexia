"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { StepIndicator } from "./StepIndicator";
import { SearchStep } from "./steps/SearchStep";
import { VehicleStep } from "./steps/VehicleStep";
import { ExtrasStep } from "./steps/ExtrasStep";
import { DetailsStep } from "./steps/DetailsStep";
import { SummaryStep } from "./steps/SummaryStep";
import { PaymentStep } from "./steps/PaymentStep";
import { Confirmation } from "./steps/Confirmation";
import { EMPTY_CUSTOMER, type BookingCriteria, type BookingCustomer, type PaymentMethod } from "./types";
import {
  searchAvailableVehicles,
  getExtras,
  quoteBooking,
  createBooking,
} from "@/lib/actions/booking";
import type { VehicleWithImages } from "@/lib/data/vehicles";
import type { PriceBreakdown } from "@/lib/pricing/calculate";
import type { BankDetails } from "@/lib/config/get-bank-details";

type Option = { slug: string; label: string };
type LocationOption = Option & { id: string };
type Extra = Awaited<ReturnType<typeof getExtras>>[number];

export function BookingWizard({
  locale,
  categories,
  locations,
  initialCriteria,
  initialVehicleSlug,
  bankDetails,
}: {
  locale: "en" | "fr";
  categories: Option[];
  locations: LocationOption[];
  initialCriteria: BookingCriteria;
  initialVehicleSlug: string;
  bankDetails: BankDetails;
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

  async function handleSubmitBooking() {
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
      paymentMethod,
      idempotencyKey,
      locale,
    });

    setSubmitting(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    setResult({ reference: response.reference, accessToken: response.accessToken });
  }

  if (result) {
    return (
      <Confirmation
        reference={result.reference}
        accessToken={result.accessToken}
        paymentMethod={paymentMethod}
        vehicleName={vehicle?.name ?? ""}
        bankDetails={bankDetails}
      />
    );
  }

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

      {step === 1 && (
        <SearchStep
          categories={categories}
          locations={locations}
          criteria={criteria}
          onChange={setCriteria}
          onSubmit={handleSearchSubmit}
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
          error={error}
        />
      )}

      {step === 5 && (
        <SummaryStep
          breakdown={breakdown}
          locale={locale}
          policyAcceptance={policyAcceptance}
          onPolicyChange={setPolicyAcceptance}
          onContinue={() => setStep(6)}
          onBack={() => setStep(4)}
        />
      )}

      {step === 6 && (
        <PaymentStep
          paymentMethod={paymentMethod}
          onChange={setPaymentMethod}
          onSubmit={handleSubmitBooking}
          onBack={() => setStep(5)}
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  );
}
