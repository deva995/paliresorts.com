import http from 'http';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

// Load environment variables from root and server/.env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

// Default PORT to 3000 to resolve environment port conflict
if (!process.env.PORT || process.env.PORT === '8080') {
  process.env.PORT = '3000';
}

import { createApp } from './server/src/app.js';
import { closeDbPool } from './server/src/db/pool.js';
import { logger } from './server/src/utils/logger.js';
import { getEnv } from './server/src/config/env.js';
import { initEmbeddedDatabase } from './server/src/db/embeddedDb.js';

async function startServer() {
  const env = getEnv();
  if (env.USE_EMBEDDED_DB) {
    await initEmbeddedDatabase();
  }

  const app = express();
  app.set('trust proxy', 1);
  const apiApp = createApp();

  // Route API and health probe requests to Express backend.
  // /api/v1 requests are handled entirely by apiApp and never fall through to the SPA fallback.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.url.startsWith('/api') ||
      req.url.startsWith('/health') ||
      req.url.startsWith('/readyz')
    ) {
      return apiApp(req, res, next);
    }
    next();
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const serveBuiltFrontend =
    isProduction || process.env.SERVE_BUILT_FRONTEND === 'true';
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || (isProduction ? '127.0.0.1' : '0.0.0.0');
  const server = http.createServer(app);

  if (!serveBuiltFrontend) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
        watch: {
          ignored: [
            '**/.pglite_db*/**',
            '**/dist/**',
            '**/.git/**',
            '**/node_modules/**',
            '**/*.log',
            '**/.system_generated/**'
          ]
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(port, host, () => {
    logger.info(`Pali Resort unified server listening on http://${host}:${port}`, {
      port,
      environment: process.env.NODE_ENV || 'development',
    });
  });

  let isShuttingDown = false;
  async function handleShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Gracefully shutting down unified server...`);

    server.close(async (err) => {
      if (err) {
        logger.error('Error closing HTTP server', { error: err.message });
      }
      try {
        await closeDbPool();
        logger.info('Database pool drained and closed successfully');
        process.exit(0);
      } catch (dbErr) {
        logger.error('Error closing database pool', { error: (dbErr as Error).message });
        process.exit(1);
      }
    });

    setTimeout(async () => {
      logger.warn('Graceful shutdown timeout exceeded. Forcing database close and exit.');
      try {
        await closeDbPool();
      } finally {
        process.exit(1);
      }
    }, 10000).unref();
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal error starting unified server:', err);
  process.exit(1);
});
