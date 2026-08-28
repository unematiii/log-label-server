import { createHmac } from 'node:crypto';

import nodemailer from 'nodemailer';

import { authConfig } from './config.js';

export function hashLoginCode(email: string, code: string): string {
  return createHmac('sha256', authConfig.codeSecret())
    .update(`${email}:${code}`)
    .digest('hex');
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
