export const KNOWN_TEMPLATE_KEYS = [
  {
    key: "booking_received_customer",
    label: "Booking Received (Customer)",
    variables: [
      "reference",
      "customerName",
      "vehicleName",
      "pickupLocationName",
      "dropoffLocationName",
      "pickupAt",
      "returnAt",
      "paymentMethodLabel",
      "totalFormatted",
      "myBookingUrl",
    ],
  },
  {
    key: "booking_confirmed_customer",
    label: "Booking Confirmed (Customer)",
    variables: [
      "reference",
      "customerName",
      "vehicleName",
      "pickupLocationName",
      "dropoffLocationName",
      "pickupAt",
      "returnAt",
      "balanceFormatted",
      "myBookingUrl",
    ],
  },
] as const;
