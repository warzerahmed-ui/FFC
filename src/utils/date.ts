/**
 * Returns a YYYY-MM-DD string in the device's LOCAL timezone (e.g. Iraq UTC+3).
 * Never use `toISOString().split('T')[0]` for business dates: it returns the UTC date,
 * which is the previous day between 00:00 and 03:00 local time.
 */
export const toLocalISODate = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
