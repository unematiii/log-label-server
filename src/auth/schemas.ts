import { Type } from '@sinclair/typebox';

export const EmailBodySchema = Type.Object({
  email: Type.String({ format: 'email', maxLength: 320 }),
});

export const VerifyBodySchema = Type.Object({
  email: Type.String({ format: 'email', maxLength: 320 }),
  code: Type.String({ pattern: '^[0-9]{6}$' }),
});

export const RefreshBodySchema = Type.Object({
  refreshToken: Type.String({ minLength: 32, maxLength: 200 }),
});
