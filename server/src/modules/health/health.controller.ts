import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';

let databaseHealthChecker = checkDatabaseHealth;

export function setDatabaseHealthChecker(checker: typeof checkDatabaseHealth): void {
  databaseHealthChecker = checker;
}

export function resetDatabaseHealthChecker(): void {
  databaseHealthChecker = checkDatabaseHealth;
}

export async function getLiveness(_req: Request, res: Response): Promise<void> {
  // Liveness simply indicates the process is alive and accepting event loop cycles
  res.status(200).json({ status: 'pass' });
}

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  const dbHealth = await databaseHealthChecker();


  if (!dbHealth.isHealthy) {
    logger.error('Readiness probe failed: Database connection is unhealthy', {
      error: dbHealth.error,
      latencyMs: dbHealth.latencyMs
    });

    // Minimal public failure response (RFC 8555 health format) - zero internal leak
    res.status(503).json({ status: 'fail' });
    return;
  }

  // Minimal public pass response
  res.status(200).json({ status: 'pass' });
}
