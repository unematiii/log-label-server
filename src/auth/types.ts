import type { Static } from '@sinclair/typebox';
import type { RouteGenericInterface } from 'fastify';

import {
  EmailBodySchema,
  RefreshBodySchema,
  VerifyBodySchema,
} from './schemas.js';

export type EmailBody = Static<typeof EmailBodySchema>;
export type VerifyBody = Static<typeof VerifyBodySchema>;
export type RefreshBody = Static<typeof RefreshBodySchema>;

export interface RequestLoginCodeRoute extends RouteGenericInterface {
  Body: EmailBody;
}

export interface VerifyLoginCodeRoute extends RouteGenericInterface {
  Body: VerifyBody;
}

export interface RefreshTokenRoute extends RouteGenericInterface {
  Body: RefreshBody;
}
