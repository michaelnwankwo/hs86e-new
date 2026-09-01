export type TicketTier = "Regular" | "VIP" | "Table";

export type TicketStatus = "Unpaid" | "Not Checked In" | "Checked In" | "Canceled";

export type PaymentGateway = "stripe" | "flutterwave";

export type ScanVerdict = "valid" | "duplicate" | "invalid" | "canceled" | "transferred";

export interface EventVenue {
  name: string;
  city: string;
  address: string;
}

export interface TicketVariation {
  id: string;
  productId: string;
  tier: TicketTier;
  name: string;
  price: number;
  currency: string;
  stock: number | null;
  sku: string;
}

export interface EventProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  image: string | null;
  gallery: string[];
  venue: EventVenue;
  startsAt: string;
  endsAt: string;
  doorsAt: string;
  currency: string;
  variations: TicketVariation[];
  category: string;
  featured: boolean;
}

export interface CheckoutPayload {
  eventSlug: string;
  variationId: string;
  quantity: number;
  name: string;
  email: string;
  phone: string;
  gateway: PaymentGateway;
}

export interface CheckoutResponse {
  orderId: number;
  orderKey: string;
  gateway: PaymentGateway;
  redirectUrl: string;
  demo?: boolean;
}

export interface IssuedTicket {
  ticketId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  tier: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  venueName: string;
  startsAt: string;
  status: TicketStatus;
  checkedInAt?: string;
  orderId: number;
  orderKey: string;
  passIndex?: number;
  passTotal?: number;
  /** Original buyer — never overwritten on transfer. */
  purchaserEmail?: string;
  /** Current holder. Door + wallet lookup key after a transfer. */
  assignedEmail?: string;
  /** Rotating nonce bound into the signed QR. */
  qrToken?: string;
  /** Server-signed QR string. Client renders this; never recomputes HMAC. */
  qrPayload?: string;
  transferredTo?: string;
  transferredFrom?: string;
  transferredAt?: string;
  /** Viewer is the current assignee (server-computed). */
  holder?: boolean;
}

export interface TicketTransferRecord {
  ticketId: string;
  fromEmail: string;
  toEmail: string;
  at: string;
}

export interface ScanValidateRequest {
  ticketId: string;
  eventId: string;
  deviceId: string;
  scannedAt?: string;
}

export interface ScanValidateResponse {
  verdict: ScanVerdict;
  offline?: boolean;
  ticketId: string;
  attendeeName?: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  tier?: string;
  eventName?: string;
  checkedInAt?: string;
  message: string;
  statusLabel?: string;
  passIndex?: number;
  passTotal?: number;
}

export interface QueuedScan {
  ticketId: string;
  eventId: string;
  scannedAt: string;
  deviceId: string;
  synced: boolean;
}

export interface ManifestAttendee {
  ticketId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  tier: string;
  eventId: string;
  eventName: string;
  status: TicketStatus;
  checkedInAt?: string;
  qrToken?: string;
}

export interface StaffSession {
  role: "door_staff";
  sub: string;
  iat: number;
  exp: number;
}
