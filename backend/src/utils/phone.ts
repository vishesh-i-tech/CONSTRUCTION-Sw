/**
 * Normalizes Indian phone numbers into standard E.164 format (+91XXXXXXXXXX).
 * Handles numbers entered with leading 0, 91, +91, or plain 10 digits with spaces/dashes.
 */
export function normalizeIndianPhone(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return digits.length > 0 ? `+${digits}` : '';
}
