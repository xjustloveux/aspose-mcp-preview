import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createLogger } from '../logger.js';
import { registerRoutes } from './routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger('server');

/**
 * Create and configure a Fastify server instance
 * @param {Object} config - Server configuration
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
export async function createServer(_config) {
  const server = Fastify({
    logger: false
  });

  const publicPath = join(__dirname, '..', '..', 'public');
  await server.register(fastifyStatic, {
    root: publicPath,
    prefix: '/'
  });

  registerRoutes(server);

  log.debug('Server created');
  return server;
}

/**
 * Start the Fastify server and begin listening for requests
 * @param {import('fastify').FastifyInstance} server
 * @param {Object} config
 * @returns {Promise<void>}
 */
export async function startServer(server, config) {
  try {
    await server.listen({
      port: config.port,
      host: config.host
    });
    log.info(`Server started on ${config.host}:${config.port}`);
  } catch (err) {
    log.error('Failed to start server:', err);
    throw err;
  }
}

/**
 * Stop the Fastify server and close all connections
 * @param {import('fastify').FastifyInstance} server
 * @returns {Promise<void>}
 */
export async function stopServer(server) {
  try {
    await server.close();
    log.info('Server stopped');
  } catch (err) {
    log.error('Error stopping server:', err);
    throw err;
  }
}
