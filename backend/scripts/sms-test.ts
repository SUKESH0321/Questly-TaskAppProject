/**
 * Sends one test SMS through the configured provider so you can confirm Twilio works
 * before relying on it:   npm run sms:test -- +919876543210
 * (On a Twilio trial account the number must be verified in your Twilio console.)
 */
import { env } from "../src/config/env.js";
import { normalizePhone } from "../src/utils/phone.js";
import { sendOtpSms } from "../src/utils/sms.js";

const to = normalizePhone(process.argv[2] ?? "");
if (!to) {
  console.error("Usage: npm run sms:test -- +919876543210");
  process.exit(1);
}

console.log(`SMS provider: ${env.sms.provider}`);
try {
  const result = await sendOtpSms(to, "123456");
  if (result.devCode) {
    console.log("Dev mode: nothing was sent (SMS_PROVIDER=console). Set SMS_PROVIDER=twilio and your Twilio keys in backend/.env.");
  } else {
    console.log(`Sent to ${to}. Check the phone for a message containing the code 123456 (a test code, not a real one).`);
  }
} catch (err) {
  console.error("Failed to send:", err instanceof Error ? err.message : err);
  process.exit(1);
}
