/**
 * Get date parts (yyyy, mm, dd) for a given instant in a specific timezone.
 * Used for S3 keys so folder structure matches the user's calendar day.
 */
export function getDatePartsInTimezone(
  date: Date,
  timezone: string
): { yyyy: string; mm: string; dd: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const yyyy = parts.find((p) => p.type === "year")?.value ?? String(date.getFullYear());
  const mm = parts.find((p) => p.type === "month")?.value ?? String(date.getMonth() + 1).padStart(2, "0");
  const dd = parts.find((p) => p.type === "day")?.value ?? String(date.getDate()).padStart(2, "0");
  return { yyyy, mm, dd };
}
