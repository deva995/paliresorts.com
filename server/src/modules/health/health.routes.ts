import { Router } from 'express';
import { getLiveness, getReadiness } from './health.controller.js';

export const healthRouter = Router();

// Standard container health probes
healthRouter.get('/health', getLiveness);
healthRouter.get('/health/ready', getReadiness);
