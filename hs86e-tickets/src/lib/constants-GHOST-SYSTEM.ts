export const BRAND = {
  name: "Hot Since 86 Entertainment",
  shortName: "HS86E",
  legalName: "Hot Since 86 Entertainment",
  tagline: "High-end event tickets & VIP hospitality",
  documentId: "RSG-HS86E-PIVOT-001",
} as const;

/** Global logo path — mapped across splash, headers, nav, and hero layouts. */
export const LOGO_PATH = "/logohs86e.jpg";
export const LOGO_ICON_PATH = "/icons/logohs86e.jpg";

export const THEME = {
  surface: "#0B0E14",
  surfaceRaised: "#161B22",
  ink: "#F8FAFC",
  primary: "#043927",
  secondary: "#DFB260",
  metallic: "#D4AF37",
  champagne: "#F5D68D",
  goldBorder: "rgba(223, 178, 96, 0.20)",
  goldGlow: "rgba(223, 178, 96, 0.15)",
} as const;

export const SCAN_QUEUE_KEY = "hs86e_scan_queue_v1";
export const SCAN_LOCAL_SET_KEY = "hs86e_scan_local_ids_v1";
export const DEVICE_ID_KEY = "hs86e_device_id";
export const SPLASH_SEEN_KEY = "hs86e_splash_seen";
export const WALLET_KEY = "hs86e_saved_tickets";
export const WALLET_KEY_LEGACY = "hs86e_wallet_v1";
export const STAFF_COOKIE = "hs86e_staff";
export const MANIFEST_DB = "hs86e_scanner_v1";
export const MANIFEST_STORE = "attendees";
export const MANIFEST_META_STORE = "meta";

export const SCAN_DEBOUNCE_MS = 1500;
export const SCAN_QRBOX = 250;
export const SCAN_FPS = 10;
export const SCAN_FLASH_MS = 300;
export const TICKET_POLL_MS = 2000;
export const TICKET_POLL_ATTEMPTS = 20;
export const QUEUE_REPLAY_POLL_MS = 30_000;
export const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_RATE_MAX = 5;
export const TRANSFER_RATE_WINDOW_MS = 15 * 60 * 1000;
export const TRANSFER_RATE_MAX = 8;
export const CHECKOUT_RATE_WINDOW_MS = 15 * 60 * 1000;
export const CHECKOUT_RATE_MAX = 20;
export const REVALIDATE_RATE_WINDOW_MS = 15 * 60 * 1000;
export const REVALIDATE_RATE_MAX = 60;
export const TRANSFER_TICKET_MAX = 6;
export const TRANSFER_VOID_STATUS = "TRANSFERRED / VOID";
export const TRANSFER_VOID_MESSAGE =
  "This pass was transferred to another user. Original QR is no longer valid.";
export const TRANSFER_CONFIRM_COPY =
  "Transferring this pass will permanently void your current QR code and assign it to the recipient.";
export const STAFF_JWT_TTL = "8h";

export const DEMO_PIN_HINT = "8686";

export const SOUND_PATHS = {
  success: "/sounds/success.wav",
  warn: "/sounds/warn.wav",
  fail: "/sounds/fail.wav",
} as const;
