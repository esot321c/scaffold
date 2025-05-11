import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/utils/api-client';
import { useAuth } from '@/contexts/auth-context';
import { formatDistanceToNow } from 'date-fns';
import {
  Loader2,
  Check,
  X,
  Shield,
  Trash2,
  Smartphone,
  Laptop,
  Monitor,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import Cookies from 'js-cookie';

interface Device {
  id: string;
  deviceId: string;
  name: string;
  platform: string;
  lastUsedAt: string;
  isTrusted: boolean;
  createdAt: string;
}

export function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    deviceId?: string;
  }>({ open: false });
  const { user } = useAuth();

  // Get current device ID from cookie
  const currentDeviceId = Cookies.get('device_id');

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Device[]>('users/devices');
      setDevices(response);
    } catch (error) {
      toast.error('Failed to load devices');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [user]);

  const handleRemoveDevice = async (deviceId?: string) => {
    if (!deviceId) return;

    try {
      await apiClient.delete(`users/devices/${deviceId}`);
      toast.success('Device has been removed');
      fetchDevices();
    } catch (error) {
      toast.error('Failed to remove device');
      console.error(error);
    } finally {
      setConfirmDialog({ open: false });
    }
  };

  const handleTrustDevice = async (deviceId: string) => {
    try {
      await apiClient.post('users/devices/trust', { deviceId });
      toast.success('Device is now trusted');
      fetchDevices();
    } catch (error) {
      toast.error('Failed to trust device');
      console.error(error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      return 'Unknown';
    }
  };

  const getDeviceIcon = (device: Device) => {
    const platform = device.platform.toLowerCase();

    if (
      platform.includes('android') ||
      platform.includes('ios') ||
      device.name?.toLowerCase().includes('mobile')
    ) {
      return <Smartphone className="h-6 w-6 text-primary" />;
    } else if (
      platform.includes('ipad') ||
      device.name?.toLowerCase().includes('tablet')
    ) {
      return <Smartphone className="h-6 w-6 text-primary" />;
    } else if (
      platform.includes('windows') ||
      platform.includes('macos') ||
      platform.includes('linux')
    ) {
      return <Laptop className="h-6 w-6 text-primary" />;
    } else {
      return <Monitor className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Your Devices</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            These are devices that have been used to sign in to your account.
            You can remove devices you don't recognize or trust devices you use
            regularly.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {devices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No devices found
              </p>
            ) : (
              devices.map((device) => {
                const isCurrentDevice = device.deviceId === currentDeviceId;

                return (
                  <div
                    key={device.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isCurrentDevice ? 'bg-blue-50/30 border-blue-100' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className="mt-1">{getDeviceIcon(device)}</div>
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center">
                          <span className="font-medium">{device.name}</span>
                          {device.isTrusted && (
                            <Badge
                              variant="outline"
                              className="ml-2 bg-green-50 text-green-700 border-green-200"
                            >
                              <Check className="h-3 w-3 mr-1" /> Trusted
                            </Badge>
                          )}
                          {isCurrentDevice && (
                            <Badge
                              variant="outline"
                              className="ml-2 bg-blue-50 text-blue-700 border-blue-200"
                            >
                              Current Device
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Last active: {formatDate(device.lastUsedAt)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Added: {formatDate(device.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!device.isTrusted && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTrustDevice(device.deviceId)}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Trust
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfirmDialog({
                            open: true,
                            deviceId: device.deviceId,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this device?</DialogTitle>
            <DialogDescription>
              This device will no longer be recognized as trusted. This does not
              affect any active sessions.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false })}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleRemoveDevice(confirmDialog.deviceId)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
