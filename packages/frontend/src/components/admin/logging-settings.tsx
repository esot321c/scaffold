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
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import type { LogRetentionSettings } from '@scaffold/types';

interface LoggingFormData {
  securityLogDays: number;
  apiLogDays: number;
  mongoEnabled: boolean;
  fileEnabled: boolean;
}

export function LoggingSettings() {
  const [formData, setFormData] = useState<LoggingFormData>({
    securityLogDays: 90,
    apiLogDays: 30,
    mongoEnabled: true,
    fileEnabled: true,
  });

  // Fetch current settings
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['logs', 'config'],
    queryFn: () => apiClient.get<LogRetentionSettings>('logs/config'),
  });

  // Update form data when query data changes
  useEffect(() => {
    if (data) {
      setFormData({
        securityLogDays: data.securityLogDays,
        apiLogDays: data.apiLogDays,
        mongoEnabled: data.mongoEnabled,
        fileEnabled: data.fileEnabled,
      });
    }
  }, [data]);

  // Mutation for updating all settings
  const updateMutation = useMutation({
    mutationFn: (data: LoggingFormData) =>
      apiClient.put<LogRetentionSettings>('logs/config', data),
    onSuccess: () => {
      toast.success('Logging settings updated');
      refetch();
    },
    onError: (error: any) => {
      // Extract the specific error message from the API response
      const errorMessage =
        error?.message ?? 'Failed to update logging settings';
      toast.error(errorMessage);
      console.error(error);
    },
  });

  const handleInputChange = (
    field: keyof LoggingFormData,
    value: number | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logging Settings</CardTitle>
        <CardDescription>
          Configure log retention periods and logging methods
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Retention Settings */}
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
                value={formData.securityLogDays}
                onChange={(e) =>
                  handleInputChange('securityLogDays', parseInt(e.target.value))
                }
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiLogDays">API Log Retention (Days)</Label>
              <Input
                id="apiLogDays"
                type="number"
                min="1"
                max="365"
                value={formData.apiLogDays}
                onChange={(e) =>
                  handleInputChange('apiLogDays', parseInt(e.target.value))
                }
                disabled={updateMutation.isPending}
              />
            </div>
          </div>
        </div>

        {/* Logging Methods */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-medium">Logging Methods</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="mongoEnabled" className="text-base">
                  MongoDB Logging
                </Label>
                <p className="text-sm text-muted-foreground">
                  Store logs in MongoDB for advanced querying and analysis
                </p>
              </div>
              <Switch
                id="mongoEnabled"
                checked={formData.mongoEnabled}
                onCheckedChange={(checked) =>
                  handleInputChange('mongoEnabled', checked)
                }
                disabled={updateMutation.isPending}
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
                checked={formData.fileEnabled}
                onCheckedChange={(checked) =>
                  handleInputChange('fileEnabled', checked)
                }
                disabled={updateMutation.isPending}
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="ml-auto"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
