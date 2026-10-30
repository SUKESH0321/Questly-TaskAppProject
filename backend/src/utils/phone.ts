/**
 * Normalises a mobile number to E.164 (+91XXXXXXXXXX for Indian numbers).
 * Accepts: 9876543210, 09876543210, 91 98765 43210, +91-98765-43210, or any
 * international +<country><number>. Returns null when it doesn't look valid.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");

  if (hasPlus) {
    // International: + then 8-15 digits, first digit not 0.
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }

  // Indian formats without a plus sign.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** +919876543210 -> +91 ••••••3210 */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  const tail = phone.slice(-4);
  const cc = phone.startsWith("+91") ? "+91 " : phone.slice(0, 3) + " ";
  return `${cc}${"•".repeat(Math.max(2, phone.length - cc.trim().length - 4))}${tail}`;
}
