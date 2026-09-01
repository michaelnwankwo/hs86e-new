import { LOGO_PATH } from "@/lib/constants";
import type { EventProduct } from "@/lib/types";

export const DEMO_EVENTS: EventProduct[] = [
  {
    id: "1001",
    slug: "lagos-after-dark",
    name: "Lagos After Dark",
    shortDescription: "The flagship HS86E night — elite tables, live house, and gold-room hospitality.",
    description:
      "Hot Since 86 Entertainment presents Lagos After Dark: a high-contrast night of metallic gold, emerald service, and a locked guest list. Regular floor access, VIP rails, and private tables. Tickets are named, QR-bound, and verified at the door.",
    image: LOGO_PATH,
    gallery: [],
    venue: {
      name: "Eko Atlantic Pavilion",
      city: "Lagos",
      address: "Eko Atlantic City, Victoria Island, Lagos",
    },
    startsAt: "2026-09-19T21:00:00+01:00",
    endsAt: "2026-09-20T04:00:00+01:00",
    doorsAt: "2026-09-19T20:00:00+01:00",
    currency: "NGN",
    category: "event-tickets",
    featured: true,
    variations: [
      {
        id: "2001",
        productId: "1001",
        tier: "Regular",
        name: "Regular",
        price: 25000,
        currency: "NGN",
        stock: 400,
        sku: "HS86E-LAD-REG",
      },
      {
        id: "2002",
        productId: "1001",
        tier: "VIP",
        name: "VIP",
        price: 75000,
        currency: "NGN",
        stock: 120,
        sku: "HS86E-LAD-VIP",
      },
      {
        id: "2003",
        productId: "1001",
        tier: "Table",
        name: "Table",
        price: 350000,
        currency: "NGN",
        stock: 18,
        sku: "HS86E-LAD-TBL",
      },
    ],
  },
  {
    id: "1002",
    slug: "gold-room-sundays",
    name: "Gold Room Sundays",
    shortDescription: "Day-to-night lounge. Champagne service. Members and ticketed guests only.",
    description:
      "A slower, more intimate HS86E room. Afternoon soundcheck into a sunset set. Ideal for hospitality tables and named guest lists.",
    image: LOGO_PATH,
    gallery: [],
    venue: {
      name: "The Gold Room, Ikoyi",
      city: "Lagos",
      address: "Awolowo Road, Ikoyi, Lagos",
    },
    startsAt: "2026-10-04T16:00:00+01:00",
    endsAt: "2026-10-04T23:30:00+01:00",
    doorsAt: "2026-10-04T15:30:00+01:00",
    currency: "NGN",
    category: "event-tickets",
    featured: false,
    variations: [
      {
        id: "2101",
        productId: "1002",
        tier: "Regular",
        name: "Regular",
        price: 15000,
        currency: "NGN",
        stock: 200,
        sku: "HS86E-GRS-REG",
      },
      {
        id: "2102",
        productId: "1002",
        tier: "VIP",
        name: "VIP",
        price: 45000,
        currency: "NGN",
        stock: 60,
        sku: "HS86E-GRS-VIP",
      },
      {
        id: "2103",
        productId: "1002",
        tier: "Table",
        name: "Table",
        price: 180000,
        currency: "NGN",
        stock: 10,
        sku: "HS86E-GRS-TBL",
      },
    ],
  },
];

export function findDemoEvent(slugOrId: string) {
  return DEMO_EVENTS.find((e) => e.slug === slugOrId || e.id === slugOrId) ?? null;
}

export function findDemoVariation(event: EventProduct, variationId: string) {
  return event.variations.find((v) => v.id === variationId) ?? null;
}
