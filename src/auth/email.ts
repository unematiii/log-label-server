import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';

import nodemailer from 'nodemailer';

import { authConfig } from './config.js';

export function hashLoginCode(email: string, code: string): string {
  return createHmac('sha256', authConfig.codeSecret())
    .update(`${email}:${code}`)
    .digest('hex');
}

const encryptionKey = () =>
  createHash('sha256').update(authConfig.codeSecret()).digest();

export function encryptLoginCode(code: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(code, 'utf8'),
    cipher.final(),
  ]);

  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptLoginCode(payload: string): string {
  const [encodedIv, encodedTag, encodedValue] = payload.split('.');
  if (!encodedIv || !encodedTag || !encodedValue) {
    throw new Error('Invalid encrypted login code');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(encodedIv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export async function sendLoginCode(email: string, code: string) {
  const config = authConfig.smtp();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });

  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: 'Your LabelLog sign-in code',
    text: `Your LabelLog sign-in code is ${code}. It expires in 5 minutes.`,
  });
}
