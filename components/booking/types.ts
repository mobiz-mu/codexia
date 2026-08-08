export type BookingCriteria = {
  categorySlug: string;
  pickupLocationSlug: string;
  dropoffLocationSlug: string;
  pickupAt: string;
  returnAt: string;
  passengers: number;
};

export type BookingCustomer = {
  fullName: string;
  email: string;
  phone: string;
  whatsapp: string;
  country: string;
  address: string;
  driverAge: string;
  licenceCountry: string;
  licenceIssueDate: string;
  hasSecondDriver: boolean;
  secondDriverName: string;
  secondDriverAge: string;
  secondDriverLicenceCountry: string;
  secondDriverLicenceIssueDate: string;
  flightNumber: string;
  flightAirline: string;
  flightArrivalDate: string;
  flightArrivalTime: string;
  specialRequests: string;
};

export type PaymentMethod = "online";

export const EMPTY_CUSTOMER: BookingCustomer = {
  fullName: "",
  email: "",
  phone: "",
  whatsapp: "",
  country: "",
  address: "",
  driverAge: "",
  licenceCountry: "",
  licenceIssueDate: "",
  hasSecondDriver: false,
  secondDriverName: "",
  secondDriverAge: "",
  secondDriverLicenceCountry: "",
  secondDriverLicenceIssueDate: "",
  flightNumber: "",
  flightAirline: "",
  flightArrivalDate: "",
  flightArrivalTime: "",
  specialRequests: "",
};
