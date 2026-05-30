import express from 'express';
import cors from 'cors';
import config from './config';
import authRoutes from './routes/auth';
import playerRoutes from './routes/player';
import scoutRoutes from './routes/scout';
import validatorRoutes from './routes/validator';
import adminRoutes from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import { securityHeaders } from './middleware/securityHeaders';
import { startIndexer } from './services/indexer';
import { checkHealth } from './services/ipfs';
import { logger } from './utils/logger';
import { stellarHealth } from './services/stellar';

const app = express();

app.use(cors());
app.use(securityHeaders);
app.use(express.json());

app.get('/health', async (_req, res) => {
  const healthStatus: Record<string, 'ok' | 'error' | 'disabled'> = {};

  if (config.stellarHealthCheckEnabled) {
    const stellarOk = await stellarHealth();
    healthStatus.stellar = stellarOk ? 'ok' : 'error';
  } else {
    healthStatus.stellar = 'disabled';
  }

  res.json({ status: 'ok', healthStatus });
});

/**
 * Readiness probe — checks liveness of service dependencies.
 * Returns 200 when all dependencies are reachable; 503 when any are down.
 * Currently checks: IPFS (Pinata) storage connectivity.
 */
app.get('/ready', async (_req, res) => {
  try {
    await checkHealth();
    res.json({ status: 'ok', services: { ipfs: 'ok' } });
  } catch {
    res.status(503).json({ status: 'degraded', services: { ipfs: 'unavailable' } });
  }
});

app.use('/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/scouts', scoutRoutes);
app.use('/api/validators', validatorRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`ScoutOff backend running on port ${config.port} [${config.network}]`);
  startIndexer(5_000, (err) => logger.error('Indexer error:', err.message));
});

export default app;
