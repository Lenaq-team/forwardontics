/**
 * Common IANA timezone identifiers for user selection.
 */
const COMMON_TIMEZONES_RAW = [
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Caracas",
  "America/Chicago",
  "America/Denver",
  "America/Lima",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Montevideo",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Kolkata",
  "Asia/Manila",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Paris",
  "Europe/Rome",
  "Pacific/Auckland",
  "UTC",
] as const;

export type TimezoneId = (typeof COMMON_TIMEZONES_RAW)[number] | string;

/** UTC offset in minutes (positive = ahead of UTC). */
export function getTimezoneOffsetMinutes(tz: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!m) return 0;
    const sign = m[1] === "+" ? 1 : -1;
    const hours = parseInt(m[2], 10);
    const mins = parseInt(m[3] ?? "0", 10);
    return sign * (hours * 60 + mins);
  } catch {
    return 0;
  }
}

/** Timezones ordered by UTC offset, from + (e.g. UTC+12) to - (e.g. UTC-12). */
export const COMMON_TIMEZONES: readonly string[] = [...COMMON_TIMEZONES_RAW].sort(
  (a, b) => getTimezoneOffsetMinutes(b) - getTimezoneOffsetMinutes(a)
);

export const TIMEZONE_STORAGE_KEY = "forwardontics_user_timezone";

/**
 * Get display label for a timezone (e.g. "America/New_York" -> "New York (EST)")
 */
export function getTimezoneLabel(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    const tzShort = tzPart?.value ?? "";
    const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
    return `${city} (${tzShort})`;
  } catch {
    return tz;
  }
}
