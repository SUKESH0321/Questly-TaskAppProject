/** Questly's cut of every completed task, paid to the admin account. */
export const COMMISSION_RATE = 0.1;

/** Splits a payment into the company's fee and the tasker's payout (rounded to paise). */
export function splitPayment(amount: number): { commission: number; payout: number } {
  const commission = Math.round(amount * COMMISSION_RATE * 100) / 100;
  return { commission, payout: Math.round((amount - commission) * 100) / 100 };
}
