/**
 * Returns today's date formatted as YYYY-MM-DD in Indian Standard Time (Asia/Kolkata, UTC+05:30).
 * Prevents UTC midnight boundary bugs across Indian construction job sites.
 */
export function getTodayIst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Returns the current timestamp in ISO 8601 format.
 */
export function getNowIso(): string {
  return new Date().toISOString();
}
