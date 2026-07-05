import { Resend } from 'resend';

/**
 * EmailPort routes by intent so callers never pick a provider:
 *  - transactional (OTP, KYC status, receipts, security, magic links) → Resend (React Email).
 *  - SMS (phone-first OTP for Nigeria) → Brevo.
 *  - bulk (announcements, results, newsletters) → enqueued → Brevo with Flow Control.
 *
 * Separate sending subdomains keep marketing complaints from poisoning OTP deliverability.
 */
export interface TransactionalMsg {
  to: string;
  subject: string;
  html: string;
  category: string;
}
export interface SmsMsg {
  to: string; // E.164
  text: string; // single-segment GSM-7 where possible
}
export interface BulkCampaign {
  campaignId: string;
  segment: string;
  templateId: string;
  payload: Record<string, unknown>;
}

export interface EmailPort {
  sendTransactional(msg: TransactionalMsg): Promise<{ id: string }>;
  sendSms(msg: SmsMsg): Promise<{ id: string }>;
}

class ResendBrevoEmail implements EmailPort {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);
  private readonly from = process.env.RESEND_FROM ?? 'Voter <no-reply@example.ng>';

  async sendTransactional(msg: TransactionalMsg): Promise<{ id: string }> {
    const res = await this.resend.emails.send({
      from: this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      headers: { 'X-Entity-Category': msg.category },
    });
    if (res.error) throw new Error(`Resend error: ${res.error.message}`);
    return { id: res.data?.id ?? '' };
  }

  async sendSms(msg: SmsMsg): Promise<{ id: string }> {
    // Brevo transactional SMS endpoint.
    const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY ?? '',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: process.env.BREVO_SMS_SENDER ?? 'Voter',
        recipient: msg.to,
        content: msg.text,
        type: 'transactional',
      }),
    });
    if (!res.ok) throw new Error(`Brevo SMS error: ${res.status}`);
    const data = (await res.json()) as { reference?: string; messageId?: number };
    return { id: String(data.messageId ?? data.reference ?? '') };
  }
}

let _email: EmailPort | undefined;
export function getEmail(): EmailPort {
  if (!_email) _email = new ResendBrevoEmail();
  return _email;
}
