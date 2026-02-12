import { sessionStore } from '../session/store.js';
import { createLogger } from '../logger.js';

const log = createLogger('routes');

/**
 * Register all API routes on the Fastify server
 * @param {import('fastify').FastifyInstance} server
 * @returns {void}
 */
export function registerRoutes(server) {
  server.get('/api/sessions', async (_request, _reply) => {
    const sessions = sessionStore.getAllSessions();
    log.debug(`Returning ${sessions.length} sessions`);

    return {
      sessions
    };
  });

  server.get('/api/sessions/:sessionId/snapshot', async (request, reply) => {
    const { sessionId } = request.params;

    try {
      const session = sessionStore.getSession(sessionId);

      if (!session) {
        log.debug(`Session not found: ${sessionId}`);
        reply.code(404);
        return { error: 'Session not found' };
      }

      if (!session.data || session.data.length === 0) {
        log.error(`Session ${sessionId} has no data`);
        reply.code(500);
        return { error: 'Session has no snapshot data' };
      }

      sessionStore.markAsViewed(sessionId);

      reply.header('Content-Type', session.mimeType || 'application/octet-stream');
      reply.header('X-Document-Type', session.documentType || 'unknown');
      reply.header('X-Original-Path', encodeURIComponent(session.originalPath || ''));
      reply.header('X-Output-Format', session.outputFormat || 'unknown');
      reply.header('X-Timestamp', session.timestamp || new Date().toISOString());
      reply.header('X-Sequence-Number', (session.sequenceNumber || 0).toString());

      log.debug(
        `Returning snapshot for session ${sessionId}, ${session.data.length} bytes, mimeType: ${session.mimeType}`
      );

      return reply.send(session.data);
    } catch (err) {
      log.error(`Error getting snapshot for session ${sessionId}:`, err);
      reply.code(500);
      return { error: `Internal error: ${err.message}` };
    }
  });

  server.get('/api/sessions/:sessionId/info', async (request, reply) => {
    const { sessionId } = request.params;
    const session = sessionStore.getSession(sessionId);

    if (!session) {
      reply.code(404);
      return { error: 'Session not found' };
    }

    return {
      sessionId: session.sessionId,
      documentType: session.documentType,
      originalPath: session.originalPath,
      outputFormat: session.outputFormat,
      mimeType: session.mimeType,
      timestamp: session.timestamp,
      sequenceNumber: session.sequenceNumber,
      dataSize: session.data.length,
      hasUpdate: session.hasUpdate
    };
  });

  server.post('/api/sessions/:sessionId/viewed', async (request, _reply) => {
    const { sessionId } = request.params;
    sessionStore.markAsViewed(sessionId);
    return { success: true };
  });

  server.get('/api/health', async (_request, _reply) => {
    return {
      status: 'ok',
      sessions: sessionStore.size,
      uptime: process.uptime()
    };
  });

  log.debug('Routes registered');
}
