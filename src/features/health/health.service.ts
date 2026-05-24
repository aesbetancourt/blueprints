import type { HealthResponse } from './health.types.js';

export const getHealthStatus = (): HealthResponse => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
});
