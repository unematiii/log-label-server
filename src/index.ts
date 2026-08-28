import Fastify from 'fastify';

import { closeDatabase, migrateDatabase } from './database/index.js';
import { routes } from './routes.js';

const fastify = Fastify({
  trustProxy: true,
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

fastify.register(routes);

fastify.addHook('onClose', async () => {
  await closeDatabase();
});

async function start(): Promise<void> {
  try {
    await migrateDatabase();
    await fastify.listen({
      port: Number(process.env.PORT ?? 3000),
      host: '0.0.0.0',
    });
  } catch (error) {
    fastify.log.error(error);
    await closeDatabase();
    process.exit(1);
  }
}

void start();
