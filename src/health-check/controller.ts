import type { FastifyRequest, FastifyReply } from 'fastify';

export async function healthCheckController(
  _request: FastifyRequest,
  _reply: FastifyReply
) {
  return { status: 'ok' };
}
