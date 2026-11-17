import crypto from 'node:crypto';
import { execute, queryAll, queryOne } from './db.ts';

export type OtpPurpose = 'EMPLOYEE_REGISTER' | 'CLIENT_REGISTER' | 'PASSWORD_RESET';

export interface SmsConfigStatus {
  configured: boolean;
  provider: string | null;
  missingVars: string[];
}

export function getSmsConfigStatus(): SmsConfigStatus {
  const provider = (process.env.SMS_PROVIDER || '').trim().toLowerCase();

  if (provider === 'twilio') {
    const missing: string[] = [];
    if (!process.env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
    if (!process.env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
    if (!process.env.TWILIO_PHONE_NUMBER) missing.push('TWILIO_PHONE_NUMBER');
    return { configured: missing.length === 0, provider: 'twilio', missingVars: missing };
  }

  if (provider === 'fast2sms') {
    const missing: string[] = [];
    if (!process.env.FAST2SMS_API_KEY) missing.push('FAST2SMS_API_KEY');
    return { configured: missing.length === 0, provider: 'fast2sms', missingVars: missing };
  }

  if (provider === 'msg91') {
    const missing: string[] = [];
    if (!process.env.MSG91_AUTH_KEY) missing.push('MSG91_AUTH_KEY');
    if (!process.env.MSG91_TEMPLATE_ID) missing.push('MSG91_TEMPLATE_ID');
    return { configured: missing.length === 0, provider: 'msg91', missingVars: missing };
  }

  return {
    configured: false,
    provider: null,
    missingVars: [
      'SMS_PROVIDER (twilio | fast2sms | msg91)',
      'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER (or FAST2SMS_API_KEY / MSG91_AUTH_KEY)',
    ],
  };
}

export function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
}

function hashOtp(otp: string, salt: string): string {
  return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
}

async function dispatchRealSms(
  mobile10Digit: string,
  otpCode: string,
  provider: string
): Promise<{ messageId: string }> {
  const messageBody = `Your SIID ERP verification OTP is ${otpCode}. Valid for 5 minutes. Do not share this code with anyone.`;

  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_PHONE_NUMBER!;
    const to = `+91${mobile10Digit}`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');

    const body = new URLSearchParams({
      To: to,
      From: from,
      Body: messageBody,
    });

    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = (await resp.json()) as { sid?: string; message?: string };
    if (!resp.ok || !data.sid) {
      throw new Error(data.message || `Twilio SMS dispatch failed (HTTP ${resp.status})`);
    }
    return { messageId: data.sid };
  }

  if (provider === 'fast2sms') {
    const apiKey = process.env.FAST2SMS_API_KEY!;
    const resp = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'otp',
        variables_values: otpCode,
        numbers: mobile10Digit,
      }),
    });
    const data = (await resp.json()) as { return?: boolean; request_id?: string; message?: string | string[] };
    if (!resp.ok || !data.return) {
      const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      throw new Error(msg || `Fast2SMS dispatch failed (HTTP ${resp.status})`);
    }
    return { messageId: data.request_id || 'fast2sms-ok' };
  }

  if (provider === 'msg91') {
    const authKey = process.env.MSG91_AUTH_KEY!;
    const templateId = process.env.MSG91_TEMPLATE_ID!;
    const resp = await fetch(
      `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(templateId)}&mobile=91${mobile10Digit}&otp=${otpCode}`,
      {
        method: 'POST',
        headers: {
          authkey: authKey,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = (await resp.json()) as { type?: string; request_id?: string; message?: string };
    if (!resp.ok || data.type !== 'success') {
      throw new Error(data.message || `MSG91 SMS dispatch failed (HTTP ${resp.status})`);
    }
    return { messageId: data.request_id || 'msg91-ok' };
  }

  throw new Error('Unsupported SMS provider');
}

export async function sendRealOtp(rawMobile: string, purpose: OtpPurpose): Promise<{
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  provider: string;
}> {
  const mobile = normalizeMobile(rawMobile);
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw Object.assign(new Error('Enter a valid 10-digit Indian mobile number.'), { statusCode: 400 });
  }

  const smsStatus = getSmsConfigStatus();
  if (!smsStatus.configured || !smsStatus.provider) {
    throw Object.assign(
      new Error(
        `Real SMS OTP provider is not configured on the server. Missing environment variables: ${smsStatus.missingVars.join(', ')}. Registration is blocked until a live SMS gateway is configured.`
      ),
      { statusCode: 503, code: 'SMS_NOT_CONFIGURED', missingVars: smsStatus.missingVars }
    );
  }

  // Enforce 60-second resend cooldown & max 3 SMS per 15 minutes
  const recentOtps = await queryAll<{ created_at: string }>(
    `SELECT created_at FROM otp_verifications
     WHERE mobile = ? AND purpose = ?
     ORDER BY created_at DESC LIMIT 5`,
    [mobile, purpose]
  );

  const now = Date.now();
  if (recentOtps.length > 0) {
    const latestMs = new Date(recentOtps[0].created_at).getTime();
    const diffSec = Math.floor((now - latestMs) / 1000);
    if (diffSec < 60) {
      throw Object.assign(
        new Error(`Please wait ${60 - diffSec} seconds before requesting another OTP.`),
        { statusCode: 429, retryAfter: 60 - diffSec }
      );
    }
    const last15Min = recentOtps.filter((r) => now - new Date(r.created_at).getTime() < 15 * 60 * 1000);
    if (last15Min.length >= 3) {
      throw Object.assign(
        new Error('SMS resend limit reached (max 3 OTPs per 15 minutes). Please try later.'),
        { statusCode: 429 }
      );
    }
  }

  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = hashOtp(otpCode, salt);
  const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();

  // Dispatch real SMS BEFORE saving confirmation
  const { messageId } = await dispatchRealSms(mobile, otpCode, smsStatus.provider);

  await execute(
    `INSERT INTO otp_verifications
     (id, mobile, purpose, otp_hash, salt, provider, provider_message_id, attempts, max_attempts, verified, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 3, 0, ?, ?)`,
    [crypto.randomUUID(), mobile, purpose, otpHash, salt, smsStatus.provider, messageId, expiresAt, new Date(now).toISOString()]
  );

  return {
    expiresInSeconds: 300,
    resendCooldownSeconds: 60,
    provider: smsStatus.provider,
  };
}

export async function verifyRealOtp(rawMobile: string, purpose: OtpPurpose, otpCode: string): Promise<boolean> {
  const mobile = normalizeMobile(rawMobile);
  const record = await queryOne<{
    id: string;
    otp_hash: string;
    salt: string;
    attempts: number;
    max_attempts: number;
    verified: number;
    expires_at: string;
  }>(
    `SELECT * FROM otp_verifications
     WHERE mobile = ? AND purpose = ?
     ORDER BY created_at DESC LIMIT 1`,
    [mobile, purpose]
  );

  if (!record) {
    throw Object.assign(new Error('No OTP request found for this mobile number. Please request an OTP first.'), {
      statusCode: 400,
    });
  }

  if (record.verified === 1) {
    throw Object.assign(new Error('This OTP has already been used. Request a new OTP if needed.'), {
      statusCode: 400,
    });
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    throw Object.assign(new Error('OTP has expired. Please request a new OTP.'), { statusCode: 400 });
  }

  if (record.attempts >= record.max_attempts) {
    throw Object.assign(new Error('Maximum verification attempts exceeded. Please request a new OTP.'), {
      statusCode: 429,
    });
  }

  const expectedHash = hashOtp(otpCode.trim(), record.salt);
  if (expectedHash !== record.otp_hash) {
    await execute('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?', [record.id]);
    const remaining = record.max_attempts - (record.attempts + 1);
    throw Object.assign(
      new Error(
        remaining > 0
          ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect OTP. Maximum attempts reached. Request a new OTP.'
      ),
      { statusCode: 400 }
    );
  }

  await execute('UPDATE otp_verifications SET verified = 1 WHERE id = ?', [record.id]);
  return true;
}
