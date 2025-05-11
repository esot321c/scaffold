import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/utils/api-client';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LogRetentionSettings } from '@scaffold/types';
import { Switch } from '@/components/ui/switch';

// Define specific types for each mutation's parameter
type RetentionUpdateParams = Pick<
  LogRetentionSettings,
  'securityLogDays' | 'apiLogDays'
>;
type LoggingConfigUpdateParams = Pick<
  LogRetentionSettings,
  'mongoEnabled' | 'fileEnabled'
>;

export function LoggingSettings() {
  const [securityLogDays, setSecurityLogDays] = useState<number>(90);
  const [apiLogDays, setApiLogDays] = useState<number>(30);
  const [mongoEnabled, setMongoEnabled] = useState<boolean>(true);
  const [fileEnabled, setFileEnabled] = useState<boolean>(true);

  // Fetch current settings
  const { data, isLoading, refetch } = useQuery<LogRetentionSettings>({
    queryKey: ['admin', 'settings', 'logs'],
    queryFn: () =>
      apiClient.get<LogRetentionSettings>('admin/config/log-retention'),
  });

  // Handle data changes with an effect
  useEffect(() => {
    if (data) {
      setSecurityLogDays(data.securityLogDays);
      setApiLogDays(data.apiLogDays);
      setMongoEnabled(data.mongoEnabled);
      setFileEnabled(data.fileEnabled);
    }
  }, [data]);

  // Mutation for updating retention period
  const retentionMutation = useMutation({
    mutationFn: (data: RetentionUpdateParams) =>
      apiClient.put<void>('admin/config/log-retention', data),
    onSuccess: () => {
      toast.success('Log retention periods updated');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to update retention periods');
      console.error(error);
    },
  });

  // Mutation for updating logging methods
  const loggingConfigMutation = useMutation({
    mutationFn: (data: LoggingConfigUpdateParams) =>
      apiClient.put<void>('admin/config/logging-config', data),
    onSuccess: () => {
      toast.success('Logging configuration updated');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to update logging configuration');
      console.error(error);
    },
  });

  const handleSaveRetention = () => {
    retentionMutation.mutate({
      securityLogDays,
      apiLogDays,
    });
  };

  const handleSaveLoggingConfig = () => {
    loggingConfigMutation.mutate({
      mongoEnabled,
      fileEnabled,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Settings</CardTitle>
        <CardDescription>
          Configure log retention periods and logging methods
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Retention Periods</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="securityLogDays">
                  Security Log Retention (Days)
                </Label>
                <Input
                  id="securityLogDays"
                  type="number"
                  min="1"
                  max="365"
                  value={securityLogDays}
                  onChange={(e) => setSecurityLogDays(parseInt(e.target.value))}
                  disabled={isLoading || retentionMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiLogDays">API Log Retention (Days)</Label>
                <Input
                  id="apiLogDays"
                  type="number"
                  min="1"
                  max="365"
                  value={apiLogDays}
                  onChange={(e) => setApiLogDays(parseInt(e.target.value))}
                  disabled={isLoading || retentionMutation.isPending}
                />
              </div>
            </div>
            <Button
              onClick={handleSaveRetention}
              disabled={isLoading || retentionMutation.isPending}
            >
              {retentionMutation.isPending
                ? 'Saving...'
                : 'Save Retention Settings'}
            </Button>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-medium">Logging Methods</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="mongoEnabled" className="text-base">
                    MongoDB Logging
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Store logs in MongoDB for long-term analysis
                  </p>
                </div>
                <Switch
                  id="mongoEnabled"
                  checked={mongoEnabled}
                  onCheckedChange={setMongoEnabled}
                  disabled={isLoading || loggingConfigMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="fileEnabled" className="text-base">
                    File Logging
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Store logs in rotating log files
                  </p>
                </div>
                <Switch
                  id="fileEnabled"
                  checked={fileEnabled}
                  onCheckedChange={setFileEnabled}
                  disabled={isLoading || loggingConfigMutation.isPending}
                />
              </div>
            </div>

            <Button
              onClick={handleSaveLoggingConfig}
              disabled={isLoading || loggingConfigMutation.isPending}
            >
              {loggingConfigMutation.isPending
                ? 'Saving...'
                : 'Save Logging Methods'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
