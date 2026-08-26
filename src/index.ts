import Fastify from 'fastify';

import { routes } from './routes.js';

const fastify = Fastify({
  logger: {
    level: 'info',
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

fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, _address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
