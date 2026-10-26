import crypto from 'node:crypto';
import { BadRequestError, UnprocessableEntityError } from './errors.js';

/**
 * Verifies a Razorpay payment signature using HMAC-SHA256 and timingSafeEqual.
 * Fails closed if RAZORPAY_KEY_SECRET is not configured or if signature is malformed.
 */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}): boolean {
  const secret = params.secret ?? process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new UnprocessableEntityError(
      'Payment gateway verification unavailable: RAZORPAY_KEY_SECRET is not configured on server'
    );
  }

  if (!params.orderId || !params.paymentId || !params.signature) {
    throw new BadRequestError('Missing required Razorpay verification parameters');
  }

  const cleanSig = params.signature.trim();

  // Signature must be a 64-character hexadecimal string (HMAC-SHA256 output)
  if (!/^[0-9a-fA-F]{64}$/.test(cleanSig)) {
    throw new BadRequestError(
      'Malformed Razorpay signature format: expected 64-character hexadecimal string'
    );
  }

  const payload = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
  const signatureBuffer = Buffer.from(cleanSig, 'utf-8');

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
