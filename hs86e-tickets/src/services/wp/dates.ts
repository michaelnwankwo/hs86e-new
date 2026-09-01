/** FooEvents stores dates as human strings, timestamps, or Y-m-d plus separate hour fields. */

function metaMap(meta: { key: string; value: unknown }[] | undefined) {
  const out = new Map<string, string>();
  for (const row of meta ?? []) {
    if (row.value == null) continue;
    out.set(row.key, String(row.value));
  }
  return out;
}

function pad(value: string | undefined, fallback = "00") {
  if (!value) return fallback;
  return value.padStart(2, "0");
}

function hour24(hour: string | undefined, period: string | undefined) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return "21";
  const p = (period || "").toLowerCase();
  if (p.startsWith("p") && h < 12) return String(h + 12);
  if (p.startsWith("a") && h === 12) return "00";
  return pad(String(h));
}

export function parseFooEventsSchedule(meta: { key: string; value: unknown }[] | undefined) {
  const m = metaMap(meta);
  const date =
    m.get("WooCommerceEventsDate") ||
    m.get("WooCommerceEventsExpire") ||
    m.get("_event_start") ||
    "";
  const endDate = m.get("WooCommerceEventsEndDate") || m.get("_event_end") || date;
  const hour = hour24(m.get("WooCommerceEventsHour"), m.get("WooCommerceEventsPeriod"));
  const minutes = pad(m.get("WooCommerceEventsMinutes"));
  const endHour = hour24(
    m.get("WooCommerceEventsHourEnd") || m.get("WooCommerceEventsHour"),
    m.get("WooCommerceEventsEndPeriod") || m.get("WooCommerceEventsPeriod"),
  );
  const endMinutes = pad(m.get("WooCommerceEventsMinutesEnd") || m.get("WooCommerceEventsMinutes"));

  const timestamp = m.get("WooCommerceEventsDateTimestamp");
  if (timestamp && /^\d{10,13}$/.test(timestamp)) {
    const ms = timestamp.length === 13 ? Number(timestamp) : Number(timestamp) * 1000;
    const start = new Date(ms);
    if (!Number.isNaN(start.getTime())) {
      return {
        startsAt: start.toISOString(),
        endsAt: endDate ? combine(endDate, endHour, endMinutes) : "",
        doorsAt: m.get("WooCommerceEventsDoors") || "",
      };
    }
  }

  return {
    startsAt: combine(date, hour, minutes) || new Date().toISOString(),
    endsAt: combine(endDate, endHour, endMinutes),
    doorsAt: m.get("WooCommerceEventsDoors") || "",
  };
}

function combine(date: string, hour: string, minutes: string) {
  if (!date) return "";
  const isoDay = toIsoDay(date);
  if (!isoDay) return date;
  const stamp = `${isoDay}T${hour}:${minutes}:00`;
  const parsed = new Date(stamp);
  return Number.isNaN(parsed.getTime()) ? stamp : parsed.toISOString();
}

function toIsoDay(raw: string) {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}

export function isFooEventsProduct(meta: { key: string; value: unknown }[] | undefined) {
  const m = metaMap(meta);
  const flag = (m.get("WooCommerceEventsEvent") || "").toLowerCase();
  if (flag === "event" || flag === "yes" || flag === "1") return true;
  return (
    m.has("WooCommerceEventsDate") ||
    m.has("WooCommerceEventsTicketID") ||
    m.has("WooCommerceEventsType") ||
    m.has("WooCommerceEventsLocation")
  );
}

export function venueFromMeta(meta: { key: string; value: unknown }[] | undefined) {
  const m = metaMap(meta);
  return {
    name:
      m.get("WooCommerceEventsLocation") ||
      m.get("WooCommerceEventsVenue") ||
      m.get("_event_venue") ||
      "Venue TBC",
    city: m.get("_event_city") || m.get("WooCommerceEventsCity") || "",
    address:
      m.get("WooCommerceEventsTicketVenue") ||
      m.get("WooCommerceEventsGPS") ||
      m.get("_event_address") ||
      "",
  };
}
