import { Schema } from 'mongoose';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

type Options = { fields: string[]; key?: string };

function deriveKey(raw?: string): Buffer {
  const input = raw || process.env.FIELD_ENCRYPTION_KEY || '';
  // Derive a 32-byte key via SHA-256 of provided secret
  return createHash('sha256').update(input).digest();
}

function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${enc.toString('base64')}:${tag.toString('base64')}`;
}

function decrypt(payload: string, key: Buffer): string {
  try {
    if (!payload.startsWith('enc:')) return payload;
    const [, ivB64, dataB64, tagB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return payload; // return raw on failure to avoid crashes
  }
}

export function fieldEncryptionPlugin(schema: Schema, opts: Options) {
  const fields = opts.fields || [];
  const key = deriveKey(opts.key);

  function shouldEncrypt(val: any): val is string {
    return typeof val === 'string' && val.length > 0 && !val.startsWith('enc:');
  }

  schema.pre('save', function (next) {
    const doc: any = this;
    for (const path of fields) {
      const val = doc.get(path);
      if (shouldEncrypt(val)) {
        doc.set(path, encrypt(val, key));
      }
    }
    next();
  });

  // Decrypt on init (after query)
  schema.post('init', function (doc: any) {
    for (const path of fields) {
      const val = doc.get(path);
      if (typeof val === 'string' && val.startsWith('enc:')) {
        doc.set(path, decrypt(val, key));
      }
    }
  });
}

