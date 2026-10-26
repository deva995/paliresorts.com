import crypto from 'node:crypto';
import fs from 'node:fs';

import path from 'node:path';

const VPS_KEY_PATH = '/home/paliresorts/private/pali-qr-encryption.key';
const LOCAL_TEST_KEY_PATH = path.resolve(process.cwd(), 'tests/fixtures/local-test-qr-encryption.key');

function getKey(): Buffer {
  // 1. Direct environment variable key (hex string)
  if (process.env.PALI_QR_ENCRYPTION_KEY && /^[0-9a-f]{64}$/i.test(process.env.PALI_QR_ENCRYPTION_KEY.trim())) {
    return Buffer.from(process.env.PALI_QR_ENCRYPTION_KEY.trim(), 'hex');
  }

  // 2. Custom environment-specified key path
  if (process.env.PALI_QR_ENCRYPTION_KEY_PATH) {
    try {
      if (fs.existsSync(process.env.PALI_QR_ENCRYPTION_KEY_PATH)) {
        const hex = fs.readFileSync(process.env.PALI_QR_ENCRYPTION_KEY_PATH, 'utf8').trim();
        if (/^[0-9a-f]{64}$/i.test(hex)) {
          return Buffer.from(hex, 'hex');
        }
      }
    } catch {
      // Continue to next option
    }
  }

  // 3. Existing secure VPS behavior
  try {
    if (fs.existsSync(VPS_KEY_PATH)) {
      const hex = fs.readFileSync(VPS_KEY_PATH, 'utf8').trim();
      if (/^[0-9a-f]{64}$/i.test(hex)) {
        return Buffer.from(hex, 'hex');
      }
    }
  } catch {
    // Continue to next option
  }

  // 4. Local test key fixture
  try {
    if (fs.existsSync(LOCAL_TEST_KEY_PATH)) {
      const hex = fs.readFileSync(LOCAL_TEST_KEY_PATH, 'utf8').trim();
      if (/^[0-9a-f]{64}$/i.test(hex)) {
        return Buffer.from(hex, 'hex');
      }
    }
  } catch {
    // Continue to next option
  }

  // 5. Test / development fallback
  if (['test', 'development'].includes(process.env.NODE_ENV || '')) {
    return Buffer.from('27bba2b6a6b2b9bd512b468a90dc9e97c2e3e4883099c8fcd60adb7896f6b009', 'hex');
  }

  throw new Error('Invalid or missing QR encryption key');
}

export function encryptQrSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptQrSecret(value: string): string {
  const parts = value.split(':');

  if (
    parts.length !== 4 ||
    parts[0] !== 'v1' ||
    !/^[0-9a-f]{24}$/i.test(parts[1]) ||
    !/^[0-9a-f]{32}$/i.test(parts[2]) ||
    !/^(?:[0-9a-f]{2})+$/i.test(parts[3])
  ) {
    throw new Error('Invalid encrypted QR credential');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(parts[1], 'hex')
  );

  decipher.setAuthTag(Buffer.from(parts[2], 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(parts[3], 'hex')),
    decipher.final()
  ]).toString('utf8');
}
