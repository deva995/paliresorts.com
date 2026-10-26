import { logger } from '../utils/logger.js';
import { maskPhoneNumber } from '../utils/sanitizer.js';

export interface SmsTransport {
  sendOtp(phone: string, otp: string): Promise<boolean>;
  getLastOtp?(phone: string): string | null;
  clear?(): void;
}

/**
 * In-memory SMS transport for development and test execution.
 * Captures delivered OTPs in memory for automated test assertions
 * without logging raw plaintext OTPs or leaking them in API responses.
 */
class InMemorySmsTransport implements SmsTransport {
  private sentOtps = new Map<string, string>();

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    const masked = maskPhoneNumber(phone);
    logger.info('Simulated SMS OTP sent to guest phone', {
      phone: masked,
      deliveryStatus: 'DELIVERED'
    });

    this.sentOtps.set(phone.replace(/\s+/g, ''), otp);
    return true;
  }

  getLastOtp(phone: string): string | null {
    return this.sentOtps.get(phone.replace(/\s+/g, '')) || null;
  }

  clear(): void {
    this.sentOtps.clear();
  }
}

let activeTransport: SmsTransport = new InMemorySmsTransport();

export function getSmsTransport(): SmsTransport {
  return activeTransport;
}

export function setSmsTransport(transport: SmsTransport): void {
  activeTransport = transport;
}
