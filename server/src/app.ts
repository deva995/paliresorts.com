import express, { Express } from 'express';
import { getEnv } from './config/env.js';
import {
  createHelmetMiddleware,
  createCorsMiddleware,
  createRateLimiter
} from './middleware/security.js';
import { createRequestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/health.routes.js';
import { meRouter } from './modules/staff/me.routes.js';
import { rosterRouter } from './modules/staff/roster.routes.js';
import { menuRouter } from './modules/menu/menu.routes.js';
import { diningRouter } from './modules/dining/dining.routes.js';
import { guestRouter } from './modules/dining/guest.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { guestOrdersRouter } from './modules/orders/guestOrders.routes.js';
import { kitchenRouter } from './modules/kitchen/kitchen.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import {cashierRouter} from './modules/billing/cashier.routes.js';
import { guestBillingRouter } from './modules/billing/guestBilling.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { hotelRouter } from './modules/hotel/hotel.routes.js';
import { housekeepingRouter } from './modules/housekeeping/housekeeping.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { superAdminRouter } from './modules/superadmin/superadmin.routes.js';
import { docsRouter } from './config/openapi.js';
import { databaseRequestContext } from './db/runtimeContext.js';

export function createApp(): Express {
  const env = getEnv();
  const app = express();

  // 1. Trust proxy for Cloud Run ingress (accurate req.ip and protocol detection)
  app.set('trust proxy', 1);

  // 2. Disable x-powered-by banner
  app.disable('x-powered-by');

  // 3. Security headers and strict CORS
  app.use(createHelmetMiddleware());
  app.use(createCorsMiddleware(env.ALLOWED_ORIGINS));

  // 4. Request body size limits (5MB to allow 1MB base64 images to reach route validation)
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(databaseRequestContext(env.API_PREFIX));

  // 5. Global rate limiting
  app.use(createRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX_REQUESTS));

  // 6. Request correlation ID & structured request logging
  app.use(createRequestLogger());

  // 7. Liveness and Readiness probes at root (unauthenticated & un-rate-limited)
  app.use(healthRouter);

  // 8. API v1 Router
  const apiV1Router = express.Router();
  apiV1Router.use(docsRouter);
  apiV1Router.use(meRouter);
  apiV1Router.use(rosterRouter);
  apiV1Router.use(menuRouter);
  apiV1Router.use(diningRouter);
  apiV1Router.use(guestRouter);
  apiV1Router.use(ordersRouter);
  apiV1Router.use(guestOrdersRouter);
  apiV1Router.use(kitchenRouter);
  apiV1Router.use(billingRouter);
  apiV1Router.use(cashierRouter);
  apiV1Router.use(guestBillingRouter);
  apiV1Router.use(inventoryRouter);
  apiV1Router.use(hotelRouter);
  apiV1Router.use(housekeepingRouter);
  apiV1Router.use(reportsRouter);
  apiV1Router.use(superAdminRouter);

  app.use(env.API_PREFIX, apiV1Router);

  // 9. Unmatched routes -> 404 RFC 7807 handler
  app.use(notFoundHandler);

  // 10. Global error handling middleware
  app.use(errorHandler);

  return app;
}
