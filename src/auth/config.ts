function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function secret(name: string): string {
  const value = required(name);
  if (value.length < 32)
    throw new Error(`${name} must be at least 32 characters`);
  return value;
}

export const authConfig = {
  codeSecret: () => secret('AUTH_CODE_SECRET'),
  jwtSecret: () => secret('JWT_SECRET'),
  smtp: () => ({
    host: required('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: required('SMTP_USER'),
    password: required('SMTP_PASSWORD'),
    from: required('SMTP_FROM'),
  }),
};
