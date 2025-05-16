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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Bell, Clock, AlertTriangle, BellOff } from 'lucide-react';
import {
  type AdminNotificationSettings,
  AuthEventType,
  SystemEventType,
  type NotificationEventType,
  type NotificationPriority,
} from '@scaffold/types';
import { formatTimeZoneDisplay } from '@scaffold/timezone-utils';
import getTimeZones from '@scaffold/timezone-utils/dist/get-time-zones';

// Event type descriptions to provide more context
const eventDescriptions: Record<string, string> = {
  // Auth events
  CSRF_FAILURE: 'Cross-site request forgery protection triggered',
  SUSPICIOUS_AUTH_ACTIVITY: 'Login from new location or unusual activity',
  FAILED_LOGIN: 'Failed attempts to log in to the system',

  // System events
  SERVICE_DOWN: 'A service or component of the system is unavailable',
  DATABASE_CONNECTION_LOST: 'Connection to the database has been interrupted',
  CRITICAL_ERROR: 'A severe error that requires immediate attention',
  DISK_SPACE_LOW: 'Server disk space is running low',
  MEMORY_USAGE_HIGH: 'System memory usage is exceeding normal thresholds',
  CPU_USAGE_HIGH: 'CPU utilization is abnormally high',
  HIGH_ERROR_RATE: 'The system is experiencing a high rate of errors',
  API_RATE_LIMIT_EXCEEDED: 'External API rate limits have been reached',
  DATABASE_SLOW_QUERY: 'Database queries are taking longer than expected',
  BACKUP_FAILED: 'Scheduled data backup has failed',
  SECURITY_ALERT: 'Potential security threat detected',
  DEPLOYMENT_COMPLETED: 'New version has been successfully deployed',
  DEPLOYMENT_FAILED: 'Failed to deploy a new version of the application',
};

