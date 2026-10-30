import { env } from "../config/env.js";

/**
 * Sends the verification SMS through the configured provider.
 *  - console: development only. Prints the code in the server log and returns it
 *    so the UI can show it. Refused in production (see config/env.ts).
 *  - twilio / msg91: real SMS. These need your own account credentials.
 * Returns `devCode` only for the console provider.
 */
export async function sendOtpSms(phone: string, code: string): Promise<{ devCode?: string }> {
  const text = `Your Questly verification code is ${code}. It expires in 10 minutes. Never share it with anyone.`;

  if (env.sms.provider === "console") {
    console.log(`[SMS dev mode] To ${phone}: ${text}`);
    return { devCode: code };
  }

  if (env.sms.provider === "twilio") {
    const { accountSid, authToken, from, messagingServiceSid } = env.sms.twilio;
    const body = new URLSearchParams({ To: phone, Body: text });
    if (messagingServiceSid) body.set("MessagingServiceSid", messagingServiceSid);
    else body.set("From", from);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) throw new Error(`Twilio rejected the message (HTTP ${res.status})`);
    return {};
  }

  // msg91: OTP API. Needs an approved DLT template that uses the ##OTP## variable.
  const { authKey, templateId } = env.sms.msg91;
  const mobile = phone.replace(/^\+/, "");
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp", code);
  const res = await fetch(url, { method: "POST", headers: { authkey: authKey, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`MSG91 rejected the message (HTTP ${res.status})`);
  return {};
}
