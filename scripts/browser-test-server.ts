// Test-only server: no dotenv, no deployment URL, no persistent embedded storage.
import '../server/tests/isolation.mjs';
import express from 'express';
import path from 'node:path';

process.env.PORT = '4317';
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:4317';
const { initEmbeddedDatabase } = await import('../server/src/db/embeddedDb.js');
const { createApp } = await import('../server/src/app.js');
await initEmbeddedDatabase({ inMemory: true });
const app = express();
const api = createApp();
// Test harness only: isolated memory delivery; never mounted by the application server.
const { getSmsTransport } = await import('../server/src/services/sms.service.js');
const {resetLoginRateLimits}=await import('../server/src/middleware/loginRateLimiter.js');
app.post('/__test__/reset-login-limits',(_req,res)=>{
  if(process.env.NODE_ENV!=='test') {res.sendStatus(404);return;}
  resetLoginRateLimits();res.sendStatus(204);
});
app.get('/__test__/otp-delivery', (req,res) => {
  if(process.env.NODE_ENV!=='test') {res.sendStatus(404);return;}
  const code=getSmsTransport().getLastOtp?.(String(req.query.phone || ''));
  if(!code) {res.sendStatus(404);return;}
  res.json({code});
});
app.use((req, res, next) => req.path.startsWith('/api/') ? api(req, res, next) : next());
const directory = path.resolve('.audit-runtime/browser-build');
app.use(express.static(directory));
app.get('*', (_req, res) => res.sendFile(path.join(directory, 'index.html')));
const server = app.listen(4317, '127.0.0.1');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
