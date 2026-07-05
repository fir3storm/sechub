/** Parse a date string/value; return null when missing or invalid. */
export function parseValidDate(value: string | Date | undefined | null): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Like parseValidDate but falls back to now() when invalid. */
export function parseValidDateOrNow(value: string | Date | undefined | null): Date {
  return parseValidDate(value) ?? new Date();
}
