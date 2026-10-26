import http from 'http';
import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { closeDbPool } from './db/pool.js';

const DRAIN_TIMEOUT_MS = 8000; // Exact 8-second drain period as required

async function bootstrap() {
  let env;
  try {
    env = getEnv();
  } catch (err) {
    logger.error('Failed to validate server configuration', {
      error: (err as Error).message
    });
    process.exit(1);
  }

  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info(`Pali Resort API server listening on port ${env.PORT}`, {
      port: env.PORT,
      environment: env.NODE_ENV,
      apiPrefix: env.API_PREFIX,
      drainPeriodMs: DRAIN_TIMEOUT_MS,
      poolMax: env.DB_POOL_MAX,
      maxInstances: env.CLOUD_RUN_MAX_INSTANCES
    });
  });

  let isShuttingDown = false;

  async function handleGracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Initiating graceful shutdown with ${DRAIN_TIMEOUT_MS}ms drain period...`);

    // 1. Stop accepting new HTTP connections
    server.close((err) => {
      if (err) {
        logger.error('Error during HTTP server close', { error: err.message });
      } else {
        logger.info('HTTP server closed to new connections');
      }
    });

    // 2. Set an 8-second timeout to allow ongoing in-flight requests to complete
    const forceExitTimer = setTimeout(async () => {
      logger.warn(`Drain period (${DRAIN_TIMEOUT_MS}ms) completed. Forcing connection cleanup and exit.`);
      await closeDbPool();
      process.exit(0);
    }, DRAIN_TIMEOUT_MS);

    // Unref timer so it doesn't prevent Node from exiting naturally if requests drain faster
    forceExitTimer.unref();

    try {
      // 3. Drain and close database pool
      await closeDbPool();
      clearTimeout(forceExitTimer);
      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (cleanupErr) {
      logger.error('Error during database pool cleanup', {
        error: (cleanupErr as Error).message
      });
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception thrown', {
      error: err.message,
      stack: err.stack
    });
    handleGracefulShutdown('uncaughtException');
  });
}

bootstrap();
