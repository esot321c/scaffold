import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/utils/api-client';
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
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/settings/')({
  component: SystemSettings,
});

function SystemSettings() {
  const [logRetentionDays, setLogRetentionDays] = useState<number>(90);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<{ days: number }>(
        'admin/config/log-retention',
      );
      setLogRetentionDays(data.days);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load system settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveLogRetention = async () => {
    try {
      setIsSaving(true);
      await apiClient.put('admin/config/log-retention', {
        days: logRetentionDays,
      });
      toast.success('Log retention period updated');
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update log retention period');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Configuration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Security Log Retention</CardTitle>
          <CardDescription>
            Configure how long security logs are kept in the system before
            automatic cleanup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logRetention">Retention Period (Days)</Label>
              <div className="flex space-x-2">
                <Input
                  id="logRetention"
                  type="number"
                  min="1"
                  max="365"
                  value={logRetentionDays}
                  onChange={(e) =>
                    setLogRetentionDays(parseInt(e.target.value))
                  }
                  disabled={isLoading}
                  className="max-w-[120px]"
                />
                <Button
                  onClick={saveLogRetention}
                  disabled={isLoading || isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Logs older than this number of days will be automatically
                deleted. Recommended: 30-90 days.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional system settings could go here */}
    </div>
  );
}
