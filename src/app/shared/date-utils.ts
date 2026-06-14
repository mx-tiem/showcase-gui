/**
 * Parses a datetime string from the API as-is, ignoring any timezone suffix.
 * This ensures the time displayed matches exactly what the backend returns.
 */
export function parseApiDateTime(dateTimeString: string): Date {
  if (!dateTimeString) return new Date(NaN);
  // Strip Z or any timezone offset (+HH:MM / -HH:MM) so JS treats it as local time
  const normalized = dateTimeString.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  return new Date(normalized);
}
