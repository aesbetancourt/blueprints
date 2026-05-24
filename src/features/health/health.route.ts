import { getHealthStatus } from './health.service.js';
import type { HealthResponse } from './health.types.js';

export const healthHandler = async (): Promise<HealthResponse> => {
  return getHealthStatus();
};
