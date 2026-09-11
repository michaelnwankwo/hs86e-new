import type { IssuedTicket } from "@/lib/types";

/**
 * Shared storage keys for the native home-screen widget layer.
 *
 * Web PWA:    the active pass is mirrored to localStorage so the web widget
 *             template (/widgets/quick-ticket-pass) can read it.
 * Native:     the active pass is mirrored to the iOS App Group
 *             (group.com.hs86e.tickets → UserDefaults suite) and the Android
 *             equivalent via @capacitor/preferences, so a native widget can
 *             read the QR offline without launching the app.
 *
 * Web capability contract: nothing below statically imports Capacitor at
 * module scope, so the web/PWA bundle works (and type-checks) independently
 * of the native shell. On plain web the native path feature-detects itself
 * off and silently no-ops, leaving localStorage as the single source.
 */
export const ACTIVE_TICKET_KEY = "hs86e_active_ticket";
export const APP_GROUP = "group.com.hs86e.tickets";
export const NATIVE_PREF_KEY = "active_ticket";

export interface ActiveTicketSnapshot {
  ticketId: string;
  eventName: string;
  tier: string;
  attendeeName: string;
  passIndex?: number;
  passTotal?: number;
  qrPayload: string;
  savedAt: string;
}

export function toActiveTicketSnapshot(ticket: IssuedTicket): ActiveTicketSnapshot {
  return {
    ticketId: ticket.ticketId,
    eventName: ticket.eventName,
    tier: ticket.tier,
    attendeeName: ticket.attendeeName,
    passIndex: ticket.passIndex,
    passTotal: ticket.passTotal,
    qrPayload: ticket.qrPayload ?? "",
    savedAt: new Date().toISOString(),
  };
}

type CapacitorCore = typeof import("@capacitor/core");
type PreferencesModule = typeof import("@capacitor/preferences");

interface NativeBridge {
  Capacitor: CapacitorCore["Capacitor"];
  Preferences: PreferencesModule["Preferences"];
}

/**
 * Single-flight, lazily-evaluated bridge loader. Dynamic imports keep the
 * web chunk graph free of the native packages; every non-native environment
 * (SSR, standard browsers, missing bridge script) resolves to null, which
 * callers treat as "no native store available" and fall back to web storage.
 */
let nativeBridge: Promise<NativeBridge | null> | null = null;

function loadNativeBridge(): Promise<NativeBridge | null> {
  if (typeof window === "undefined") return Promise.resolve(null); // SSR: never touch the bridge
  if (!nativeBridge) {
    nativeBridge = (async () => {
      try {
        const [{ Capacitor }, { Preferences }] = await Promise.all([
          import("@capacitor/core"),
          import("@capacitor/preferences"),
        ]);
        return { Capacitor, Preferences };
      } catch {
        return null; // packages/bridge unavailable — web fallbacks handle it
      }
    })();
  }
  return nativeBridge;
}

async function writeNative(snapshot: ActiveTicketSnapshot | null): Promise<void> {
  try {
    const bridge = await loadNativeBridge();
    if (!bridge) return;
    const { Capacitor, Preferences } = bridge;

    // Runtime feature detection: only the real iOS/Android shell with the
    // Preferences plugin bridged may talk to the App Group store. Plain
    // web/PWA stops here — writeWeb() below already mirrored the pass.
    if (typeof Capacitor.isNativePlatform !== "function" || !Capacitor.isNativePlatform()) {
      return;
    }
    if (
      typeof Capacitor.isPluginAvailable === "function" &&
      !Capacitor.isPluginAvailable("Preferences")
    ) {
      return;
    }

    // group = iOS App Group suite / Android SharedPreferences name, matching
    // the native widget's entitlement so both read the same store.
    // configure() exists on @capacitor/preferences v5+; older bridges skip it.
    if (typeof Preferences.configure === "function") {
      await Preferences.configure({ group: APP_GROUP });
    }
    if (snapshot) {
      await Preferences.set({ key: NATIVE_PREF_KEY, value: JSON.stringify(snapshot) });
    } else {
      await Preferences.remove({ key: NATIVE_PREF_KEY });
    }
  } catch {
    // Bridge unavailable or a write raced an app backgrounding — the
    // localStorage mirror has already served the PWA widget; the native
    // widget keeps its last snapshot until the next successful sync.
  }
}

function writeWeb(snapshot: ActiveTicketSnapshot | null): void {
  if (typeof window === "undefined") return;
  try {
    if (snapshot) {
      window.localStorage.setItem(ACTIVE_TICKET_KEY, JSON.stringify(snapshot));
    } else {
      window.localStorage.removeItem(ACTIVE_TICKET_KEY);
    }
  } catch {
    // storage full / disabled (private mode) — non-fatal
  }
}

/**
 * Persist (or clear) the active pass wherever widgets can read it. Called
 * whenever a ticket is loaded into the wallet or transferred away. Only
 * passes that still hold a live QR are persisted; a null input clears the
 * store (e.g. after a transfer voids the old owner's copy).
 *
 * Never throws: web and native mirrors are independent best-effort writes.
 */
export async function syncActiveTicket(ticket: IssuedTicket | null): Promise<void> {
  const snapshot = ticket && ticket.qrPayload ? toActiveTicketSnapshot(ticket) : null;
  writeWeb(snapshot);
  await writeNative(snapshot);
}
