export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastChecked: string;
}

export interface SystemHealth {
  database: ServiceHealth;
  redis: ServiceHealth;
  mongodb: ServiceHealth;
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    lastChecked: string;
  };
}
