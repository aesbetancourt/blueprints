export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
}
