import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/utils/api-client';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { SecurityLog } from '@scaffold/types';

export function ActivityLog() {
  const [activities, setActivities] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<SecurityLog[]>('users/activity');
        setActivities(response);
      } catch (error) {
        toast.error('Failed to load activity log');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      return 'Unknown';
    }
  };

  const getEventLabel = (event: string) => {
    const eventMap: Record<string, string> = {
      login: 'Login',
      logout: 'Logout',
      token_refresh: 'Token Refresh',
      session_expired: 'Session Expired',
      failed_login: 'Failed Login',
      device_trusted: 'Device Trusted',
      device_removed: 'Device Removed',
      device_registered: 'Device Registered',
      all_sessions_terminated: 'All Sessions Terminated',
      session_terminated: 'Session Terminated',
      csrf_failure: 'Security Check Failed',
    };

    return eventMap[event] || event.replace(/_/g, ' ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No activity found
              </p>
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-start space-x-3">
                    {activity.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={activity.success ? 'default' : 'destructive'}
                        >
                          {getEventLabel(activity.event)}
                        </Badge>
                        <span className="text-muted-foreground text-sm">
                          {activity.timestamp && formatDate(activity.timestamp)}
                        </span>
                      </div>
                      {activity.ipAddress && (
                        <p className="text-sm">IP: {activity.ipAddress}</p>
                      )}
                      {activity.details &&
                        Object.keys(activity.details).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {Object.entries(activity.details).map(
                              ([key, value]) => (
                                <div key={key}>
                                  {key}:{' '}
                                  {typeof value === 'object'
                                    ? JSON.stringify(value)
                                    : String(value)}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
