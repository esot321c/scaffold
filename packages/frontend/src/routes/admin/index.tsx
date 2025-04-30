import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import type { ApiStatus } from '@scaffold/types';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/utils/api-client';

// Define activity stats interface
interface ActivityStats {
  totalUsers: number;
  activeUsers24h: number;
  failedLogins24h: number;
  totalSessions: number;
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
      <CardContent>
        <div className="text-2xl font-bold">{value || '-'}</div>
        <p className="text-muted-foreground">{title}</p>
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
