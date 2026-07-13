export type BookingStatus =
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

// Legal transitions for the booking status machine. Admin-facing statuses
// (payment_under_review, vehicle_assigned, etc.) only move forward or into
// a terminal/cancellation state — never backward past confirmation.
export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["awaiting_payment", "payment_proof_submitted", "confirmed", "rejected", "cancelled"],
  awaiting_payment: ["payment_proof_submitted", "confirmed", "rejected", "cancelled"],
  payment_proof_submitted: ["payment_under_review", "confirmed", "rejected"],
  payment_under_review: ["confirmed", "partially_paid", "paid", "rejected"],
  confirmed: ["partially_paid", "paid", "vehicle_assigned", "cancelled", "no_show"],
  partially_paid: ["paid", "vehicle_assigned", "cancelled"],
  paid: ["vehicle_assigned", "cancelled"],
  vehicle_assigned: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["active", "no_show", "cancelled"],
  active: ["completed"],
  completed: ["refunded"],
  cancelled: ["refunded"],
  no_show: ["refunded"],
  rejected: [],
  refunded: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  awaiting_payment: "Awaiting Payment",
  payment_proof_submitted: "Proof Submitted",
  payment_under_review: "Proof Under Review",
  confirmed: "Confirmed",
  partially_paid: "Partially Paid",
  paid: "Paid",
  vehicle_assigned: "Vehicle Assigned",
  ready_for_pickup: "Ready for Pickup",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
  refunded: "Refunded",
  rejected: "Rejected",
};
