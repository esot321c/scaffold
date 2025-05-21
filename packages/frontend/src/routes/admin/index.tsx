import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import type { ApiStatus } from '@scaffold/types';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/utils/api-client';
import { Shield, Database, Network, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityStats {
  totalUsers: number;
  activeUsers24h: number;
  failedLogins24h: number;
  totalSessions: number;
}

interface SystemHealth {
  database: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    lastChecked: string;
  };
  redis: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    lastChecked: string;
  };
  mongodb: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    lastChecked: string;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    lastChecked: string;
  };
}

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const apiStatusQuery = useQuery({
    queryKey: ['apiStatus'],
    queryFn: () => apiClient.get<ApiStatus>(''),
  });

  const statsQuery = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiClient.get<ActivityStats>('admin/stats'),
  });

  const healthQuery = useQuery({
    queryKey: ['systemHealth'],
    queryFn: () => apiClient.get<SystemHealth>('admin/health'),
    refetchInterval: 60000, // Refetch every minute
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* API Status Section */}
      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-4">API Status</h2>
        {apiStatusQuery.isLoading ? (
          <StatusSkeleton />
        ) : apiStatusQuery.isError ? (
          <div className="text-red-500">Failed to load API status</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoCard title="Status" value={apiStatusQuery.data?.status} />
            <InfoCard title="Version" value={apiStatusQuery.data?.version} />
            <InfoCard
              title="Timestamp"
              value={new Date(
                apiStatusQuery.data?.timestamp || '',
              ).toLocaleString()}
            />
          </div>
        )}
      </section>

      {/* Health Monitoring Section */}
      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-4">System Health</h2>
        {healthQuery.isLoading ? (
          <HealthSkeleton />
        ) : healthQuery.isError ? (
          <div className="text-red-500 p-4 rounded-lg border border-red-200 bg-red-50 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Failed to load system health data
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ServiceHealthCard
              title="Database"
              status={healthQuery.data?.database.status}
              responseTime={healthQuery.data?.database.responseTime}
              lastChecked={healthQuery.data?.database.lastChecked}
              icon={<Database className="h-5 w-5" />}
            />
            <ServiceHealthCard
              title="Redis Cache"
              status={healthQuery.data?.redis.status}
              responseTime={healthQuery.data?.redis.responseTime}
              lastChecked={healthQuery.data?.redis.lastChecked}
              icon={<Network className="h-5 w-5" />}
            />
            <ServiceHealthCard
              title="MongoDB"
              status={healthQuery.data?.mongodb.status}
              responseTime={healthQuery.data?.mongodb.responseTime}
              lastChecked={healthQuery.data?.mongodb.lastChecked}
              icon={<Database className="h-5 w-5" />}
            />
            <SystemResourcesCard
              cpuUsage={healthQuery.data?.system.cpuUsage}
              memoryUsage={healthQuery.data?.system.memoryUsage}
              diskUsage={healthQuery.data?.system.diskUsage}
              lastChecked={healthQuery.data?.system.lastChecked}
            />
          </div>
        )}
      </section>

      {/* Stats Section */}
      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Activity Statistics</h2>
        {statsQuery.isLoading ? (
          <StatsSkeleton />
        ) : statsQuery.isError ? (
          <div className="text-red-500">Failed to load activity statistics</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard
              title="Total Users"
              value={statsQuery.data?.totalUsers.toString()}
            />
            <InfoCard
              title="Active Users (24h)"
              value={statsQuery.data?.activeUsers24h.toString()}
            />
            <InfoCard
              title="Failed Logins (24h)"
              value={statsQuery.data?.failedLogins24h.toString()}
            />
            <InfoCard
              title="Active Sessions"
              value={statsQuery.data?.totalSessions.toString()}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{value || '-'}</div>
        <p className="text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}

function ServiceHealthCard({
  title,
  status,
  responseTime,
  lastChecked,
  icon,
}: {
  title: string;
  status?: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastChecked?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card
      className={cn('border', {
        'text-success': status === 'healthy',
        'text-warning': status === 'degraded',
        'text-destructive': status === 'down',
        'text-accent': !status,
      })}
    >
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            {icon}
            <h3 className="font-medium ml-2">{title}</h3>
          </div>
          <div
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              status === 'healthy'
                ? 'bg-success text-success-foreground'
                : status === 'degraded'
                  ? 'bg-warning text-warning-foreground'
                  : 'bg-destructive text-destructive-foreground'
            }`}
          >
            {status || 'Unknown'}
          </div>
        </div>

        <div className="text-sm">
          <div className="flex justify-between">
            <span>Response Time:</span>
            <span className="font-medium">
              {responseTime ? `${responseTime}ms` : 'N/A'}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Last checked:{' '}
            {lastChecked ? new Date(lastChecked).toLocaleString() : 'N/A'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemResourcesCard({
  cpuUsage,
  memoryUsage,
  diskUsage,
  lastChecked,
}: {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  lastChecked?: string;
}) {
  const getUsageLevel = (usage?: number) => {
    if (!usage) return 'bg-gray-100';
    if (usage > 90) return 'bg-red-500';
    if (usage > 70) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center mb-3">
          <Shield className="h-5 w-5 mr-2" />
          <h3 className="font-medium">System Resources</h3>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>CPU Usage:</span>
              <span className="font-medium">
                {cpuUsage ? `${cpuUsage.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${getUsageLevel(cpuUsage)} h-2 rounded-full`}
                style={{ width: `${cpuUsage || 0}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Memory Usage:</span>
              <span className="font-medium">
                {memoryUsage ? `${memoryUsage.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${getUsageLevel(memoryUsage)} h-2 rounded-full`}
                style={{ width: `${memoryUsage || 0}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Disk Usage:</span>
              <span className="font-medium">
                {diskUsage ? `${diskUsage.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${getUsageLevel(diskUsage)} h-2 rounded-full`}
                style={{ width: `${diskUsage || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mt-3">
          Last checked:{' '}
          {lastChecked ? new Date(lastChecked).toLocaleString() : 'N/A'}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HealthSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