export function NotificationSettings() {
  // Default settings
  const defaultSettings: AdminNotificationSettings = {
    enabled: true,
    emailFrequency: 'immediate',
    events: {},
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    severityFilter: {
      minSeverity: 'normal',
    },
    digestTime: '09:00', // Default digest time (9 AM)
  };

  const [settings, setSettings] =
    useState<AdminNotificationSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState('general');
  const [availableTimezones, setAvailableTimezones] = useState<any[]>([]);

  // Load available timezones
  useEffect(() => {
    try {
      const timezones = getTimeZones({ includeUtc: true });
      setAvailableTimezones(timezones);
    } catch (error) {
      console.error('Error loading timezones:', error);
      // Fallback with at least the browser timezone
      setAvailableTimezones([
        {
          name: Intl.DateTimeFormat().resolvedOptions().timeZone,
          alternativeName: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      ]);
    }
  }, []);

  // Fetch current settings
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'notification-settings'],
    queryFn: () =>
      apiClient.get<AdminNotificationSettings>('admin/notifications/settings'),
  });

  // Handle data changes with an effect
  useEffect(() => {
    if (data) {
      setSettings(data);
    }
  }, [data]);

  // Mutation for updating settings
  const settingsMutation = useMutation({
    mutationFn: (updatedSettings: Partial<AdminNotificationSettings>) =>
      apiClient.put<AdminNotificationSettings>(
        'admin/notifications/settings',
        updatedSettings,
      ),
    onSuccess: () => {
      toast.success('Notification settings updated');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to update notification settings');
      console.error(error);
    },
  });

  // Handler for sending test notification
  const testMutation = useMutation({
    mutationFn: () => apiClient.post('admin/notifications/test'),
    onSuccess: () => {
      toast.success('Test notification sent');
    },
    onError: (error) => {
      toast.error('Failed to send test notification');
      console.error(error);
    },
  });

  // Update a specific setting
  const updateSetting = (path: string[], value: any) => {
    const newSettings = { ...settings };
    let current: any = newSettings;

    // Navigate to the parent object
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }

    // Set the value
    const lastKey = path[path.length - 1];
    current[lastKey] = value;

    setSettings(newSettings);
  };

  // Save settings
  const handleSaveSettings = () => {
    settingsMutation.mutate(settings);
  };

  // Send test notification
  const handleSendTest = () => {
    testMutation.mutate();
  };

  // Get arrays of event types from the shared type definitions
  const authEventTypes = Object.values(AuthEventType) as string[];
  const systemEventTypes = Object.values(SystemEventType) as string[];

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
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Configure how and when you receive admin notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="events">Event Types</TabsTrigger>
            <TabsTrigger value="quietHours">Quiet Hours</TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center">
                  <Bell className="mr-2 h-4 w-4" />
                  <Label className="text-base">Enable Notifications</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for important system events
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) =>
                  updateSetting(['enabled'], checked)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailFrequency">Email Frequency</Label>
              <Select
                value={settings.emailFrequency}
                onValueChange={(value) =>
                  updateSetting(['emailFrequency'], value)
                }
              >
                <SelectTrigger id="emailFrequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">
                    <div className="flex items-center">
                      <Bell className="mr-2 h-4 w-4" />
                      <span>Immediate</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="hourly">
                    <div className="flex items-center">
                      <Clock className="mr-2 h-4 w-4" />
                      <span>Hourly Digest</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="daily">
                    <div className="flex items-center">
                      <Clock className="mr-2 h-4 w-4" />
                      <span>Daily Digest</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {settings.emailFrequency === 'immediate'
                  ? 'You will receive an email for each notification as it happens'
                  : settings.emailFrequency === 'hourly'
                    ? 'You will receive a digest of notifications once per hour'
                    : 'You will receive a digest of notifications once per day'}
              </p>
            </div>

            {/* Daily digest time option, only shown when daily digest is selected */}
            {settings.emailFrequency === 'daily' && (
              <div className="space-y-2">
                <Label htmlFor="digestTime">Daily Digest Time</Label>
                <input
                  id="digestTime"
                  type="time"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={settings.digestTime || '09:00'}
                  onChange={(e) =>
                    updateSetting(['digestTime'], e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  The time of day when your daily digest will be sent (in your
                  selected timezone)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="minSeverity">Minimum Severity</Label>
              <Select
                value={settings.severityFilter?.minSeverity || 'normal'}
                onValueChange={(value) =>
                  updateSetting(
                    ['severityFilter', 'minSeverity'],
                    value as NotificationPriority,
                  )
                }
              >
                <SelectTrigger id="minSeverity">
                  <SelectValue placeholder="Select minimum severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mr-2"></div>
                      <span>Low - All notifications</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="normal">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
                      <span>Normal - Default level</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-orange-400 mr-2"></div>
                      <span>High - Important only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="critical">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                      <span>Critical - Emergencies only</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only receive notifications with this severity level or higher
              </p>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleSendTest}
                variant="outline"
                disabled={testMutation.isPending || !settings.enabled}
              >
                {testMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                Send Test Notification
              </Button>
            </div>
          </TabsContent>

          {/* Event Types Tab */}
          <TabsContent value="events" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Security Events</h3>
              <div className="space-y-3">
                {authEventTypes.map((event) => (
                  <div
                    key={event}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <Label htmlFor={`event-${event}`} className="text-base">
                        {event.replace(/_/g, ' ')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {eventDescriptions[event] ||
                          'Security-related system event'}
                      </p>
                    </div>
                    <Switch
                      id={`event-${event}`}
                      checked={
                        settings.events?.[event as NotificationEventType] !==
                        false
                      }
                      onCheckedChange={(checked) =>
                        updateSetting(['events', event], checked)
                      }
                    />
                  </div>
                ))}
              </div>

              <h3 className="text-lg font-medium mt-6">System Events</h3>
              <div className="space-y-3">
                {systemEventTypes.map((event) => (
                  <div
                    key={event}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <Label htmlFor={`event-${event}`} className="text-base">
                        {event.replace(/_/g, ' ')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {eventDescriptions[event] || 'System monitoring event'}
                      </p>
                    </div>
                    <Switch
                      id={`event-${event}`}
                      checked={
                        settings.events?.[event as NotificationEventType] !==
                        false
                      }
                      onCheckedChange={(checked) =>
                        updateSetting(['events', event], checked)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Quiet Hours Tab */}
          <TabsContent value="quietHours" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center">
                  <BellOff className="mr-2 h-4 w-4" />
                  <Label className="text-base">Enable Quiet Hours</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pause notifications during specified hours (except for
                  critical alerts)
                </p>
              </div>
              <Switch
                checked={settings.quietHours?.enabled || false}
                onCheckedChange={(checked) =>
                  updateSetting(['quietHours', 'enabled'], checked)
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <input
                  id="startTime"
                  type="time"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={settings.quietHours?.start || '22:00'}
                  onChange={(e) =>
                    updateSetting(['quietHours', 'start'], e.target.value)
                  }
                  disabled={!settings.quietHours?.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Quiet hours begin at this time
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <input
                  id="endTime"
                  type="time"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={settings.quietHours?.end || '08:00'}
                  onChange={(e) =>
                    updateSetting(['quietHours', 'end'], e.target.value)
                  }
                  disabled={!settings.quietHours?.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Quiet hours end at this time
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={
                  settings.quietHours?.timezone ||
                  Intl.DateTimeFormat().resolvedOptions().timeZone
                }
                onValueChange={(value) =>
                  updateSetting(['quietHours', 'timezone'], value)
                }
                disabled={!settings.quietHours?.enabled}
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableTimezones.map((tz) => (
                    <SelectItem key={tz.name} value={tz.name}>
                      {formatTimeZoneDisplay(tz.name, { formatType: 'simple' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Quiet hours will be applied in this timezone
              </p>
            </div>

            <div className="mt-2 p-3 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Important Note</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Critical notifications will still be delivered during quiet
                hours. These include system outages, security breaches, and
                other urgent issues.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSaveSettings}
            disabled={settingsMutation.isPending}
          >
            {settingsMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
